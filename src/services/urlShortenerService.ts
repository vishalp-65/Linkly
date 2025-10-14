import crypto from "crypto"
import { URLRepository } from "../repositories/URLRepository"
import { UserRepository } from "../repositories"
import { IDGenerator } from "./idGenerator"
import { URLValidator, ValidationResult } from "./urlValidator"
import { AliasChecker, AliasAvailabilityResult } from "./aliasChecker"
import { URLCacheService, CacheOptions } from "./urlCacheService"
import { logger } from "../config/logger"
import { metricsService } from "./metricsService"
import {
    addBusinessContext,
    createChildSpan
} from "../middleware/tracingMiddleware"
import { SpanStatusCode } from "@opentelemetry/api"
import { URLMapping, CreateURLMappingInput } from "../types/database"

/**
 * URL Shortening Service
 * Handles URL creation with duplicate handling strategies and custom aliases
 */

export interface CreateUrlRequest {
    longUrl: string
    customAlias?: string
    userId?: number
    expiryDays?: number
}

export interface CreateUrlResponse {
    shortCode: string
    longUrl: string
    shortUrl: string
    isCustomAlias: boolean
    expiresAt?: Date
    wasReused: boolean
    userId?: number
}

export interface UrlCreationError {
    code: string
    message: string
    details?: any
}

export class URLShortenerService {
    private urlRepository: URLRepository
    private userRepository: UserRepository
    private idGenerator: IDGenerator
    private aliasChecker: AliasChecker
    private cacheService: URLCacheService
    private readonly baseUrl: string
    private readonly maxRetries: number = 3
    private readonly defaultIdLength: number = 7

    constructor(
        urlRepository: URLRepository,
        userRepository: UserRepository,
        idGenerator: IDGenerator,
        cacheService?: URLCacheService
    ) {
        this.urlRepository = urlRepository
        this.userRepository = userRepository
        this.idGenerator = idGenerator
        this.aliasChecker = new AliasChecker(urlRepository)
        this.cacheService = cacheService || new URLCacheService()
        this.baseUrl = process.env.BASE_URL || "https://short.ly"
    }

    /**
     * Create a shortened URL with duplicate handling
     */
    async createShortUrl(
        request: CreateUrlRequest
    ): Promise<CreateUrlResponse> {
        const startTime = Date.now()

        // Add business context to current span
        addBusinessContext({
            operation: "create_short_url",
            userId: request.userId
        })

        try {
            // Step 1: Validate the long URL
            const validation = await this.validateLongUrl(request.longUrl)
            const sanitizedUrl = validation.sanitizedUrl!
            const longUrlHash = this.generateUrlHash(sanitizedUrl)

            // Step 2: Get user preferences if user is provided
            let duplicateStrategy: string = "generate_new"
            let defaultExpiryDays: number | null = null

            if (request.userId) {
                const userPreferences = await this.getUserPreferences(
                    request.userId
                )
                duplicateStrategy = userPreferences.duplicateStrategy
                defaultExpiryDays = userPreferences.defaultExpiryDays!
            }

            // Step 3: Handle custom alias if provided
            if (request.customAlias) {
                const result = await this.createWithCustomAlias(
                    sanitizedUrl,
                    longUrlHash,
                    request.customAlias,
                    request.userId,
                    request.expiryDays ?? defaultExpiryDays
                )
                this.recordMetrics("custom_alias", "success", startTime)
                return result
            }

            // Step 4: Handle duplicate strategy
            if (duplicateStrategy === "reuse_existing") {
                const existingUrl = await this.findExistingUrl(
                    longUrlHash,
                    request.userId
                )
                if (existingUrl) {
                    logger.info("Reusing existing URL mapping", {
                        shortCode: existingUrl.short_code,
                        userId: request.userId
                    })
                    this.recordMetrics("reuse_existing", "success", startTime)
                    return this.buildResponse(existingUrl, true)
                }
            }

            // Step 5: Generate new short URL
            const result = await this.createNewShortUrl(
                sanitizedUrl,
                longUrlHash,
                request.userId,
                request.expiryDays ?? defaultExpiryDays
            )

            this.recordMetrics("generate_new", "success", startTime)
            return result
        } catch (error) {
            this.handleCreationError(error, request, startTime)
            throw error // TypeScript will infer this never executes due to handleCreationError throwing
        }
    }

