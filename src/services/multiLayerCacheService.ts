import { URLMapping } from '../types/database';
import { URLRepository } from '../repositories/URLRepository';
import { URLCacheService } from './urlCacheService';
import { LRUCache } from './lruCache';
import { logger } from '../config/logger';
import { db } from '../config/database';

/**
 * Multi-Layer Cache Service
 * Implements a three-tier caching strategy:
 * 1. Application Memory (LRU Cache) - fastest, smallest capacity
 * 2. Redis Cache - fast, medium capacity
 * 3. Database - slowest, unlimited capacity
 */

export interface CacheLookupResult {
    urlMapping: URLMapping | null;
    source: 'memory' | 'redis' | 'database' | 'not_found';
    latency: number;
}

export interface MultiLayerCacheStats {
    memory: {
        hits: number;
        misses: number;
        hitRate: number;
        size: number;
        maxSize: number;
    };
    redis: {
        hits: number;
        misses: number;
        hitRate: number;
        errors: number;
    };
    database: {
        queries: number;
        errors: number;
        avgLatency: number;
    };
    overall: {
        totalRequests: number;
        memoryHitRate: number;
        redisHitRate: number;
        databaseFallbackRate: number;
    };
}

export class MultiLayerCacheService {
    private memoryCache: LRUCache<URLMapping>;
    private redisCache: URLCacheService;
    private urlRepository: URLRepository;
    private stats: MultiLayerCacheStats;

