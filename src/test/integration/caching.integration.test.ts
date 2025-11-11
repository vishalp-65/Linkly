import { LRUCache } from '../../services/lruCache';
import { URLMapping } from '../../types/database';

/**
 * Integration tests for caching behavior
 * Tests cache hit/miss scenarios, cache invalidation, and TTL behavior
 * Requirements: 2.5, 7.3
 * 
 * Note: These tests focus on the LRU cache layer which doesn't require external dependencies.
 * Full multi-layer cache tests would require Redis and PostgreSQL to be running.
 */

describe('Caching Integration Tests', () => {
    const testUrlMapping: URLMapping = {
        short_code: 'test123',
        long_url: 'https://example.com/test',
        long_url_hash: 'hash123',
        created_at: new Date(),
        expires_at: null,
        user_id: null,
        is_custom_alias: false,
        is_deleted: false,
        last_accessed_at: null,
        deleted_at: null,
        access_count: 0,
    };

    describe('LRU Cache Hit/Miss Scenarios', () => {
        let cache: LRUCache<URLMapping>;

        beforeEach(() => {
            cache = new LRUCache<URLMapping>(100);
        });

        it('should return cache miss when URL not in cache', () => {
            const result = cache.get('nonexistent');

            expect(result).toBeNull();

            const stats = cache.getStats();
            expect(stats.misses).toBe(1);
            expect(stats.hits).toBe(0);
            expect(stats.hitRate).toBe(0);
        });

        it('should return cache hit when URL is in cache', () => {
            // Add to cache
            cache.set(testUrlMapping.short_code, testUrlMapping);

            // Retrieve from cache
            const result = cache.get(testUrlMapping.short_code);

            expect(result).not.toBeNull();
            expect(result?.short_code).toBe(testUrlMapping.short_code);
            expect(result?.long_url).toBe(testUrlMapping.long_url);

            const stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(0);
            expect(stats.hitRate).toBe(100);
        });

        it('should track hit rate accurately over multiple operations', () => {
            // Add 3 URLs to cache
            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            cache.set('url3', { ...testUrlMapping, short_code: 'url3' });

            // 6 hits
            cache.get('url1');
            cache.get('url2');
            cache.get('url3');
            cache.get('url1');
            cache.get('url2');
            cache.get('url3');

            // 4 misses
            cache.get('url4');
            cache.get('url5');
            cache.get('url6');
            cache.get('url7');

            const stats = cache.getStats();
            expect(stats.hits).toBe(6);
            expect(stats.misses).toBe(4);
            expect(stats.hitRate).toBe(60); // 6 hits out of 10 total = 60%
        });

        it('should update existing entries without increasing size', () => {
            cache.set('url1', { ...testUrlMapping, short_code: 'url1', long_url: 'https://example.com/v1' });
            expect(cache.size()).toBe(1);

            // Update same key
            cache.set('url1', { ...testUrlMapping, short_code: 'url1', long_url: 'https://example.com/v2' });
            expect(cache.size()).toBe(1);

            const result = cache.get('url1');
            expect(result?.long_url).toBe('https://example.com/v2');
        });
    });

    describe('Cache Invalidation', () => {
        let cache: LRUCache<URLMapping>;

        beforeEach(() => {
            cache = new LRUCache<URLMapping>(100);
        });

        it('should remove URL from cache on delete', () => {
            cache.set(testUrlMapping.short_code, testUrlMapping);
            expect(cache.has(testUrlMapping.short_code)).toBe(true);

            const deleted = cache.delete(testUrlMapping.short_code);
            expect(deleted).toBe(true);
            expect(cache.has(testUrlMapping.short_code)).toBe(false);
            expect(cache.size()).toBe(0);
        });

        it('should return false when deleting non-existent key', () => {
            const deleted = cache.delete('nonexistent');
            expect(deleted).toBe(false);
        });

        it('should clear all entries from cache', () => {
            // Add multiple entries
            for (let i = 0; i < 10; i++) {
                cache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            expect(cache.size()).toBe(10);

            cache.clear();

            expect(cache.size()).toBe(0);
            expect(cache.keys()).toEqual([]);
        });
    });

    describe('LRU Eviction Policy', () => {
        it('should evict least recently used entry when cache is full', () => {
            const smallCache = new LRUCache<URLMapping>(3);

            // Add 3 entries (cache is now full)
            smallCache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            smallCache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            smallCache.set('url3', { ...testUrlMapping, short_code: 'url3' });

            expect(smallCache.size()).toBe(3);

            // Add 4th entry (should evict url1 - least recently used)
            smallCache.set('url4', { ...testUrlMapping, short_code: 'url4' });

            expect(smallCache.size()).toBe(3);
            expect(smallCache.has('url1')).toBe(false); // Evicted
            expect(smallCache.has('url2')).toBe(true);
            expect(smallCache.has('url3')).toBe(true);
            expect(smallCache.has('url4')).toBe(true);

            const stats = smallCache.getStats();
            expect(stats.evictions).toBe(1);
        });

        it('should update LRU order on access', () => {
            const smallCache = new LRUCache<URLMapping>(3);

            // Add 3 entries
            smallCache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            smallCache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            smallCache.set('url3', { ...testUrlMapping, short_code: 'url3' });

            // Access url1 (moves it to front)
            smallCache.get('url1');

            // Add url4 (should evict url2, not url1)
            smallCache.set('url4', { ...testUrlMapping, short_code: 'url4' });

            expect(smallCache.has('url1')).toBe(true); // Still in cache
            expect(smallCache.has('url2')).toBe(false); // Evicted
            expect(smallCache.has('url3')).toBe(true);
            expect(smallCache.has('url4')).toBe(true);
        });

        it('should evict multiple entries when adding many items', () => {
            const smallCache = new LRUCache<URLMapping>(5);

            // Fill cache
            for (let i = 0; i < 5; i++) {
                smallCache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            expect(smallCache.size()).toBe(5);

            // Add 3 more (should evict first 3)
            for (let i = 5; i < 8; i++) {
                smallCache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            expect(smallCache.size()).toBe(5);
            expect(smallCache.has('url0')).toBe(false);
            expect(smallCache.has('url1')).toBe(false);
            expect(smallCache.has('url2')).toBe(false);
            expect(smallCache.has('url3')).toBe(true);
            expect(smallCache.has('url7')).toBe(true);

            const stats = smallCache.getStats();
            expect(stats.evictions).toBe(3);
        });
    });

    describe('Cache Statistics', () => {
        let cache: LRUCache<URLMapping>;

        beforeEach(() => {
            cache = new LRUCache<URLMapping>(100);
        });

        it('should track cache size correctly', () => {
            expect(cache.size()).toBe(0);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            expect(cache.size()).toBe(1);

            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            expect(cache.size()).toBe(2);

            cache.delete('url1');
            expect(cache.size()).toBe(1);
        });

        it('should provide accurate statistics', () => {
            // Perform various operations
            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });

            cache.get('url1'); // hit
            cache.get('url2'); // hit
            cache.get('url3'); // miss
            cache.get('url1'); // hit

            const stats = cache.getStats();

            expect(stats.hits).toBe(3);
            expect(stats.misses).toBe(1);
            expect(stats.size).toBe(2);
            expect(stats.maxSize).toBe(100);
            expect(stats.hitRate).toBe(75); // 3 hits out of 4 total
            expect(stats.evictions).toBe(0);
        });

        it('should reset statistics correctly', () => {
            // Perform operations
            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.get('url1');
            cache.get('url2');

            let stats = cache.getStats();
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(1);

            // Reset stats
            cache.resetStats();

            stats = cache.getStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.hitRate).toBe(0);
            expect(stats.evictions).toBe(0);
            expect(stats.size).toBe(1); // Size is not reset, only stats
        });
    });

    describe('Cache Age-Based Eviction', () => {
        it('should evict entries older than specified age', async () => {
            const cache = new LRUCache<URLMapping>(10);

            // Add old entries
            cache.set('old1', { ...testUrlMapping, short_code: 'old1' });
            cache.set('old2', { ...testUrlMapping, short_code: 'old2' });

            // Wait 100ms
            await new Promise(resolve => setTimeout(resolve, 100));

            // Add new entries
            cache.set('new1', { ...testUrlMapping, short_code: 'new1' });
            cache.set('new2', { ...testUrlMapping, short_code: 'new2' });

            expect(cache.size()).toBe(4);

            // Evict entries older than 50ms
            const evicted = cache.evictOlderThan(50);

            expect(evicted).toBe(2);
            expect(cache.size()).toBe(2);
            expect(cache.has('old1')).toBe(false);
            expect(cache.has('old2')).toBe(false);
            expect(cache.has('new1')).toBe(true);
            expect(cache.has('new2')).toBe(true);
        });

        it('should not evict entries if all are recent', async () => {
            const cache = new LRUCache<URLMapping>(10);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });

            // Try to evict entries older than 1 hour
            const evicted = cache.evictOlderThan(3600000);

            expect(evicted).toBe(0);
            expect(cache.size()).toBe(2);
        });
    });

    describe('Cache Resize', () => {
        it('should resize cache and evict entries if new size is smaller', () => {
            const cache = new LRUCache<URLMapping>(10);

            // Fill cache with 10 entries
            for (let i = 0; i < 10; i++) {
                cache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            expect(cache.size()).toBe(10);
            expect(cache.maxCacheSize()).toBe(10);

            // Resize to 5 (should evict 5 oldest entries)
            cache.resize(5);

            expect(cache.size()).toBe(5);
            expect(cache.maxCacheSize()).toBe(5);

            // First 5 should be evicted (LRU)
            expect(cache.has('url0')).toBe(false);
            expect(cache.has('url4')).toBe(false);
            expect(cache.has('url5')).toBe(true);
            expect(cache.has('url9')).toBe(true);
        });

        it('should allow resize to larger size without eviction', () => {
            const cache = new LRUCache<URLMapping>(5);

            for (let i = 0; i < 5; i++) {
                cache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            expect(cache.size()).toBe(5);

            // Resize to 10
            cache.resize(10);

            expect(cache.size()).toBe(5);
            expect(cache.maxCacheSize()).toBe(10);

            // All entries should still be present
            for (let i = 0; i < 5; i++) {
                expect(cache.has(`url${i}`)).toBe(true);
            }
        });
    });

    describe('Cache Entry Ordering', () => {
        it('should return entries sorted by access time (most recent first)', () => {
            const cache = new LRUCache<URLMapping>(10);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            cache.set('url3', { ...testUrlMapping, short_code: 'url3' });

            // Access url1 (moves to front)
            cache.get('url1');

            const entries = cache.getEntriesByAccessTime();

            expect(entries.length).toBe(3);
            expect(entries[0].key).toBe('url1'); // Most recently accessed
            expect(entries[1].key).toBe('url3');
            expect(entries[2].key).toBe('url2'); // Least recently accessed
        });

        it('should update timestamp on set', () => {
            const cache = new LRUCache<URLMapping>(10);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            const entries1 = cache.getEntriesByAccessTime();
            const timestamp1 = entries1[0].timestamp;

            // Update the same key
            cache.set('url1', { ...testUrlMapping, short_code: 'url1', long_url: 'https://updated.com' });
            const entries2 = cache.getEntriesByAccessTime();
            const timestamp2 = entries2[0].timestamp;

            expect(timestamp2).toBeGreaterThanOrEqual(timestamp1);
        });
    });

    describe('Cache Performance', () => {
        it('should maintain sub-millisecond latency for cache operations', () => {
            const cache = new LRUCache<URLMapping>(1000);

            // Populate cache
            for (let i = 0; i < 100; i++) {
                cache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            // Measure get performance
            const latencies: number[] = [];
            for (let i = 0; i < 100; i++) {
                const start = Date.now();
                cache.get(`url${i}`);
                const latency = Date.now() - start;
                latencies.push(latency);
            }

            const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            expect(avgLatency).toBeLessThan(1); // Should be sub-millisecond
        });

        it('should handle large number of entries efficiently', () => {
            const cache = new LRUCache<URLMapping>(10000);

            const start = Date.now();

            // Add 10,000 entries
            for (let i = 0; i < 10000; i++) {
                cache.set(`url${i}`, { ...testUrlMapping, short_code: `url${i}` });
            }

            const duration = Date.now() - start;

            expect(cache.size()).toBe(10000);
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
        });
    });

    describe('Cache Keys Management', () => {
        it('should return all keys in cache', () => {
            const cache = new LRUCache<URLMapping>(10);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });
            cache.set('url2', { ...testUrlMapping, short_code: 'url2' });
            cache.set('url3', { ...testUrlMapping, short_code: 'url3' });

            const keys = cache.keys();

            expect(keys).toHaveLength(3);
            expect(keys).toContain('url1');
            expect(keys).toContain('url2');
            expect(keys).toContain('url3');
        });

        it('should return empty array when cache is empty', () => {
            const cache = new LRUCache<URLMapping>(10);

            const keys = cache.keys();

            expect(keys).toEqual([]);
        });

        it('should check if key exists in cache', () => {
            const cache = new LRUCache<URLMapping>(10);

            cache.set('url1', { ...testUrlMapping, short_code: 'url1' });

            expect(cache.has('url1')).toBe(true);
            expect(cache.has('url2')).toBe(false);
        });
    });
});