    /**
     * Validate long URL
     */
    private async validateLongUrl(longUrl: string): Promise<ValidationResult> {
        const validationSpan = createChildSpan("url.validate", {
            "url_shortener.url_length": longUrl.length
        })

        try {
            const validation = URLValidator.validateUrl(longUrl)

            if (!validation.isValid) {
                validationSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: validation.error || "Invalid URL format"
                })
                throw this.createError(
                    "INVALID_URL",
                    validation.error || "Invalid URL format"
                )
            }

            validationSpan.setStatus({ code: SpanStatusCode.OK })
            return validation
        } finally {
            validationSpan.end()
        }
    }

    /**
     * Get user preferences
     */
    private async getUserPreferences(userId?: number): Promise<{
        duplicateStrategy: "generate_new" | "reuse_existing"
        defaultExpiryDays: number | null
    }> {
        if (!userId) {
            return {
                duplicateStrategy: "generate_new",
                defaultExpiryDays: null
            }
        }

        const user: any = await this.userRepository.findById(userId)
        if (!user) {
            throw this.createError("USER_NOT_FOUND", "User not found")
        }

        return {
            duplicateStrategy: user.duplicate_strategy,
            defaultExpiryDays: user.default_expiry_days
        }
    }

    /**
     * Create URL with custom alias
     */
    private async createWithCustomAlias(
        sanitizedUrl: string,
        longUrlHash: string,
        customAlias: string,
        userId?: number,
        expiryDays?: number | null
    ): Promise<CreateUrlResponse> {
        // Validate custom alias format
        const aliasValidation = URLValidator.validateCustomAlias(customAlias)
        if (!aliasValidation.isValid) {
            throw this.createError(
                "INVALID_ALIAS",
                aliasValidation.error || "Invalid custom alias"
            )
        }

        const sanitizedAlias = aliasValidation.sanitizedAlias!

        // Check alias availability
        const availability = await this.aliasChecker.checkAvailability(
            sanitizedAlias
        )
        if (!availability.isAvailable) {
            throw this.createError(
                "ALIAS_TAKEN",
                "Custom alias is already taken",
                {
                    suggestions: availability.suggestions
                }
            )
        }

        // Create URL mapping with custom alias
        const urlMapping = await this.createUrlMapping({
            short_code: sanitizedAlias,
            long_url: sanitizedUrl,
            long_url_hash: longUrlHash,
            user_id: userId,
            expires_at: this.calculateExpiryDate(expiryDays),
            is_custom_alias: true
        })

        logger.info("Created URL with custom alias", {
            shortCode: sanitizedAlias,
            userId
        })

        return this.buildResponse(urlMapping, false)
    }

    /**
     * Check alias availability
     */
    async isAliasAvailable(
        customAlias: string,
        userId?: number
    ): Promise<AliasAvailabilityResult> {
        // Validate custom alias format
        const aliasValidation = URLValidator.validateCustomAlias(customAlias)
        if (!aliasValidation.isValid) {
            throw this.createError(
                "INVALID_ALIAS",
                aliasValidation.error || "Invalid custom alias"
            )
        }

        const sanitizedAlias = aliasValidation.sanitizedAlias!

        // Check alias availability
        const availability = await this.aliasChecker.checkAvailability(
            sanitizedAlias
        )

        logger.info("Checked alias availability", {
            shortCode: sanitizedAlias,
            userId
        })

        return availability
    }

    /**
     * Create new short URL with generated code
     */
    private async createNewShortUrl(
        sanitizedUrl: string,
        longUrlHash: string,
        userId?: number,
        expiryDays?: number | null
    ): Promise<CreateUrlResponse> {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                // Generate unique short code
                const generatedId = await this.idGenerator.generateID({
                    minLength: this.defaultIdLength,
                    maxRetries: 3
                })

                // Verify uniqueness (extra safety check)
                const exists = await this.urlRepository.exists(generatedId.id)
                if (exists) {
                    logger.warn("Generated ID collision detected", {
                        shortCode: generatedId.id,
                        attempt,
                        method: generatedId.method
                    })
                    continue
                }

                // Create URL mapping
                const urlMapping = await this.createUrlMapping({
                    short_code: generatedId.id,
                    long_url: sanitizedUrl,
                    long_url_hash: longUrlHash,
                    user_id: userId,
                    expires_at: this.calculateExpiryDate(expiryDays),
                    is_custom_alias: false
                })

                logger.info("Created new short URL", {
                    shortCode: generatedId.id,
                    userId,
                    method: generatedId.method,
                    attempts: generatedId.attempts
                })

                return this.buildResponse(urlMapping, false)
            } catch (error) {
                if (attempt === this.maxRetries) {
                    throw this.createError(
                        "GENERATION_FAILED",
                        `Failed to generate unique short code after ${this.maxRetries} attempts`,
                        {
                            lastError:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown"
                        }
                    )
                }
                logger.warn("Failed to create short URL", {
                    attempt,
                    error:
                        error instanceof Error ? error.message : "Unknown error"
                })
            }
        }

        // This should never be reached due to the throw in the loop
        throw this.createError(
            "GENERATION_FAILED",
            "Unexpected failure in URL generation"
        )
    }

    /**
     * Find existing URL mapping for reuse strategy
     */
    private async findExistingUrl(
        longUrlHash: string,
        userId?: number
    ): Promise<URLMapping | null> {
        try {
            return await this.urlRepository.findByLongUrlHash(
                longUrlHash,
                userId
            )
        } catch (error) {
            logger.warn("Failed to find existing URL for reuse", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return null
        }
    }

    /**
     * Create URL mapping in database with write-through caching
     */
    private async createUrlMapping(
        input: CreateURLMappingInput
    ): Promise<URLMapping> {
        try {
            const urlMapping = await this.urlRepository.create(input)
            await this.cacheUrlMappingSafe(urlMapping)
            return urlMapping
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("duplicate key")
            ) {
                throw this.createError(
                    "DUPLICATE_CODE",
                    "Short code already exists"
                )
            }
            throw error
        }
    }

    /**
     * Cache URL mapping with graceful failure handling
     */
    private async cacheUrlMappingSafe(
        urlMapping: URLMapping,
        options: CacheOptions = {}
    ): Promise<void> {
        try {
            await this.cacheService.cacheUrlMapping(urlMapping, options)
        } catch (error) {
            logger.warn("Failed to cache URL mapping", {
                shortCode: urlMapping.short_code,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Generate hash for long URL
     */
    private generateUrlHash(url: string): string {
        return crypto.createHash("sha256").update(url).digest("hex")
    }

    /**
     * Calculate expiry date
     */
    private calculateExpiryDate(expiryDays?: number | null): Date | undefined {
        if (!expiryDays || expiryDays <= 0) {
            return undefined
        }

        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + expiryDays)
        return expiryDate
    }

    /**
     * Build response object
     */
    private buildResponse(
        urlMapping: URLMapping,
        wasReused: boolean
    ): CreateUrlResponse {
        return {
            shortCode: urlMapping.short_code,
            longUrl: urlMapping.long_url,
            shortUrl: `${this.baseUrl}/${urlMapping.short_code}`,
            isCustomAlias: urlMapping.is_custom_alias,
            expiresAt: urlMapping.expires_at || undefined,
            wasReused,
            userId: urlMapping.user_id || undefined
        }
    }

    /**
     * Create standardized error
     */
    private createError(
        code: string,
        message: string,
        details?: any
    ): Error & { code: string } {
        const error = new Error(message) as Error & {
            code: string
            details?: any
        }
        error.code = code
        if (details) {
            error.details = details
        }
        return error
    }

    /**
     * Record metrics
     */
    private recordMetrics(
        operation: string,
        status: "success" | "error",
        startTime: number
    ): void {
        const duration = Date.now() - startTime
        metricsService.recordUrlCreation(operation, status, duration)
    }

    /**
     * Handle creation errors
     */
    private handleCreationError(
        error: unknown,
        request: CreateUrlRequest,
        startTime: number
    ): never {
        const duration = Date.now() - startTime

        if (error instanceof Error && "code" in error) {
            metricsService.recordUrlCreation("known_error", "error", duration)
            metricsService.recordError(
                "url_creation_error",
                "url_shortener_service"
            )
            throw error
        }

        metricsService.recordUrlCreation("unknown_error", "error", duration)
        metricsService.recordError(
            "url_creation_unknown_error",
            "url_shortener_service"
        )

        logger.error("Failed to create short URL", {
            longUrl: request.longUrl?.substring(0, 100),
            userId: request.userId,
            customAlias: request.customAlias,
            error: error instanceof Error ? error.message : "Unknown error"
        })

        throw this.createError("CREATION_FAILED", "Failed to create short URL")
    }

    /**
     * Get URL information by short code (with cache lookup)
     */
    async getUrlInfo(shortCode: string): Promise<URLMapping | null> {
        try {
            // Try cache first
            const cached = await this.cacheService.getCachedUrlMapping(
                shortCode
            )
            if (cached) {
                return cached
            }

            // Fall back to database
            const urlMapping = await this.urlRepository.findById(shortCode)
            if (urlMapping) {
                await this.cacheUrlMappingSafe(urlMapping)
            }

            return urlMapping
        } catch (error) {
            logger.error("Failed to get URL info", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return null
        }
    }

    /**
     * Check if custom alias is available
     */
    async checkAliasAvailability(
        alias: string
    ): Promise<AliasAvailabilityResult> {
        const validation = URLValidator.validateCustomAlias(alias)
        if (!validation.isValid) {
            return {
                isAvailable: false,
                error: validation.error
            }
        }

        return await this.aliasChecker.checkAvailability(
            validation.sanitizedAlias!
        )
    }

    /**
     * Validate URL without creating it
     */
    validateUrl(url: string): ValidationResult {
        return URLValidator.validateUrl(url)
    }

    /**
     * Bulk create URLs
     */
    async bulkCreateUrls(
        requests: CreateUrlRequest[]
    ): Promise<Array<CreateUrlResponse | { error: UrlCreationError }>> {
        const results: Array<CreateUrlResponse | { error: UrlCreationError }> =
            []
        const batchSize = 10

        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize)

            const batchPromises = batch.map(async (request) => {
                try {
                    return await this.createShortUrl(request)
                } catch (error) {
                    const urlError = error as Error & {
                        code?: string
                        details?: any
                    }
                    return {
                        error: {
                            code: urlError.code || "UNKNOWN_ERROR",
                            message: urlError.message,
                            details: urlError.details
                        }
                    }
                }
            })

            const batchResults = await Promise.allSettled(batchPromises)

            batchResults.forEach((result) => {
                if (result.status === "fulfilled") {
                    results.push(result.value)
                } else {
                    results.push({
                        error: {
                            code: "BATCH_ERROR",
                            message:
                                result.reason?.message ||
                                "Batch processing failed"
                        }
                    })
                }
            })
        }

        logger.info("Bulk URL creation completed", {
            totalRequests: requests.length,
            successCount: results.filter((r) => !("error" in r)).length,
            errorCount: results.filter((r) => "error" in r).length
        })

        return results
    }

    /**
     * Update URL access count with cache update
     */
    async incrementUrlAccess(shortCode: string): Promise<void> {
        try {
            await this.urlRepository.incrementAccessCount(shortCode)
            await this.cacheService.updateCachedUrlMapping(shortCode, {
                last_accessed_at: new Date()
            })
        } catch (error) {
            logger.error("Failed to increment URL access", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Delete URL with cache invalidation
     */
    async deleteUrl(shortCode: string): Promise<boolean> {
        try {
            const deleted = await this.urlRepository.delete(shortCode)
            if (deleted) {
                await this.cacheService.removeCachedUrlMapping(shortCode)
            }
            return deleted
        } catch (error) {
            logger.error("Failed to delete URL", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return false
        }
    }

    /**
     * Warm up cache with popular URLs
     */
    async warmUpCache(urlMappings: URLMapping[]): Promise<void> {
        await this.cacheService.warmUpCache(urlMappings)
    }

    /**
     * Check cache health
     */
    async checkCacheHealth(): Promise<boolean> {
        return await this.cacheService.healthCheck()
    }

    /**
     * Clear URL cache
     */
    async clearCache(): Promise<void> {
        await this.cacheService.clearCache()
    }
}
