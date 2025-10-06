import { Request, Response, NextFunction } from 'express';
import { URLShortenerService } from '../services/urlShortenerService';
import { URLRepository } from '../repositories/URLRepository';
import { UserRepository } from '../repositories/UserRepository';
import { IDGenerator } from '../services/idGenerator';
import { URLCacheService } from '../services/urlCacheService';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';

export class UrlController {
    private urlShortenerService: URLShortenerService;
    private urlRepository: URLRepository;
    private cacheService: URLCacheService;

    constructor() {
        const urlRepository = new URLRepository();
        const userRepository = new UserRepository();
        const idGenerator = IDGenerator.getInstance();
        this.cacheService = new URLCacheService();

        this.urlShortenerService = new URLShortenerService(
            urlRepository,
            userRepository,
            idGenerator,
            this.cacheService
        );

        this.urlRepository = urlRepository;
    }

    createShortUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const startTime = Date.now();

        try {
            const { url, customAlias, expiryDays } = req.body;
            const userId = (req as any).userId;

            const result = await this.urlShortenerService.createShortUrl({
                longUrl: url,
                customAlias,
                userId,
                expiryDays
            });

            const responseTime = Date.now() - startTime;

            logger.info('URL shortened successfully', {
                shortCode: result.shortCode,
                userId,
                customAlias: result.isCustomAlias,
                wasReused: result.wasReused,
                responseTime
            });

            ApiResponse.created(res, {
                shortCode: result.shortCode,
                shortUrl: result.shortUrl,
                longUrl: result.longUrl,
                isCustomAlias: result.isCustomAlias,
                expiresAt: result.expiresAt,
                wasReused: result.wasReused,
                createdAt: new Date().toISOString()
            }, { responseTime });

        } catch (error: any) {
            const responseTime = Date.now() - startTime;

            if (error.code) {
                const errorMap: Record<string, { status: number; message?: string }> = {
                    'INVALID_URL': { status: 400 },
                    'INVALID_ALIAS': { status: 400 },
                    'ALIAS_TAKEN': { status: 409, message: 'Custom alias is already taken' },
                    'USER_NOT_FOUND': { status: 404, message: 'User not found' },
                    'GENERATION_FAILED': { status: 503, message: 'Unable to generate unique short code' }
                };

                const errorInfo = errorMap[error.code] || { status: 500, message: 'Failed to create short URL' };

                logger.error('URL shortening failed', {
                    error: error.code,
                    message: error.message,
                    responseTime
                });

                next(new ApiError(errorInfo.status, error.code, errorInfo.message || error.message, error.details));
                return;
            }

            logger.error('Unexpected error during URL shortening', {
                error: error.message,
                stack: error.stack,
                responseTime
            });

            next(ApiError.internal());
        }
    };

    deleteUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const startTime = Date.now();
        const { shortCode } = req.params;
        const userId = (req as any).userId;

        try {
            if (!userId) {
                throw ApiError.unauthorized('Authentication is required to delete URLs');
            }

            const urlMapping = await this.urlRepository.findById(shortCode);

            if (!urlMapping || urlMapping.is_deleted) {
                throw ApiError.notFound('The specified short URL does not exist', 'URL_NOT_FOUND');
            }

            if (urlMapping.user_id !== userId) {
                logger.warn('Unauthorized URL deletion attempt', {
                    shortCode,
                    requestingUserId: userId,
                    ownerUserId: urlMapping.user_id,
                    ip: req.ip
                });
                throw ApiError.forbidden('You do not have permission to delete this URL');
            }

            const deleted = await this.urlRepository.delete(shortCode);

            if (!deleted) {
                throw ApiError.internal('Failed to delete the URL');
            }

            // Invalidate cache
            try {
                await this.cacheService.removeCachedUrlMapping(shortCode);
            } catch (cacheError) {
                logger.warn('Failed to invalidate cache after URL deletion', {
                    shortCode,
                    error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
                });
            }

            const responseTime = Date.now() - startTime;

            logger.info('URL deleted successfully', {
                shortCode,
                userId,
                responseTime
            });

            ApiResponse.success(res, {
                shortCode,
                deletedAt: new Date().toISOString()
            }, 200, { responseTime });

        } catch (error) {
            next(error);
        }
    };

    resolveUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { shortCode } = req.params;
            const redirectService = (this.urlShortenerService as any).redirectService;

            const result = await redirectService.resolveUrl(shortCode);

            const responseMap: Record<string, { status: number; response: any }> = {
                'found': {
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
                'not_found': {
                    status: 404,
                    response: ApiError.notFound('The requested short URL does not exist')
                },
                'expired': {
                    status: 410,
                    response: ApiError.gone('The requested short URL has expired')
                },
                'deleted': {
                    status: 404,
                    response: ApiError.notFound('The requested short URL does not exist')
                }
            };

            const mapped = responseMap[result.status] || {
                status: 500,
                response: ApiError.internal()
            };

            if (mapped.status === 200) {
                ApiResponse.success(res, mapped.response);
            } else {
                next(mapped.response);
            }

        } catch (error) {
            next(error);
        }
    };
}