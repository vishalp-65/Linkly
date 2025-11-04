import crypto from 'crypto';
import { URLRepository } from '../repositories/URLRepository';
import { UserRepository } from '../repositories/UserRepository';
import { IDGenerator } from './idGenerator';
import { URLValidator, ValidationResult } from './urlValidator';
import { AliasChecker, AliasAvailabilityResult } from './aliasChecker';
import { URLCacheService, CacheOptions } from './urlCacheService';
import { logger } from '../config/logger';
import { metricsService } from './metricsService';
import { tracingService } from './tracingService';
import { addBusinessContext, createChildSpan } from '../middleware/tracingMiddleware';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { URLMapping, CreateURLMappingInput, User } from '../types/database';

/**
 * URL Shortening Service
 * Handles URL creation with duplicate handling strategies and custom aliases
 */

export interface CreateUrlRequest {
    longUrl: string;
    customAlias?: string;
    userId?: number;
    expiryDays?: number;
}

export interface CreateUrlResponse {
    shortCode: string;
    longUrl: string;
    shortUrl: string;
    isCustomAlias: boolean;
    expiresAt?: Date;
    wasReused: boolean;
    userId?: number;
}

export interface UrlCreationError {
    code: string;
    message: string;
    details?: any;
}

export class URLShortenerService {
    private urlRepository: URLRepository;
    private userRepository: UserRepository;
    private idGenerator: IDGenerator;
    private aliasChecker: AliasChecker;
    private cacheService: URLCacheService;

    constructor(
        urlRepository: URLRepository,
        userRepository: UserRepository,
        idGenerator: IDGenerator,
        cacheService?: URLCacheService
    ) {
        this.urlRepository = urlRepository;
        this.userRepository = userRepository;
        this.idGenerator = idGenerator;
        this.aliasChecker = new AliasChecker(urlRepository);
        this.cacheService = cacheService || new URLCacheService();
    }

    /**
     * Create a shortened URL with duplicate handling
     */
    async createShortUrl(request: CreateUrlRequest): Promise<CreateUrlResponse> {
        const startTime = Date.now();

        // Add business context to current span
        addBusinessContext({
            operation: 'create_short_url',
            userId: request.userId,
        });

        try {
            // Step 1: Validate the long URL
            const validationSpan = createChildSpan('url.validate', {
                'url_shortener.url_length': request.longUrl.length,
                'url_shortener.has_custom_alias': !!request.customAlias,
            });

            const validation = URLValidator.validateUrl(request.longUrl);

            if (!validation.isValid) {
                validationSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: validation.error || 'Invalid URL format',
                });
                validationSpan.end();

                const duration = Date.now() - startTime;
                metricsService.recordUrlCreation('validation_failed', 'error', duration);
                throw this.createError('INVALID_URL', validation.error || 'Invalid URL format');
            }

            validationSpan.setStatus({ code: SpanStatusCode.OK });
            validationSpan.end();

            const sanitizedUrl = validation.sanitizedUrl!;
            const longUrlHash = this.generateUrlHash(sanitizedUrl);

            // Step 2: Get user preferences if user is provided
            let user: User | null = null;
            let duplicateStrategy: 'generate_new' | 'reuse_existing' = 'generate_new';
            let defaultExpiryDays: number | null = null;

            if (request.userId) {
                user = await this.userRepository.findById(request.userId);
                if (!user) {
                    throw this.createError('USER_NOT_FOUND', 'User not found');
                }
                duplicateStrategy = user.duplicate_strategy;
                defaultExpiryDays = user.default_expiry_days;
            }

            // Step 3: Handle custom alias if provided
            if (request.customAlias) {
                return await this.createWithCustomAlias(
                    sanitizedUrl,
                    longUrlHash,
                    request.customAlias,
                    request.userId,
                    request.expiryDays || defaultExpiryDays
                );
            }

            // Step 4: Handle duplicate strategy
            if (duplicateStrategy === 'reuse_existing') {
                const existingUrl = await this.findExistingUrl(longUrlHash, request.userId);
                if (existingUrl) {
                    logger.info('Reusing existing URL mapping', {
                        shortCode: existingUrl.short_code,
                        userId: request.userId,
                        longUrlHash,
                    });

                    const duration = Date.now() - startTime;
                    metricsService.recordUrlCreation('reuse_existing', 'success', duration);
                    return this.buildResponse(existingUrl, true);
                }
            }

