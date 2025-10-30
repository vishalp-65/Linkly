import { Request, Response, NextFunction } from "express"
import { URLShortenerService } from "../services/urlShortenerService"
import { URLRepository } from "../repositories/URLRepository"
import { IDGenerator } from "../services/idGenerator"
import { URLCacheService } from "../services/urlCacheService"
import { ApiError } from "../utils/ApiError"
import { ApiResponse } from "../utils/ApiResponse"
import { logger } from "../config/logger"
import { UserRepository } from "../repositories"

export class UrlController {
    private urlShortenerService: URLShortenerService
    private urlRepository: URLRepository
    private cacheService: URLCacheService

    constructor() {
        const urlRepository = new URLRepository()
        const userRepository = new UserRepository()
        const idGenerator = IDGenerator.getInstance()
        this.cacheService = new URLCacheService()

        this.urlShortenerService = new URLShortenerService(
            urlRepository,
            userRepository,
            idGenerator,
            this.cacheService
        )

        this.urlRepository = urlRepository
    }

    // Helper method to consistently extract userId
    private getUserId(req: Request): number | undefined {
        // Check multiple possible locations where auth middleware might set userId
        const userId =
            (req as any).userId ||
            (req as any).user?.userId ||
            (req as any).user?.id

        logger.debug("Extracting userId from request", {
            userId,
            hasUserId: !!(req as any).userId,
            hasUser: !!(req as any).user,
            userObject: (req as any).user
        })

        return userId
    }

    createShortUrl = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()

