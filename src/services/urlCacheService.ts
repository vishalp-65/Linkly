import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { URLMapping } from '../types/database';

export interface CacheOptions {
    ttl?: number;
    skipCache?: boolean;
}

export interface CacheStats {
    hits: number;
    misses: number;
    writes: number;
    errors: number;
    hitRate: number;
}

export class URLCacheService {
    private static readonly DEFAULT_TTL = 3600;
    private static readonly CACHE_KEY_PREFIX = 'url:';
    private static readonly EXPIRED_KEY_PREFIX = 'expired:';

    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        writes: 0,
        errors: 0,
        hitRate: 0,
    };

    // ========== Public Methods ==========

    async cacheUrlMapping(urlMapping: URLMapping, options: CacheOptions = {}): Promise<void> {
        if (options.skipCache) return;

        try {
            const cacheKey = this.buildCacheKey(urlMapping.short_code);
            const cacheValue = this.serializeUrlMapping(urlMapping);
            const ttl = this.calculateTTL(urlMapping, options.ttl);

            await redis.set(cacheKey, cacheValue, ttl);

            this.stats.writes++;
            this.updateHitRate();

            logger.debug('URL mapping cached', { shortCode: urlMapping.short_code, ttl });
        } catch (error) {
            this.handleError('cache URL mapping', urlMapping.short_code, error);
        }
    }

    async getCachedUrlMapping(shortCode: string): Promise<URLMapping | null> {
        try {
            const cacheKey = this.buildCacheKey(shortCode);
            const cachedValue = await redis.get(cacheKey);

            if (!cachedValue) {
                this.recordMiss(shortCode);
                return null;
            }

            const urlMapping = this.deserializeUrlMapping(cachedValue);

            if (this.isExpired(urlMapping)) {
                await this.removeCachedUrlMapping(shortCode);
                this.recordMiss(shortCode);
                return null;
            }

            this.recordHit(shortCode);
            return urlMapping;
        } catch (error) {
            this.handleError('get cached URL mapping', shortCode, error);
            return null;
        }
    }

    async removeCachedUrlMapping(shortCode: string): Promise<void> {
        try {
            const cacheKey = this.buildCacheKey(shortCode);
            await redis.del(cacheKey);
            logger.debug('URL mapping removed from cache', { shortCode });
        } catch (error) {
            this.handleError('remove cached URL mapping', shortCode, error);
        }
    }

    async updateCachedUrlMapping(
        shortCode: string,
        updates: Partial<URLMapping>,
        options: CacheOptions = {}
    ): Promise<void> {
        try {
            const cached = await this.getCachedUrlMapping(shortCode);
            if (!cached) return;

            const updatedMapping: URLMapping = { ...cached, ...updates };
            await this.cacheUrlMapping(updatedMapping, options);

            logger.debug('Cached URL mapping updated', {
                shortCode,
                updatedFields: Object.keys(updates),
            });
        } catch (error) {
            this.handleError('update cached URL mapping', shortCode, error);
        }
    }

    async batchCacheUrlMappings(
        urlMappings: URLMapping[],
        options: CacheOptions = {}
    ): Promise<void> {
        if (options.skipCache || urlMappings.length === 0) return;

        try {
            const pipeline = (redis.getClient() as any).multi();

            for (const urlMapping of urlMappings) {
                const cacheKey = this.buildCacheKey(urlMapping.short_code);
                const cacheValue = this.serializeUrlMapping(urlMapping);
                const ttl = this.calculateTTL(urlMapping, options.ttl);

                if (ttl) {
                    pipeline.setEx(cacheKey, ttl, cacheValue);
                } else {
                    pipeline.set(cacheKey, cacheValue);
                }
            }

            await pipeline.exec();

            this.stats.writes += urlMappings.length;
            this.updateHitRate();

            logger.debug('Batch cached URL mappings', { count: urlMappings.length });
        } catch (error) {
            this.handleError('batch cache URL mappings', `count: ${urlMappings.length}`, error);
        }
    }

    async markAsExpired(shortCode: string, ttlSeconds: number = 604800): Promise<void> {
        try {
            const expiredKey = `${URLCacheService.EXPIRED_KEY_PREFIX}${shortCode}`;
            await redis.set(expiredKey, '1', ttlSeconds);
            logger.debug('URL marked as expired in cache', { shortCode, ttlSeconds });
        } catch (error) {
            this.handleError('mark URL as expired', shortCode, error);
            throw error;
        }
    }

    async isMarkedAsExpired(shortCode: string): Promise<boolean> {
        try {
            const expiredKey = `${URLCacheService.EXPIRED_KEY_PREFIX}${shortCode}`;
            const result = await redis.get(expiredKey);
            return result === '1';
        } catch (error) {
            this.handleError('check if URL is marked as expired', shortCode, error);
            return false;
        }
    }

    async warmUpCache(urlMappings: URLMapping[]): Promise<void> {
        logger.info('Starting cache warm-up', { count: urlMappings.length });
        await this.batchCacheUrlMappings(urlMappings, {
            ttl: URLCacheService.DEFAULT_TTL * 2,
        });
        logger.info('Cache warm-up completed', { count: urlMappings.length });
    }

    async clearCache(): Promise<void> {
        try {
            const pattern = `${URLCacheService.CACHE_KEY_PREFIX}*`;
            const keys = await (redis.getClient() as any).keys(pattern);

            if (keys.length > 0) {
                await redis.getClient().del(keys);
                logger.info('Cache cleared', { keysDeleted: keys.length });
            } else {
                logger.info('No cache entries to clear');
            }
        } catch (error) {
            logger.error('Failed to clear cache', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const testKey = 'health_check_test';
            const testValue = Date.now().toString();

            await redis.set(testKey, testValue, 10);
            const retrieved = await redis.get(testKey);
            await redis.del(testKey);

            return retrieved === testValue;
        } catch (error) {
            logger.error('Cache health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    getCacheStats(): CacheStats {
        return { ...this.stats };
    }

    resetCacheStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            writes: 0,
            errors: 0,
            hitRate: 0,
        };
        logger.info('Cache statistics reset');
    }

    getCacheConfig(): { defaultTtl: number; keyPrefix: string } {
        return {
            defaultTtl: URLCacheService.DEFAULT_TTL,
            keyPrefix: URLCacheService.CACHE_KEY_PREFIX,
        };
    }

    // ========== Private Methods ==========

    private buildCacheKey(shortCode: string): string {
        return `${URLCacheService.CACHE_KEY_PREFIX}${shortCode}`;
    }

    private serializeUrlMapping(urlMapping: URLMapping): string {
        return JSON.stringify({
            ...urlMapping,
            created_at: urlMapping.created_at?.toISOString(),
            expires_at: urlMapping.expires_at?.toISOString(),
            last_accessed_at: urlMapping.last_accessed_at?.toISOString(),
            deleted_at: urlMapping.deleted_at?.toISOString(),
        });
    }

    private deserializeUrlMapping(cachedValue: string): URLMapping {
        const parsed = JSON.parse(cachedValue);

        return {
            ...parsed,
            created_at: parsed.created_at ? new Date(parsed.created_at) : null,
            expires_at: parsed.expires_at ? new Date(parsed.expires_at) : null,
            last_accessed_at: parsed.last_accessed_at ? new Date(parsed.last_accessed_at) : null,
            deleted_at: parsed.deleted_at ? new Date(parsed.deleted_at) : null,
        };
    }

    private calculateTTL(urlMapping: URLMapping, optionsTtl?: number): number | undefined {
        if (optionsTtl) return optionsTtl;

        if (urlMapping.expires_at) {
            const now = new Date();
            const expiryTime = new Date(urlMapping.expires_at);
            const secondsUntilExpiry = Math.floor((expiryTime.getTime() - now.getTime()) / 1000);

            if (secondsUntilExpiry <= 60) return undefined;

            return Math.min(URLCacheService.DEFAULT_TTL, secondsUntilExpiry);
        }

        return URLCacheService.DEFAULT_TTL;
    }

    private isExpired(urlMapping: URLMapping): boolean {
        if (!urlMapping.expires_at) return false;

        const now = new Date();
        const expiryTime = new Date(urlMapping.expires_at);
        return now >= expiryTime;
    }

    private recordHit(shortCode: string): void {
        this.stats.hits++;
        this.updateHitRate();
        logger.debug('Cache hit', { shortCode });
    }

    private recordMiss(shortCode: string): void {
        this.stats.misses++;
        this.updateHitRate();
        logger.debug('Cache miss', { shortCode });
    }

    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    private handleError(operation: string, context: string, error: unknown): void {
        this.stats.errors++;
        logger.error(`Failed to ${operation}`, {
            context,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}