            // Step 5: Generate new short URL
            return await this.createNewShortUrl(
                sanitizedUrl,
                longUrlHash,
                request.userId,
                request.expiryDays || defaultExpiryDays
            );

        } catch (error) {
            const duration = Date.now() - startTime;

            if (error instanceof Error && 'code' in error) {
                // Record metrics for known errors
                metricsService.recordUrlCreation('known_error', 'error', duration);
                metricsService.recordError('url_creation_error', 'url_shortener_service');
                throw error; // Re-throw our custom errors
            }

            // Record metrics for unknown errors
            metricsService.recordUrlCreation('unknown_error', 'error', duration);
            metricsService.recordError('url_creation_unknown_error', 'url_shortener_service');

            logger.error('Failed to create short URL', {
                longUrl: request.longUrl.substring(0, 100), // Log only first 100 chars
                userId: request.userId,
                customAlias: request.customAlias,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw this.createError('CREATION_FAILED', 'Failed to create short URL');
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
        const aliasValidation = URLValidator.validateCustomAlias(customAlias);
        if (!aliasValidation.isValid) {
            throw this.createError('INVALID_ALIAS', aliasValidation.error || 'Invalid custom alias');
        }

        const sanitizedAlias = aliasValidation.sanitizedAlias!;

        // Check alias availability
        const availability = await this.aliasChecker.checkAvailability(sanitizedAlias);
        if (!availability.isAvailable) {
            throw this.createError('ALIAS_TAKEN', 'Custom alias is already taken', {
                suggestions: availability.suggestions,
            });
        }

        // Create URL mapping with custom alias
        const urlMapping = await this.createUrlMapping({
            short_code: sanitizedAlias,
            long_url: sanitizedUrl,
            long_url_hash: longUrlHash,
            user_id: userId,
            expires_at: this.calculateExpiryDate(expiryDays),
            is_custom_alias: true,
        });

        logger.info('Created URL with custom alias', {
            shortCode: sanitizedAlias,
            userId,
            longUrlHash,
        });

        // Note: Duration tracking is handled in the main createShortUrl method
        return this.buildResponse(urlMapping, false);
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
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Generate unique short code
                const generatedId = await this.idGenerator.generateID({
                    minLength: 7,
                    maxRetries: 3,
                });

                // Verify uniqueness (extra safety check)
                const exists = await this.urlRepository.exists(generatedId.id);
                if (exists) {
                    logger.warn('Generated ID collision detected', {
                        shortCode: generatedId.id,
                        attempt,
                        method: generatedId.method,
                    });
                    continue; // Try again
                }

                // Create URL mapping
                const urlMapping = await this.createUrlMapping({
                    short_code: generatedId.id,
                    long_url: sanitizedUrl,
                    long_url_hash: longUrlHash,
                    user_id: userId,
                    expires_at: this.calculateExpiryDate(expiryDays),
                    is_custom_alias: false,
                });

                logger.info('Created new short URL', {
                    shortCode: generatedId.id,
                    userId,
                    method: generatedId.method,
                    attempts: generatedId.attempts,
                    longUrlHash,
                });

                // Note: Duration tracking is handled in the main createShortUrl method
                return this.buildResponse(urlMapping, false);

            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unknown error');
                logger.warn('Failed to create short URL', {
                    attempt,
                    error: lastError.message,
                });

                if (attempt === maxRetries) {
                    break;
                }
            }
        }

        throw this.createError(
            'GENERATION_FAILED',
            `Failed to generate unique short code after ${maxRetries} attempts`,
            { lastError: lastError?.message }
        );
    }

    /**
     * Find existing URL mapping for reuse strategy
     */
    private async findExistingUrl(longUrlHash: string, userId?: number): Promise<URLMapping | null> {
        try {
            return await this.urlRepository.findByLongUrlHash(longUrlHash, userId);
        } catch (error) {
            logger.warn('Failed to find existing URL for reuse', {
                longUrlHash,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null; // Fall back to creating new URL
        }
    }

    /**
     * Create URL mapping in database with write-through caching
     */
    private async createUrlMapping(input: CreateURLMappingInput): Promise<URLMapping> {
        try {
            // Create in database first
            const urlMapping = await this.urlRepository.create(input);

            // Write-through to cache immediately after successful database insert
            await this.cacheUrlMappingWithGracefulFailure(urlMapping);

            return urlMapping;
        } catch (error) {
            // Handle duplicate key errors (race condition)
            if (error instanceof Error && error.message.includes('duplicate key')) {
                throw this.createError('DUPLICATE_CODE', 'Short code already exists');
            }
            throw error;
        }
    }

    /**
     * Cache URL mapping with graceful failure handling
     */
    private async cacheUrlMappingWithGracefulFailure(
        urlMapping: URLMapping,
        options: CacheOptions = {}
    ): Promise<void> {
        try {
            await this.cacheService.cacheUrlMapping(urlMapping, options);
        } catch (error) {
            // Log cache failure but don't throw - cache failures should not break URL creation
            logger.warn('Failed to cache URL mapping after creation', {
                shortCode: urlMapping.short_code,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Generate hash for long URL (for duplicate detection)
     */
    private generateUrlHash(url: string): string {
        return crypto.createHash('sha256').update(url).digest('hex');
    }

    /**
     * Calculate expiry date based on days
     */
    private calculateExpiryDate(expiryDays?: number | null): Date | undefined {
        if (!expiryDays || expiryDays <= 0) {
            return undefined; // No expiry
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + expiryDays);
        return expiryDate;
    }

    /**
     * Build response object
     */
    private buildResponse(urlMapping: URLMapping, wasReused: boolean): CreateUrlResponse {
        // In a real application, this would use the actual domain from config
        const baseUrl = process.env.BASE_URL || 'https://short.ly';
        const shortUrl = `${baseUrl}/${urlMapping.short_code}`;

        return {
            shortCode: urlMapping.short_code,
            longUrl: urlMapping.long_url,
            shortUrl,
            isCustomAlias: urlMapping.is_custom_alias,
            expiresAt: urlMapping.expires_at || undefined,
            wasReused,
            userId: urlMapping.user_id || undefined,
        };
    }

    /**
     * Create standardized error
     */
    private createError(code: string, message: string, details?: any): Error & { code: string } {
        const error = new Error(message) as Error & { code: string; details?: any };
        error.code = code;
        if (details) {
            error.details = details;
        }
        return error;
    }

    /**
     * Get URL information by short code (with cache lookup)
     */
    async getUrlInfo(shortCode: string): Promise<URLMapping | null> {
        try {
            // Try cache first
            const cached = await this.cacheService.getCachedUrlMapping(shortCode);
            if (cached) {
                return cached;
            }

            // Fall back to database
            const urlMapping = await this.urlRepository.findById(shortCode);

            // Cache the result for future lookups
            if (urlMapping) {
                await this.cacheUrlMappingWithGracefulFailure(urlMapping);
            }

            return urlMapping;
        } catch (error) {
            logger.error('Failed to get URL info', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    /**
     * Check if custom alias is available
     */
    async checkAliasAvailability(alias: string): Promise<AliasAvailabilityResult> {
        // First validate the alias format
        const validation = URLValidator.validateCustomAlias(alias);
        if (!validation.isValid) {
            return {
                isAvailable: false,
                error: validation.error,
            };
        }

        // Check availability in database
        return await this.aliasChecker.checkAvailability(validation.sanitizedAlias!);
    }

    /**
     * Validate URL without creating it
     */
    validateUrl(url: string): ValidationResult {
        return URLValidator.validateUrl(url);
    }

    /**
     * Get user's duplicate strategy
     */
    async getUserDuplicateStrategy(userId: number): Promise<'generate_new' | 'reuse_existing' | null> {
        try {
            const user = await this.userRepository.findById(userId);
            return user?.duplicate_strategy || null;
        } catch (error) {
            logger.error('Failed to get user duplicate strategy', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    /**
     * Update user's duplicate strategy
     */
    async updateUserDuplicateStrategy(
        userId: number,
        strategy: 'generate_new' | 'reuse_existing'
    ): Promise<boolean> {
        try {
            const updatedUser = await this.userRepository.updatePreferences(userId, {
                duplicate_strategy: strategy,
            });
            return updatedUser !== null;
        } catch (error) {
            logger.error('Failed to update user duplicate strategy', {
                userId,
                strategy,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Bulk create URLs (for batch operations)
     */
    async bulkCreateUrls(
        requests: CreateUrlRequest[]
    ): Promise<Array<CreateUrlResponse | { error: UrlCreationError }>> {
        const results: Array<CreateUrlResponse | { error: UrlCreationError }> = [];

        // Process in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);

            const batchPromises = batch.map(async (request) => {
                try {
                    return await this.createShortUrl(request);
                } catch (error) {
                    const urlError = error as Error & { code?: string; details?: any };
                    return {
                        error: {
                            code: urlError.code || 'UNKNOWN_ERROR',
                            message: urlError.message,
                            details: urlError.details,
                        },
                    };
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach((result) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    results.push({
                        error: {
                            code: 'BATCH_ERROR',
                            message: result.reason?.message || 'Batch processing failed',
                        },
                    });
                }
            });
        }

        logger.info('Bulk URL creation completed', {
            totalRequests: requests.length,
            successCount: results.filter(r => !('error' in r)).length,
            errorCount: results.filter(r => 'error' in r).length,
        });

        return results;
    }

    /**
     * Update URL access count with cache update
     */
    async incrementUrlAccess(shortCode: string): Promise<void> {
        try {
            // Update database
            await this.urlRepository.incrementAccessCount(shortCode);

            // Update cache if entry exists
            await this.cacheService.updateCachedUrlMapping(shortCode, {
                last_accessed_at: new Date(),
                // Note: access_count increment is handled by the database
                // We could fetch the new count, but for performance we'll let cache expire
            });

        } catch (error) {
            logger.error('Failed to increment URL access', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - access count updates shouldn't break redirects
        }
    }

    /**
     * Delete URL with cache invalidation
     */
    async deleteUrl(shortCode: string): Promise<boolean> {
        try {
            // Delete from database
            const deleted = await this.urlRepository.delete(shortCode);

            if (deleted) {
                // Remove from cache
                await this.cacheService.removeCachedUrlMapping(shortCode);
            }

            return deleted;
        } catch (error) {
            logger.error('Failed to delete URL', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cacheService.getCacheStats();
    }

    /**
     * Warm up cache with popular URLs
     */
    async warmUpCache(urlMappings: URLMapping[]): Promise<void> {
        await this.cacheService.warmUpCache(urlMappings);
    }

    /**
     * Check cache health
     */
    async checkCacheHealth(): Promise<boolean> {
        return await this.cacheService.healthCheck();
    }

    /**
     * Clear URL cache (admin operation)
     */
    async clearCache(): Promise<void> {
        await this.cacheService.clearCache();
    }
}