        try {
            const { url, customAlias, expiryDays } = req.body
            const userId = this.getUserId(req)

            // Validate required field
            if (!url) {
                throw ApiError.badRequest("URL is required", "MISSING_URL")
            }

            logger.info("Creating short URL", {
                userId,
                hasCustomAlias: !!customAlias,
                url: url.substring(0, 100)
            })

            const result = await this.urlShortenerService.createShortUrl({
                longUrl: url,
                customAlias,
                userId,
                expiryDays
            })

            const responseTime = Date.now() - startTime

            logger.info("URL shortened successfully", {
                shortCode: result.shortCode,
                userId,
                customAlias: result.isCustomAlias,
                wasReused: result.wasReused,
                responseTime
            })

            ApiResponse.created(
                res,
                {
                    short_code: result.shortCode,
                    short_url: result.shortUrl,
                    long_url: result.longUrl,
                    is_custom_alias: result.isCustomAlias,
                    expires_at: result.expiresAt,
                    was_reused: result.wasReused,
                    created_at: new Date().toISOString()
                },
                { responseTime }
            )
        } catch (error: any) {
            const responseTime = Date.now() - startTime

            if (error.code) {
                const errorMap: Record<
                    string,
                    { status: number; message?: string }
                > = {
                    INVALID_URL: { status: 400 },
                    INVALID_ALIAS: { status: 400 },
                    ALIAS_TAKEN: {
                        status: 409,
                        message: "Custom alias is already taken"
                    },
                    USER_NOT_FOUND: { status: 404, message: "User not found" },
                    GENERATION_FAILED: {
                        status: 503,
                        message: "Unable to generate unique short code"
                    }
                }

                const errorInfo = errorMap[error.code] || {
                    status: 500,
                    message: "Failed to create short URL"
                }

                logger.error("URL shortening failed", {
                    error: error.code,
                    message: error.message,
                    responseTime
                })

                next(
                    new ApiError(
                        errorInfo.status,
                        error.code,
                        errorInfo.message || error.message,
                        error.details
                    )
                )
                return
            }

            logger.error("Unexpected error during URL shortening", {
                error: error.message,
                stack: error.stack,
                responseTime
            })

            next(ApiError.internal())
        }
    }

    getAllUrl = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()
        const userId = this.getUserId(req)

        try {
            logger.info("getAllUrl called", {
                userId,
                query: req.query
            })

            if (!userId) {
                throw ApiError.unauthorized(
                    "Authentication is required to view URLs"
                )
            }

            // Extract and parse query parameters
            const {
                search,
                page = 1,
                pageSize = 20,
                sortBy = "created_at",
                sortOrder = "desc",
                isCustomAlias,
                hasExpiry,
                isExpired,
                dateFrom,
                dateTo,
                minAccessCount,
                maxAccessCount
            } = req.query

            // Build filters object
            const filters: any = {}

            if (search) {
                filters.search = search as string
            }

            if (isCustomAlias !== undefined) {
                filters.is_custom_alias = isCustomAlias === "true"
            }

            if (hasExpiry !== undefined) {
                filters.has_expiry = hasExpiry === "true"
            }

            if (isExpired !== undefined) {
                filters.is_expired = isExpired === "true"
            }

            if (dateFrom) {
                filters.date_from = new Date(dateFrom as string)
            }

            if (dateTo) {
                filters.date_to = new Date(dateTo as string)
            }

            if (minAccessCount !== undefined) {
                filters.min_access_count = parseInt(minAccessCount as string)
            }

            if (maxAccessCount !== undefined) {
                filters.max_access_count = parseInt(maxAccessCount as string)
            }

            // Add sorting
            filters.sort_by = sortBy as string
            filters.sort_order = (sortOrder as string).toUpperCase()

            logger.info("Fetching URLs for user with filters", {
                userId,
                filters,
                page: parseInt(page as string),
                pageSize: parseInt(pageSize as string)
            })

            const urlMappings = await this.urlRepository.findByUser(
                userId,
                filters,
                parseInt(page as string),
                parseInt(pageSize as string)
            )

            const responseTime = Date.now() - startTime

            logger.info("URLs retrieved successfully", {
                userId,
                page,
                pageSize,
                count: urlMappings.data.length,
                totalItems: urlMappings.pagination.totalItems,
                filters: Object.keys(filters),
                responseTime
            })

            ApiResponse.success(res, urlMappings, 200, { responseTime })
        } catch (error) {
            const responseTime = Date.now() - startTime

            logger.error("Failed to retrieve URLs", {
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                responseTime
            })

            next(error)
        }
    }

    deleteUrl = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()
        const { shortCode } = req.params
        const userId = this.getUserId(req)

        try {
            if (!userId) {
                throw ApiError.unauthorized(
                    "Authentication is required to delete URLs"
                )
            }

            if (!shortCode) {
                throw ApiError.badRequest(
                    "Short code is required",
                    "MISSING_SHORT_CODE"
                )
            }

            const urlMapping = await this.urlRepository.findById(shortCode)

            if (!urlMapping || urlMapping.is_deleted) {
                throw ApiError.notFound(
                    "The specified short URL does not exist",
                    "URL_NOT_FOUND"
                )
            }

            if (urlMapping.user_id !== userId) {
                logger.warn("Unauthorized URL deletion attempt", {
                    shortCode,
                    requestingUserId: userId,
                    ownerUserId: urlMapping.user_id,
                    ip: req.ip
                })
                throw ApiError.forbidden(
                    "You do not have permission to delete this URL"
                )
            }

            const deleted = await this.urlRepository.delete(shortCode)

            if (!deleted) {
                throw ApiError.internal("Failed to delete the URL")
            }

            // Send webhook notification
            try {
                await this.urlShortenerService.sendUrlDeletedNotification(userId, shortCode)
            } catch (notificationError) {
                logger.warn("Failed to send delete notification", {
                    shortCode,
                    error:
                        notificationError instanceof Error
                            ? notificationError.message
                            : "Unknown error"
                })
            }

            // Invalidate cache
            try {
                await this.cacheService.removeCachedUrlMapping(shortCode)
            } catch (cacheError) {
                logger.warn("Failed to invalidate cache after URL deletion", {
                    shortCode,
                    error:
                        cacheError instanceof Error
                            ? cacheError.message
                            : "Unknown error"
                })
            }

            const responseTime = Date.now() - startTime

            logger.info("URL deleted successfully", {
                shortCode,
                userId,
                responseTime
            })

            ApiResponse.success(
                res,
                {
                    shortCode,
                    deletedAt: new Date().toISOString()
                },
                200,
                { responseTime }
            )
        } catch (error) {
            const responseTime = Date.now() - startTime

            logger.error("Failed to delete URL", {
                shortCode,
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime
            })

            next(error)
        }
    }

    resolveUrl = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()

        try {
            const { shortCode } = req.params

            if (!shortCode) {
                throw ApiError.badRequest(
                    "Short code is required",
                    "MISSING_SHORT_CODE"
                )
            }

            const redirectService = (this.urlShortenerService as any)
                .redirectService

            if (!redirectService) {
                throw ApiError.internal("Redirect service not available")
            }

            const result = await redirectService.resolveUrl(shortCode)

            const responseTime = Date.now() - startTime

            const responseMap: Record<
                string,
                { status: number; response: any }
            > = {
                found: {
                    status: 200,
                    response: {
                        success: true,
                        shortCode,
                        longUrl: result.urlMapping!.long_url,
                        createdAt: result.urlMapping!.created_at,
                        expiresAt: result.urlMapping!.expires_at,
                        accessCount: result.urlMapping!.access_count,
                        lastAccessedAt: result.urlMapping!.last_accessed_at,
                        latency: result.latency
                    }
                },
                not_found: {
                    status: 404,
                    response: ApiError.notFound(
                        "The requested short URL does not exist"
                    )
                },
                expired: {
                    status: 410,
                    response: ApiError.gone(
                        "The requested short URL has expired"
                    )
                },
                deleted: {
                    status: 404,
                    response: ApiError.notFound(
                        "The requested short URL does not exist"
                    )
                }
            }

            const mapped = responseMap[result.status] || {
                status: 500,
                response: ApiError.internal()
            }

            logger.info("URL resolved", {
                shortCode,
                status: result.status,
                responseTime
            })

            if (mapped.status === 200) {
                ApiResponse.success(res, mapped.response)
            } else {
                next(mapped.response)
            }
        } catch (error) {
            const responseTime = Date.now() - startTime

            logger.error("Failed to resolve URL", {
                shortCode: req.params.shortCode,
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime
            })

            next(error)
        }
    }

    checkAliasAvailability = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()
        const alias = req.query.alias as string

        try {
            if (!alias) {
                throw ApiError.badRequest(
                    "Alias query parameter is required",
                    "MISSING_ALIAS"
                )
            }

            const isAvailable = await this.urlShortenerService.isAliasAvailable(
                alias
            )

            ApiResponse.success(res, isAvailable, 200)
        } catch (error) {
            const responseTime = Date.now() - startTime
            logger.error("Failed to resolve URL", {
                shortCode: req.params.shortCode,
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime
            })

            next(error)
        }
    }

    getUrlStats = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()
        const { shortCode } = req.params
        const userId = this.getUserId(req)

        try {
            if (!userId) {
                throw ApiError.unauthorized(
                    "Authentication is required to view URL stats"
                )
            }

            if (!shortCode) {
                throw ApiError.badRequest(
                    "Short code is required",
                    "MISSING_SHORT_CODE"
                )
            }

            const urlMapping = await this.urlRepository.findById(shortCode)

            if (!urlMapping || urlMapping.is_deleted) {
                throw ApiError.notFound(
                    "The specified short URL does not exist",
                    "URL_NOT_FOUND"
                )
            }

            if (urlMapping.user_id !== userId) {
                throw ApiError.forbidden(
                    "You do not have permission to view this URL stats"
                )
            }

            const stats = await this.urlRepository.getUrlStats(shortCode)

            const responseTime = Date.now() - startTime

            logger.info("URL stats retrieved", {
                shortCode,
                userId,
                responseTime
            })

            ApiResponse.success(res, stats, 200, { responseTime })
        } catch (error) {
            const responseTime = Date.now() - startTime

            logger.error("Failed to get URL stats", {
                shortCode,
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime
            })

            next(error)
        }
    }
}
