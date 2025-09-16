import { Request, Response } from 'express';
import { URLMapping } from '../types/database';
import { MultiLayerCacheService } from './multiLayerCacheService';
import { URLRepository } from '../repositories/URLRepository';
import { analyticsEventProducer } from './analyticsEventProducer';
import { logger } from '../config/logger';

/**
 * URL Redirect Service
 * Handles URL redirects with expiry checking and access tracking
 */

export interface RedirectResult {
    success: boolean;
    statusCode: number;
    longUrl?: string;
    shortCode: string;
    error?: string;
    latency: number;
    cacheSource?: 'memory' | 'redis' | 'database' | 'not_found';
}

export interface RedirectStats {
    totalRedirects: number;
    successfulRedirects: number;
    notFoundErrors: number;
    expiredErrors: number;
    serverErrors: number;
    averageLatency: number;
    cacheHitRate: number;
}

export class URLRedirectService {
    private cacheService: MultiLayerCacheService;
    private urlRepository: URLRepository;
    private analyticsService: typeof analyticsEventProducer;
    private stats: RedirectStats;

    constructor() {
        this.cacheService = new MultiLayerCacheService();
        this.urlRepository = new URLRepository();
        this.analyticsService = analyticsEventProducer;
        this.stats = {
            totalRedirects: 0,
            successfulRedirects: 0,
            notFoundErrors: 0,
            expiredErrors: 0,
            serverErrors: 0,
            averageLatency: 0,
            cacheHitRate: 0,
        };

        logger.info('URL Redirect Service initialized');
    }

    /**
     * Handle URL redirect request
     */
    async handleRedirect(req: Request, res: Response, shortCode: string): Promise<RedirectResult> {
        const startTime = Date.now();
        this.stats.totalRedirects++;

        try {
            // Lookup URL mapping using multi-layer cache
            const lookupResult = await this.cacheService.lookupUrl(shortCode);
            const urlMapping = lookupResult.urlMapping;

            // URL not found
            if (!urlMapping) {
                this.stats.notFoundErrors++;
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);

                logger.info('URL not found', {
                    shortCode,
                    ip: this.getClientIP(req),
                    userAgent: req.get('User-Agent'),
                    latency,
                });

                res.status(404).json({
                    error: 'URL not found',
                    message: 'The requested short URL does not exist',
                    shortCode,
                });

                return {
                    success: false,
                    statusCode: 404,
                    shortCode,
                    error: 'URL not found',
                    latency,
                    cacheSource: lookupResult.source,
                };
            }

            // Check if URL is soft deleted
            if (urlMapping.is_deleted) {
                this.stats.notFoundErrors++;
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);

                logger.info('URL is deleted', {
                    shortCode,
                    deletedAt: urlMapping.deleted_at,
                    ip: this.getClientIP(req),
                    latency,
                });

                res.status(404).json({
                    error: 'URL not found',
                    message: 'The requested short URL does not exist',
                    shortCode,
                });

                return {
                    success: false,
                    statusCode: 404,
                    shortCode,
                    error: 'URL deleted',
                    latency,
                    cacheSource: lookupResult.source,
                };
            }

