import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { AnalyticsData, GlobalAnalyticsData } from '../repositories/AnalyticsRepository';

class AnalyticsCacheService {
    private readonly defaultTTL = 300; // 5 minutes
    private readonly realtimeTTL = 60; // 1 minute for realtime data
    private readonly keyPrefix = 'analytics:';

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

    async getGlobalAnalytics(dateFrom: string, dateTo: string): Promise<GlobalAnalyticsData | null> {
        try {
            const cacheKey = this.generateCacheKey('global', 'all', { from: dateFrom, to: dateTo });
            const cached = await redis.get(cacheKey);

            if (cached) {
                logger.debug('Global analytics cache hit', { cacheKey });
                return JSON.parse(cached);
            }

            logger.debug('Global analytics cache miss', { cacheKey });
            return null;
        } catch (error) {
            logger.warn('Failed to get global analytics from cache', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

    async setGlobalAnalytics(
        dateFrom: string,
        dateTo: string,
        data: GlobalAnalyticsData,
        ttl?: number
    ): Promise<void> {
        try {
            const cacheKey = this.generateCacheKey('global', 'all', { from: dateFrom, to: dateTo });
            const cacheTTL = ttl || this.defaultTTL;

            await redis.set(cacheKey, JSON.stringify(data), cacheTTL);

            logger.debug('Global analytics cached', { cacheKey, ttl: cacheTTL });
        } catch (error) {
            logger.warn('Failed to cache global analytics data', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    async getRealtimeAnalytics(shortCode: string): Promise<any | null> {
        try {
            const cacheKey = this.generateCacheKey('realtime', shortCode);
            const cached = await redis.get(cacheKey);

            if (cached) {
                logger.debug('Realtime analytics cache hit', { shortCode, cacheKey });
                return JSON.parse(cached);
            }

            return null;
        } catch (error) {
            logger.warn('Failed to get realtime analytics from cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }

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

    async invalidateAnalytics(shortCode: string): Promise<void> {
        try {
            // For simplicity, we'll delete specific known patterns
            // In a production environment, you might want to use Redis SCAN instead of KEYS
            const patterns = [
                `${this.keyPrefix}url:${shortCode}:*`,
                `${this.keyPrefix}realtime:${shortCode}`,
            ];

            let deletedCount = 0;
            for (const pattern of patterns) {
                // Since we can't use KEYS in production, we'll delete common cache keys
                const commonRanges = ['from:*', 'to:*'];
                for (const range of commonRanges) {
                    const key = pattern.replace('*', range);
                    try {
                        const deleted = await redis.del(key);
                        deletedCount += deleted;
                    } catch (error) {
                        // Ignore individual key deletion errors
                    }
                }
            }

            logger.debug('Analytics cache invalidated', { shortCode, keysDeleted: deletedCount });
        } catch (error) {
            logger.warn('Failed to invalidate analytics cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    async invalidateGlobalAnalytics(): Promise<void> {
        try {
            // Delete common global analytics cache keys
            const commonKeys = [
                `${this.keyPrefix}global:all:from:*`,
            ];

            let deletedCount = 0;
            for (const key of commonKeys) {
                try {
                    const deleted = await redis.del(key);
                    deletedCount += deleted;
                } catch (error) {
                    // Ignore individual key deletion errors
                }
            }

            logger.debug('Global analytics cache invalidated', { keysDeleted: deletedCount });
        } catch (error) {
            logger.warn('Failed to invalidate global analytics cache', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    async warmupCache(shortCode: string, data: AnalyticsData): Promise<void> {
        // Cache common date ranges
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

    async getCacheStats(): Promise<{
        totalKeys: number;
        analyticsKeys: number;
        realtimeKeys: number;
        globalKeys: number;
    }> {
        // Since we can't use KEYS in production, return estimated stats
        // In a real implementation, you'd track these metrics separately
        return {
            totalKeys: 0,
            analyticsKeys: 0,
            realtimeKeys: 0,
            globalKeys: 0,
        };
    }
}

export const analyticsCacheService = new AnalyticsCacheService();
export default analyticsCacheService;