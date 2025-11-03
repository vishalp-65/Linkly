import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { URLMapping } from '../types/database';

/**
 * URL Cache Service
 * Implements write-through caching for URL mappings with Redis
 */

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    skipCache?: boolean; // Skip cache for this operation
}

export interface CacheStats {
    hits: number;
    misses: number;
    writes: number;
    errors: number;
    hitRate: number;
}

export class URLCacheService {
    private static readonly DEFAULT_TTL = 3600; // 1 hour
    private static readonly CACHE_KEY_PREFIX = 'url:';
    private static readonly STATS_KEY = 'url_cache_stats';

    // Cache statistics
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        writes: 0,
        errors: 0,
        hitRate: 0,
    };

    /**
     * Write URL mapping to cache (write-through)
     */
    async cacheUrlMapping(urlMapping: URLMapping, options: CacheOptions = {}): Promise<void> {
        if (options.skipCache) {
            return;
        }

        try {
            const cacheKey = this.buildCacheKey(urlMapping.short_code);
            const cacheValue = this.serializeUrlMapping(urlMapping);

            // Calculate TTL based on expiry or default
            const ttl = this.calculateTTL(urlMapping, options.ttl);

            await redis.set(cacheKey, cacheValue, ttl);

            this.stats.writes++;
            this.updateHitRate();

            logger.debug('URL mapping cached', {
                shortCode: urlMapping.short_code,
                ttl,
                expiresAt: urlMapping.expires_at,
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to cache URL mapping', {
                shortCode: urlMapping.short_code,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - cache failures should not break the main flow
        }
    }

    /**
     * Get URL mapping from cache
     */
    async getCachedUrlMapping(shortCode: string): Promise<URLMapping | null> {
        try {
            const cacheKey = this.buildCacheKey(shortCode);
            const cachedValue = await redis.get(cacheKey);

            if (!cachedValue) {
                this.stats.misses++;
                this.updateHitRate();

                logger.debug('Cache miss for URL mapping', { shortCode });
                return null;
            }

            const urlMapping = this.deserializeUrlMapping(cachedValue);

            // Check if cached URL has expired
            if (this.isExpired(urlMapping)) {
                logger.debug('Cached URL mapping has expired', {
                    shortCode,
                    expiresAt: urlMapping.expires_at,
                });

                // Remove expired entry from cache
                await this.removeCachedUrlMapping(shortCode);

                this.stats.misses++;
                this.updateHitRate();
                return null;
            }

            this.stats.hits++;
            this.updateHitRate();

            logger.debug('Cache hit for URL mapping', { shortCode });
            return urlMapping;

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to get cached URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Return null on cache errors to fall back to database
            return null;
        }
    }

    /**
     * Remove URL mapping from cache
     */
    async removeCachedUrlMapping(shortCode: string): Promise<void> {
        try {
            const cacheKey = this.buildCacheKey(shortCode);
            await redis.del(cacheKey);

            logger.debug('URL mapping removed from cache', { shortCode });

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to remove cached URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - cache failures should not break the main flow
        }
    }

    /**
     * Update cached URL mapping (for access count updates, etc.)
     */
    async updateCachedUrlMapping(
        shortCode: string,
        updates: Partial<URLMapping>,
        options: CacheOptions = {}
    ): Promise<void> {
        try {
            const cached = await this.getCachedUrlMapping(shortCode);
            if (!cached) {
                // If not in cache, don't add it (let the next read populate it)
                return;
            }

            // Merge updates with cached data
            const updatedMapping: URLMapping = {
                ...cached,
                ...updates,
            };

            await this.cacheUrlMapping(updatedMapping, options);

            logger.debug('Cached URL mapping updated', {
                shortCode,
                updatedFields: Object.keys(updates),
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to update cached URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Batch cache multiple URL mappings
     */
    async batchCacheUrlMappings(
        urlMappings: URLMapping[],
        options: CacheOptions = {}
    ): Promise<void> {
        if (options.skipCache || urlMappings.length === 0) {
            return;
        }

        try {
            // Use pipeline for better performance
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

            logger.debug('Batch cached URL mappings', {
                count: urlMappings.length,
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to batch cache URL mappings', {
                count: urlMappings.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Warm up cache with frequently accessed URLs
     */
    async warmUpCache(urlMappings: URLMapping[]): Promise<void> {
        logger.info('Starting cache warm-up', { count: urlMappings.length });

        await this.batchCacheUrlMappings(urlMappings, {
            ttl: URLCacheService.DEFAULT_TTL * 2, // Longer TTL for warm-up
        });

        logger.info('Cache warm-up completed', { count: urlMappings.length });
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Reset cache statistics
     */
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

    /**
     * Check cache health
     */
    async healthCheck(): Promise<boolean> {
        try {
            const testKey = 'health_check_test';
            const testValue = Date.now().toString();

            await redis.set(testKey, testValue, 10); // 10 second TTL
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

    /**
     * Clear all URL cache entries (use with caution)
     */
    async clearCache(): Promise<void> {
        try {
            // Get all keys with our prefix
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

    /**
     * Build cache key for short code
     */
    private buildCacheKey(shortCode: string): string {
        return `${URLCacheService.CACHE_KEY_PREFIX}${shortCode}`;
    }

    /**
     * Serialize URL mapping for cache storage
     */
    private serializeUrlMapping(urlMapping: URLMapping): string {
        return JSON.stringify({
            ...urlMapping,
            created_at: urlMapping.created_at?.toISOString(),
            expires_at: urlMapping.expires_at?.toISOString(),
            last_accessed_at: urlMapping.last_accessed_at?.toISOString(),
            deleted_at: urlMapping.deleted_at?.toISOString(),
        });
    }

    /**
     * Deserialize URL mapping from cache
     */
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

    /**
     * Calculate TTL based on URL expiry and options
     */
    private calculateTTL(urlMapping: URLMapping, optionsTtl?: number): number | undefined {
        if (optionsTtl) {
            return optionsTtl;
        }

        if (urlMapping.expires_at) {
            const now = new Date();
            const expiryTime = new Date(urlMapping.expires_at);
            const secondsUntilExpiry = Math.floor((expiryTime.getTime() - now.getTime()) / 1000);

            // Don't cache if already expired or expires very soon
            if (secondsUntilExpiry <= 60) {
                return undefined;
            }

            // Use the shorter of default TTL or time until expiry
            return Math.min(URLCacheService.DEFAULT_TTL, secondsUntilExpiry);
        }

        return URLCacheService.DEFAULT_TTL;
    }

    /**
     * Check if URL mapping has expired
     */
    private isExpired(urlMapping: URLMapping): boolean {
        if (!urlMapping.expires_at) {
            return false;
        }

        const now = new Date();
        const expiryTime = new Date(urlMapping.expires_at);
        return now >= expiryTime;
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }

    /**
     * Get cache key pattern for debugging
     */
    getCacheKeyPattern(): string {
        return `${URLCacheService.CACHE_KEY_PREFIX}*`;
    }

    /**
     * Get cache configuration
     */
    getCacheConfig(): { defaultTtl: number; keyPrefix: string } {
        return {
            defaultTtl: URLCacheService.DEFAULT_TTL,
            keyPrefix: URLCacheService.CACHE_KEY_PREFIX,
        };
    }

    /**
     * Mark URL as expired in cache to prevent repeated DB queries
     */
    async markAsExpired(shortCode: string, ttlSeconds: number = 604800): Promise<void> {
        try {
            const expiredKey = `expired:${shortCode}`;
            await redis.set(expiredKey, '1', ttlSeconds);

            logger.debug('URL marked as expired in Redis cache', {
                shortCode,
                ttlSeconds,
            });

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to mark URL as expired in cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Check if URL is marked as expired in cache
     */
    async isMarkedAsExpired(shortCode: string): Promise<boolean> {
        try {
            const expiredKey = `expired:${shortCode}`;
            const result = await redis.get(expiredKey);
            return result === '1';

        } catch (error) {
            this.stats.errors++;
            logger.error('Failed to check if URL is marked as expired', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false; // If we can't check, assume not expired
        }
    }
}