    constructor(memoryCacheSize: number = 10000) {
        this.memoryCache = new LRUCache<URLMapping>(memoryCacheSize);
        this.redisCache = new URLCacheService();
        this.urlRepository = new URLRepository();

        this.stats = {
            memory: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                size: 0,
                maxSize: memoryCacheSize,
            },
            redis: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                errors: 0,
            },
            database: {
                queries: 0,
                errors: 0,
                avgLatency: 0,
            },
            overall: {
                totalRequests: 0,
                memoryHitRate: 0,
                redisHitRate: 0,
                databaseFallbackRate: 0,
            },
        };

        logger.info('Multi-layer cache service initialized', {
            memoryCacheSize,
        });
    }

    /**
     * Lookup URL mapping using multi-layer cache strategy
     */
    async lookupUrl(shortCode: string): Promise<CacheLookupResult> {
        const startTime = Date.now();
        this.stats.overall.totalRequests++;

        try {
            // Check if URL is marked as expired first to avoid unnecessary lookups
            const isExpired = await this.isMarkedAsExpired(shortCode);
            if (isExpired) {
                const latency = Date.now() - startTime;
                logger.debug('URL found in expired cache marker', {
                    shortCode,
                    latency,
                });

                return {
                    urlMapping: null,
                    source: 'not_found',
                    latency,
                };
            }

            // Layer 1: Check application memory cache
            const memoryResult = this.memoryCache.get(shortCode);
            if (memoryResult) {
                this.stats.memory.hits++;
                this.updateStats();

                const latency = Date.now() - startTime;
                logger.debug('URL found in memory cache', {
                    shortCode,
                    latency,
                });

                return {
                    urlMapping: memoryResult,
                    source: 'memory',
                    latency,
                };
            }

            this.stats.memory.misses++;

            // Layer 2: Check Redis cache
            const redisResult = await this.redisCache.getCachedUrlMapping(shortCode);
            if (redisResult) {
                this.stats.redis.hits++;

                // Populate memory cache for future requests
                this.memoryCache.set(shortCode, redisResult);

                this.updateStats();

                const latency = Date.now() - startTime;
                logger.debug('URL found in Redis cache', {
                    shortCode,
                    latency,
                });

                return {
                    urlMapping: redisResult,
                    source: 'redis',
                    latency,
                };
            }

            this.stats.redis.misses++;

            // Layer 3: Check database
            const dbStartTime = Date.now();
            const dbResult = await this.urlRepository.findById(shortCode);
            const dbLatency = Date.now() - dbStartTime;

            this.stats.database.queries++;
            this.updateDatabaseLatency(dbLatency);

            if (dbResult) {
                // Populate both Redis and memory caches
                await this.populateCaches(shortCode, dbResult);

                this.updateStats();

                const totalLatency = Date.now() - startTime;
                logger.debug('URL found in database', {
                    shortCode,
                    dbLatency,
                    totalLatency,
                });

                return {
                    urlMapping: dbResult,
                    source: 'database',
                    latency: totalLatency,
                };
            }

            // URL not found in any layer
            this.updateStats();

            const latency = Date.now() - startTime;
            logger.debug('URL not found in any cache layer', {
                shortCode,
                latency,
            });

            return {
                urlMapping: null,
                source: 'not_found',
                latency,
            };

        } catch (error) {
            this.stats.database.errors++;
            logger.error('Error in multi-layer cache lookup', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Populate URL mapping in all cache layers
     */
    async populateCache(shortCode: string, urlMapping: URLMapping): Promise<void> {
        try {
            // Add to memory cache
            this.memoryCache.set(shortCode, urlMapping);

            // Add to Redis cache
            await this.redisCache.cacheUrlMapping(urlMapping);

            logger.debug('URL mapping populated in all cache layers', {
                shortCode,
            });

        } catch (error) {
            this.stats.redis.errors++;
            logger.error('Error populating cache layers', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - cache population failures shouldn't break the flow
        }
    }

    /**
     * Invalidate URL mapping from all cache layers
     */
    async invalidateCache(shortCode: string): Promise<void> {
        try {
            // Remove from memory cache
            this.memoryCache.delete(shortCode);

            // Remove from Redis cache
            await this.redisCache.removeCachedUrlMapping(shortCode);

            logger.debug('URL mapping invalidated from all cache layers', {
                shortCode,
            });

        } catch (error) {
            this.stats.redis.errors++;
            logger.error('Error invalidating cache layers', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - cache invalidation failures shouldn't break the flow
        }
    }

    /**
     * Update URL mapping in all cache layers
     */
    async updateCache(shortCode: string, urlMapping: URLMapping): Promise<void> {
        try {
            // Update memory cache
            this.memoryCache.set(shortCode, urlMapping);

            // Update Redis cache
            await this.redisCache.cacheUrlMapping(urlMapping);

            logger.debug('URL mapping updated in all cache layers', {
                shortCode,
            });

        } catch (error) {
            this.stats.redis.errors++;
            logger.error('Error updating cache layers', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - cache update failures shouldn't break the flow
        }
    }

    /**
     * Warm up cache with frequently accessed URLs
     */
    async warmUpCache(limit: number = 1000): Promise<void> {
        try {
            logger.info('Starting cache warm-up', { limit });

            // Get top URLs from database
            const topUrls = await this.urlRepository.getTopUrls(limit);

            // Populate memory cache
            for (const urlMapping of topUrls) {
                this.memoryCache.set(urlMapping.short_code, urlMapping);
            }

            // Populate Redis cache
            await this.redisCache.warmUpCache(topUrls);

            logger.info('Cache warm-up completed', {
                urlsWarmedUp: topUrls.length,
                memoryCacheSize: this.memoryCache.size(),
            });

        } catch (error) {
            logger.error('Error during cache warm-up', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Get comprehensive cache statistics
     */
    getStats(): MultiLayerCacheStats {
        const memoryStats = this.memoryCache.getStats();
        const redisStats = this.redisCache.getCacheStats();

        return {
            memory: {
                hits: memoryStats.hits,
                misses: memoryStats.misses,
                hitRate: memoryStats.hitRate,
                size: memoryStats.size,
                maxSize: memoryStats.maxSize,
            },
            redis: {
                hits: redisStats.hits,
                misses: redisStats.misses,
                hitRate: redisStats.hitRate,
                errors: this.stats.redis.errors,
            },
            database: {
                queries: this.stats.database.queries,
                errors: this.stats.database.errors,
                avgLatency: this.stats.database.avgLatency,
            },
            overall: {
                totalRequests: this.stats.overall.totalRequests,
                memoryHitRate: this.stats.overall.memoryHitRate,
                redisHitRate: this.stats.overall.redisHitRate,
                databaseFallbackRate: this.stats.overall.databaseFallbackRate,
            },
        };
    }

    /**
     * Reset all cache statistics
     */
    resetStats(): void {
        this.memoryCache.resetStats();
        this.redisCache.resetCacheStats();

        this.stats = {
            memory: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                size: this.memoryCache.size(),
                maxSize: this.memoryCache.maxCacheSize(),
            },
            redis: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                errors: 0,
            },
            database: {
                queries: 0,
                errors: 0,
                avgLatency: 0,
            },
            overall: {
                totalRequests: 0,
                memoryHitRate: 0,
                redisHitRate: 0,
                databaseFallbackRate: 0,
            },
        };

        logger.info('Multi-layer cache statistics reset');
    }

    /**
     * Perform health check on all cache layers
     */
    async healthCheck(): Promise<{
        memory: boolean;
        redis: boolean;
        database: boolean;
        overall: boolean;
    }> {
        try {
            const memoryHealthy = this.memoryCache.size() >= 0; // Memory cache is always healthy if accessible
            const redisHealthy = await this.redisCache.healthCheck();
            const databaseHealthy = await db.healthCheck();

            const overall = memoryHealthy && redisHealthy && databaseHealthy;

            logger.debug('Multi-layer cache health check', {
                memory: memoryHealthy,
                redis: redisHealthy,
                database: databaseHealthy,
                overall,
            });

            return {
                memory: memoryHealthy,
                redis: redisHealthy,
                database: databaseHealthy,
                overall,
            };

        } catch (error) {
            logger.error('Error during cache health check', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                memory: false,
                redis: false,
                database: false,
                overall: false,
            };
        }
    }

    /**
     * Clear all cache layers
     */
    async clearAllCaches(): Promise<void> {
        try {
            // Clear memory cache
            this.memoryCache.clear();

            // Clear Redis cache
            await this.redisCache.clearCache();

            logger.info('All cache layers cleared');

        } catch (error) {
            logger.error('Error clearing cache layers', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Evict old entries from memory cache
     */
    evictOldEntries(maxAge: number = 3600000): number {
        // Default: 1 hour
        const evicted = this.memoryCache.evictOlderThan(maxAge);

        if (evicted > 0) {
            logger.info('Evicted old entries from memory cache', {
                count: evicted,
                maxAge,
            });
        }

        return evicted;
    }

    /**
     * Private method to populate both cache layers
     */
    private async populateCaches(shortCode: string, urlMapping: URLMapping): Promise<void> {
        try {
            // Add to memory cache (synchronous)
            this.memoryCache.set(shortCode, urlMapping);

            // Add to Redis cache (asynchronous, don't wait)
            this.redisCache.cacheUrlMapping(urlMapping).catch(error => {
                this.stats.redis.errors++;
                logger.error('Failed to populate Redis cache', {
                    shortCode,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            });

        } catch (error) {
            logger.error('Error populating caches', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Update statistics
     */
    private updateStats(): void {
        if (this.stats.overall.totalRequests > 0) {
            this.stats.overall.memoryHitRate =
                (this.stats.memory.hits / this.stats.overall.totalRequests) * 100;

            this.stats.overall.redisHitRate =
                (this.stats.redis.hits / this.stats.overall.totalRequests) * 100;

            this.stats.overall.databaseFallbackRate =
                (this.stats.database.queries / this.stats.overall.totalRequests) * 100;
        }
    }

    /**
     * Update database latency average
     */
    private updateDatabaseLatency(latency: number): void {
        const totalQueries = this.stats.database.queries;
        const currentAvg = this.stats.database.avgLatency;

        // Calculate running average
        this.stats.database.avgLatency =
            ((currentAvg * (totalQueries - 1)) + latency) / totalQueries;
    }

    /**
     * Mark URL as expired in cache to prevent repeated DB queries
     */
    async markAsExpired(shortCode: string, ttlSeconds: number = 604800): Promise<void> {
        try {
            // Remove from memory cache
            this.memoryCache.delete(shortCode);

            // Mark as expired in Redis cache with TTL
            await this.redisCache.markAsExpired(shortCode, ttlSeconds);

            logger.debug('URL marked as expired in cache', {
                shortCode,
                ttlSeconds,
            });

        } catch (error) {
            this.stats.redis.errors++;
            logger.error('Error marking URL as expired in cache', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            // Don't throw error - this is an optimization, not critical
        }
    }

    /**
     * Check if URL is marked as expired in cache
     */
    async isMarkedAsExpired(shortCode: string): Promise<boolean> {
        try {
            return await this.redisCache.isMarkedAsExpired(shortCode);
        } catch (error) {
            this.stats.redis.errors++;
            logger.error('Error checking if URL is marked as expired', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false; // If we can't check, assume not expired
        }
    }
}