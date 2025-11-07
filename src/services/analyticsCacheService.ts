import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { AnalyticsData, GlobalAnalyticsData } from '../repositories/AnalyticsRepository';

class AnalyticsCacheService {
    private readonly defaultTTL = 300; // 5 minutes
    private readonly realtimeTTL = 60; // 1 minute for realtime data
    private readonly globalTTL = 600; // 10 minutes for global analytics
    private readonly keyPrefix = 'analytics:';

    /**
     * Generate a consistent cache key
     */
    private generateCacheKey(type: string, identifier: string, params?: Record<string, any>): string {
        let key = `${this.keyPrefix}${type}:${identifier}`;

        if (params) {
            const sortedParams = Object.keys(params)
                .sort()
                .map(k => `${k}:${params[k]}`)
                .join('|');
            key += `:${sortedParams}`;
        }

        return key;
    }

    /**
     * Get analytics from cache
     */
    async getAnalytics(shortCode: string, dateFrom: string, dateTo: string): Promise<AnalyticsData | null> {
        try {
            const cacheKey = this.generateCacheKey('url', shortCode, { from: dateFrom, to: dateTo });
            const cached = await redis.get(cacheKey);

            if (cached) {
                logger.debug('Analytics cache hit', { shortCode, cacheKey });
                return JSON.parse(cached);
            }

            logger.debug('Analytics cache miss', { shortCode, cacheKey });
            return null;
        } catch (error) {
            logger.warn('Failed to get analytics from cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    /**
     * Set analytics in cache
     */
    async setAnalytics(
        shortCode: string,
        dateFrom: string,
        dateTo: string,
        data: AnalyticsData,
        ttl?: number
    ): Promise<void> {
        try {
            const cacheKey = this.generateCacheKey('url', shortCode, { from: dateFrom, to: dateTo });
            const cacheTTL = ttl || this.defaultTTL;

            await redis.set(cacheKey, JSON.stringify(data), cacheTTL);

            logger.debug('Analytics cached', { shortCode, cacheKey, ttl: cacheTTL });
        } catch (error) {
            logger.warn('Failed to cache analytics data', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get global analytics from cache
     */
    async getGlobalAnalytics(userId: number, dateFrom: string, dateTo: string): Promise<GlobalAnalyticsData | null> {
        try {
            const cacheKey = this.generateCacheKey('global', `user:${userId}`, { from: dateFrom, to: dateTo });
            const cached = await redis.get(cacheKey);

            if (cached) {
                logger.debug('Global analytics cache hit', { userId, cacheKey });
                return JSON.parse(cached);
            }

            logger.debug('Global analytics cache miss', { userId, cacheKey });
            return null;
        } catch (error) {
            logger.warn('Failed to get global analytics from cache', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    /**
     * Set global analytics in cache
     */
    async setGlobalAnalytics(
        userId: number,
        dateFrom: string,
        dateTo: string,
        data: GlobalAnalyticsData,
        ttl?: number
    ): Promise<void> {
        try {
            const cacheKey = this.generateCacheKey('global', `user:${userId}`, { from: dateFrom, to: dateTo });
            const cacheTTL = ttl || this.globalTTL;

            await redis.set(cacheKey, JSON.stringify(data), cacheTTL);

            logger.debug('Global analytics cached', { userId, cacheKey, ttl: cacheTTL });
        } catch (error) {
            logger.warn('Failed to cache global analytics data', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Get real-time analytics from cache
     */
    async getRealtimeAnalytics(shortCode: string): Promise<any | null> {
        try {
            const cacheKey = this.generateCacheKey('realtime', shortCode);
            const cached = await redis.get(cacheKey);

            if (cached) {
                logger.debug('Realtime analytics cache hit', { shortCode, cacheKey });
                return JSON.parse(cached);
            }

            logger.debug('Realtime analytics cache miss', { shortCode });
            return null;
        } catch (error) {
            logger.warn('Failed to get realtime analytics from cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    /**
     * Set real-time analytics in cache
     */
    async setRealtimeAnalytics(shortCode: string, data: any): Promise<void> {
        try {
            const cacheKey = this.generateCacheKey('realtime', shortCode);

            await redis.set(cacheKey, JSON.stringify(data), this.realtimeTTL);

            logger.debug('Realtime analytics cached', { shortCode, cacheKey, ttl: this.realtimeTTL });
        } catch (error) {
            logger.warn('Failed to cache realtime analytics data', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Invalidate analytics cache for a specific short code
     */
    async invalidateAnalytics(shortCode: string): Promise<void> {
        try {
            // Delete all cache keys for this short code
            const patterns = [
                `${this.keyPrefix}url:${shortCode}:*`,
                `${this.keyPrefix}realtime:${shortCode}`,
            ];

            let deletedCount = 0;

            // Use SCAN to find and delete keys matching patterns
            for (const pattern of patterns) {
                try {
                    const keys = await redis.keys(pattern);
                    if (keys && keys.length > 0) {
                        const deleted = await redis.del(...keys);
                        deletedCount += deleted;
                    }
                } catch (error) {
                    logger.warn('Failed to delete cache pattern', { pattern, error });
                }
            }

            logger.info('Analytics cache invalidated', { shortCode, keysDeleted: deletedCount });
        } catch (error) {
            logger.warn('Failed to invalidate analytics cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Invalidate global analytics cache for a user
     */
    async invalidateGlobalAnalytics(userId: number): Promise<void> {
        try {
            const pattern = `${this.keyPrefix}global:user:${userId}:*`;

            let deletedCount = 0;
            try {
                const keys = await redis.keys(pattern);
                if (keys && keys.length > 0) {
                    deletedCount = await redis.del(...keys);
                }
            } catch (error) {
                logger.warn('Failed to delete global cache pattern', { pattern, error });
            }

            logger.info('Global analytics cache invalidated', { userId, keysDeleted: deletedCount });
        } catch (error) {
            logger.warn('Failed to invalidate global analytics cache', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Warm up cache with common date ranges
     */
    async warmupCache(shortCode: string, data: AnalyticsData): Promise<void> {
        const now = new Date();
        const ranges = [
            { days: 1, ttl: 300 },   // Last 1 day - 5 min cache
            { days: 7, ttl: 600 },   // Last 7 days - 10 min cache
            { days: 30, ttl: 1800 }, // Last 30 days - 30 min cache
        ];

        for (const range of ranges) {
            const dateFrom = new Date(now.getTime() - range.days * 24 * 60 * 60 * 1000);
            await this.setAnalytics(
                shortCode,
                dateFrom.toISOString().split('T')[0],
                now.toISOString().split('T')[0],
                data,
                range.ttl
            );
        }
    }

    /**
     * Get cache statistics (requires Redis INFO command)
     */
    async getCacheStats(): Promise<{
        totalKeys: number;
        analyticsKeys: number;
        realtimeKeys: number;
        globalKeys: number;
    }> {
        try {
            // Get all analytics-related keys
            const urlPattern = `${this.keyPrefix}url:*`;
            const realtimePattern = `${this.keyPrefix}realtime:*`;
            const globalPattern = `${this.keyPrefix}global:*`;

            const [urlKeys, realtimeKeys, globalKeys] = await Promise.all([
                redis.keys(urlPattern).catch(() => []),
                redis.keys(realtimePattern).catch(() => []),
                redis.keys(globalPattern).catch(() => [])
            ]);

            const analyticsKeyCount = urlKeys?.length || 0;
            const realtimeKeyCount = realtimeKeys?.length || 0;
            const globalKeyCount = globalKeys?.length || 0;

            return {
                totalKeys: analyticsKeyCount + realtimeKeyCount + globalKeyCount,
                analyticsKeys: analyticsKeyCount,
                realtimeKeys: realtimeKeyCount,
                globalKeys: globalKeyCount,
            };
        } catch (error) {
            logger.warn('Failed to get cache stats', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return {
                totalKeys: 0,
                analyticsKeys: 0,
                realtimeKeys: 0,
                globalKeys: 0,
            };
        }
    }

    /**
     * Clear all analytics cache (use with caution)
     */
    async clearAllCache(): Promise<number> {
        try {
            const pattern = `${this.keyPrefix}*`;
            const keys = await redis.keys(pattern);

            if (keys && keys.length > 0) {
                const deleted = await redis.del(...keys);
                logger.info('All analytics cache cleared', { keysDeleted: deleted });
                return deleted;
            }

            return 0;
        } catch (error) {
            logger.error('Failed to clear all cache', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }
}

export const analyticsCacheService = new AnalyticsCacheService();
export default analyticsCacheService;