            // Check if URL has expired
            if (this.isExpired(urlMapping)) {
                this.stats.expiredErrors++;
                const latency = Date.now() - startTime;
                this.updateAverageLatency(latency);

                // Mark expired URL in cache to prevent repeated DB queries
                await this.markExpiredInCache(shortCode).catch(error => {
                    logger.warn('Failed to mark expired URL in cache', {
                        shortCode,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                });

                logger.info('URL has expired', {
                    shortCode,
                    expiresAt: urlMapping.expires_at,
                    ip: this.getClientIP(req),
                    latency,
                });

                res.status(410).json({
                    error: 'URL expired',
                    message: 'The requested short URL has expired',
                    shortCode,
                    expiresAt: urlMapping.expires_at,
                });

                return {
                    success: false,
                    statusCode: 410,
                    shortCode,
                    error: 'URL expired',
                    latency,
                    cacheSource: lookupResult.source,
                };
            }

            // Perform redirect
            const latency = Date.now() - startTime;
            this.stats.successfulRedirects++;
            this.updateAverageLatency(latency);
            this.updateCacheHitRate(lookupResult.source);

            // Update access tracking asynchronously (don't block redirect)
            this.updateAccessTracking(shortCode, urlMapping).catch(error => {
                logger.error('Failed to update access tracking', {
                    shortCode,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

            // Publish analytics event asynchronously (don't block redirect)
            // Extract analytics data from request
            const analyticsData = {
                short_code: shortCode,
                ip_address: req.ip || req.connection.remoteAddress,
                user_agent: req.get('User-Agent'),
                referrer: req.get('Referer'),
            };

            this.analyticsService.publishClickEvent(analyticsData).catch((error: any) => {
                logger.error('Failed to publish analytics event', {
                    shortCode,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

            logger.info('URL redirect successful', {
                shortCode,
                longUrl: urlMapping.long_url,
                ip: this.getClientIP(req),
                userAgent: req.get('User-Agent'),
                referrer: req.get('Referer'),
                cacheSource: lookupResult.source,
                latency,
            });

            // Perform HTTP 301 redirect
            res.redirect(301, urlMapping.long_url);

            return {
                success: true,
                statusCode: 301,
                longUrl: urlMapping.long_url,
                shortCode,
                latency,
                cacheSource: lookupResult.source,
            };

        } catch (error) {
            this.stats.serverErrors++;
            const latency = Date.now() - startTime;
            this.updateAverageLatency(latency);

            logger.error('Error handling URL redirect', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                ip: this.getClientIP(req),
                latency,
            });

            res.status(500).json({
                error: 'Internal server error',
                message: 'An error occurred while processing the redirect',
                shortCode,
            });

            return {
                success: false,
                statusCode: 500,
                shortCode,
                error: 'Internal server error',
                latency,
            };
        }
    }

    /**
     * Resolve URL without performing redirect (for API endpoints)
     */
    async resolveUrl(shortCode: string): Promise<{
        urlMapping: URLMapping | null;
        status: 'found' | 'not_found' | 'expired' | 'deleted';
        latency: number;
    }> {
        const startTime = Date.now();

        try {
            const lookupResult = await this.cacheService.lookupUrl(shortCode);
            const urlMapping = lookupResult.urlMapping;
            const latency = Date.now() - startTime;

            if (!urlMapping) {
                return {
                    urlMapping: null,
                    status: 'not_found',
                    latency,
                };
            }

            if (urlMapping.is_deleted) {
                return {
                    urlMapping: null,
                    status: 'deleted',
                    latency,
                };
            }

            if (this.isExpired(urlMapping)) {
                return {
                    urlMapping: null,
                    status: 'expired',
                    latency,
                };
            }

            return {
                urlMapping,
                status: 'found',
                latency,
            };

        } catch (error) {
            logger.error('Error resolving URL', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Batch resolve multiple URLs
     */
    async batchResolveUrls(shortCodes: string[]): Promise<Map<string, {
        urlMapping: URLMapping | null;
        status: 'found' | 'not_found' | 'expired' | 'deleted';
    }>> {
        const results = new Map();

        // Process in parallel with concurrency limit
        const concurrency = 10;
        const chunks = this.chunkArray(shortCodes, concurrency);

        for (const chunk of chunks) {
            const promises = chunk.map(async (shortCode) => {
                try {
                    const result = await this.resolveUrl(shortCode);
                    return { shortCode, result };
                } catch (error) {
                    logger.error('Error in batch resolve', {
                        shortCode,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return {
                        shortCode,
                        result: {
                            urlMapping: null,
                            status: 'not_found' as const,
                            latency: 0,
                        },
                    };
                }
            });

            const chunkResults = await Promise.all(promises);

            for (const { shortCode, result } of chunkResults) {
                results.set(shortCode, {
                    urlMapping: result.urlMapping,
                    status: result.status,
                });
            }
        }

        return results;
    }

    /**
     * Get redirect service statistics
     */
    getStats(): RedirectStats {
        return { ...this.stats };
    }

    /**
     * Reset redirect service statistics
     */
    resetStats(): void {
        this.stats = {
            totalRedirects: 0,
            successfulRedirects: 0,
            notFoundErrors: 0,
            expiredErrors: 0,
            serverErrors: 0,
            averageLatency: 0,
            cacheHitRate: 0,
        };

        logger.info('Redirect service statistics reset');
    }

    /**
     * Get cache service for external access
     */
    getCacheService(): MultiLayerCacheService {
        return this.cacheService;
    }

    /**
     * Warm up cache with popular URLs
     */
    async warmUpCache(limit: number = 1000): Promise<void> {
        await this.cacheService.warmUpCache(limit);
    }

    /**
     * Health check for redirect service
     */
    async healthCheck(): Promise<{
        service: boolean;
        cache: {
            memory: boolean;
            redis: boolean;
            database: boolean;
            overall: boolean;
        };
        analytics: {
            service: boolean;
            kafka: boolean;
            bufferSize: number;
            bufferUtilization: number;
        };
    }> {
        try {
            const cacheHealth = await this.cacheService.healthCheck();
            const bufferStats = this.analyticsService.getBufferStats();

            return {
                service: true,
                cache: cacheHealth,
                analytics: {
                    service: bufferStats.isProducerReady,
                    kafka: bufferStats.isProducerReady,
                    bufferSize: bufferStats.bufferSize,
                    bufferUtilization: bufferStats.bufferSize / bufferStats.maxBufferSize,
                },
            };

        } catch (error) {
            logger.error('Redirect service health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                service: false,
                cache: {
                    memory: false,
                    redis: false,
                    database: false,
                    overall: false,
                },
                analytics: {
                    service: false,
                    kafka: false,
                    bufferSize: 0,
                    bufferUtilization: 0,
                },
            };
        }
    }

    /**
     * Check if URL mapping has expired
     */
    private isExpired(urlMapping: URLMapping): boolean {
        if (!urlMapping.expires_at) {
            return false; // No expiry set
        }

        const now = new Date();
        const expiryTime = new Date(urlMapping.expires_at);
        return now >= expiryTime;
    }

    /**
     * Mark expired URL in cache to prevent repeated DB queries
     */
    private async markExpiredInCache(shortCode: string): Promise<void> {
        try {
            // Create an expired marker in cache with 7-day TTL
            // This prevents repeated database queries for expired URLs
            await this.cacheService.markAsExpired(shortCode, 7 * 24 * 60 * 60); // 7 days in seconds

            logger.debug('Marked expired URL in cache', { shortCode });
        } catch (error) {
            logger.error('Failed to mark expired URL in cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - this is an optimization, not critical
        }
    }

    /**
     * Update access tracking asynchronously
     */
    private async updateAccessTracking(shortCode: string, urlMapping: URLMapping): Promise<void> {
        try {
            // Update database access count and timestamp
            await this.urlRepository.incrementAccessCount(shortCode);

            // Update cache with new access timestamp
            const updatedMapping: URLMapping = {
                ...urlMapping,
                access_count: urlMapping.access_count + 1,
                last_accessed_at: new Date(),
            };

            await this.cacheService.updateCache(shortCode, updatedMapping);

            logger.debug('Access tracking updated', {
                shortCode,
                newAccessCount: updatedMapping.access_count,
            });

        } catch (error) {
            logger.error('Failed to update access tracking', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - access tracking failures shouldn't break redirects
        }
    }

    /**
     * Get client IP address from request
     */
    private getClientIP(req: Request): string {
        return (
            req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            (req.connection as any)?.socket?.remoteAddress ||
            'unknown'
        );
    }

    /**
     * Update average latency calculation
     */
    private updateAverageLatency(latency: number): void {
        const total = this.stats.totalRedirects;
        const currentAvg = this.stats.averageLatency;

        // Calculate running average
        this.stats.averageLatency = ((currentAvg * (total - 1)) + latency) / total;
    }

    /**
     * Update cache hit rate based on cache source
     */
    private updateCacheHitRate(cacheSource: string): void {
        // Consider memory and redis as cache hits
        const cacheHits = cacheSource === 'memory' || cacheSource === 'redis' ? 1 : 0;
        const totalRequests = this.stats.totalRedirects;

        if (totalRequests > 0) {
            // This is a simplified calculation - in production, you'd want to track this more precisely
            const currentHits = Math.floor(this.stats.cacheHitRate * (totalRequests - 1) / 100);
            this.stats.cacheHitRate = ((currentHits + cacheHits) / totalRequests) * 100;
        }
    }

    /**
     * Chunk array into smaller arrays
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Preload URLs into cache
     */
    async preloadUrls(shortCodes: string[]): Promise<void> {
        try {
            logger.info('Preloading URLs into cache', { count: shortCodes.length });

            const chunks = this.chunkArray(shortCodes, 50); // Process in chunks of 50

            for (const chunk of chunks) {
                const promises = chunk.map(async (shortCode) => {
                    try {
                        await this.cacheService.lookupUrl(shortCode);
                    } catch (error) {
                        logger.warn('Failed to preload URL', {
                            shortCode,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                });

                await Promise.all(promises);
            }

            logger.info('URL preloading completed', { count: shortCodes.length });

        } catch (error) {
            logger.error('Error during URL preloading', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Invalidate URL from all cache layers
     */
    async invalidateUrl(shortCode: string): Promise<void> {
        await this.cacheService.invalidateCache(shortCode);

        logger.info('URL invalidated from cache', { shortCode });
    }

    /**
     * Get detailed performance metrics
     */
    getPerformanceMetrics(): {
        stats: RedirectStats;
        cacheStats: any;
        analyticsStats: any;
        healthStatus: any;
    } {
        return {
            stats: this.getStats(),
            cacheStats: this.cacheService.getStats(),
            analyticsStats: this.analyticsService.getBufferStats(),
            healthStatus: {
                // This would be populated by the health check
                lastCheck: new Date().toISOString(),
            },
        };
    }

    /**
     * Get analytics service for external access
     */
    getAnalyticsService(): typeof analyticsEventProducer {
        return this.analyticsService;
    }

    /**
     * Shutdown redirect service
     */
    async shutdown(): Promise<void> {
        try {
            await this.analyticsService.shutdown();
            logger.info('URL Redirect Service shutdown completed');
        } catch (error) {
            logger.error('Error during redirect service shutdown', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}