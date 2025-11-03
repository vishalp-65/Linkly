import { logger } from '../config/logger';

/**
 * LRU (Least Recently Used) Cache implementation
 * Thread-safe in-memory cache with configurable size limit
 */

interface CacheNode<T> {
    key: string;
    value: T;
    prev: CacheNode<T> | null;
    next: CacheNode<T> | null;
    timestamp: number;
}

export interface LRUCacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
    evictions: number;
}

export class LRUCache<T> {
    private maxSize: number;
    private cache: Map<string, CacheNode<T>>;
    private head: CacheNode<T> | null;
    private tail: CacheNode<T> | null;
    private stats: LRUCacheStats;

    constructor(maxSize: number = 10000) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.head = null;
        this.tail = null;
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0,
            maxSize,
            hitRate: 0,
            evictions: 0,
        };

        logger.info('LRU Cache initialized', { maxSize });
    }

    /**
     * Get value from cache
     */
    get(key: string): T | null {
        const node = this.cache.get(key);

        if (!node) {
            this.stats.misses++;
            this.updateHitRate();
            logger.debug('LRU Cache miss', { key });
            return null;
        }

        // Move to front (most recently used)
        this.moveToFront(node);
        node.timestamp = Date.now();

        this.stats.hits++;
        this.updateHitRate();
        logger.debug('LRU Cache hit', { key });

        return node.value;
    }

    /**
     * Set value in cache
     */
    set(key: string, value: T): void {
        const existingNode = this.cache.get(key);

        if (existingNode) {
            // Update existing node
            existingNode.value = value;
            existingNode.timestamp = Date.now();
            this.moveToFront(existingNode);
            logger.debug('LRU Cache updated', { key });
            return;
        }

        // Create new node
        const newNode: CacheNode<T> = {
            key,
            value,
            prev: null,
            next: null,
            timestamp: Date.now(),
        };

        // Add to cache
        this.cache.set(key, newNode);
        this.addToFront(newNode);
        this.stats.size++;

        // Check if we need to evict
        if (this.stats.size > this.maxSize) {
            this.evictLRU();
        }

        logger.debug('LRU Cache set', { key, size: this.stats.size });
    }

    /**
     * Delete value from cache
     */
    delete(key: string): boolean {
        const node = this.cache.get(key);

        if (!node) {
            return false;
        }

        this.removeNode(node);
        this.cache.delete(key);
        this.stats.size--;

        logger.debug('LRU Cache deleted', { key, size: this.stats.size });
        return true;
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Clear all entries from cache
     */
    clear(): void {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.stats.size = 0;
        this.stats.evictions = 0;

        logger.info('LRU Cache cleared');
    }

    /**
     * Get cache statistics
     */
    getStats(): LRUCacheStats {
        return { ...this.stats };
    }

    /**
     * Reset cache statistics
     */
    resetStats(): void {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.stats.hitRate = 0;
        this.stats.evictions = 0;

        logger.info('LRU Cache statistics reset');
    }

    /**
     * Get all keys in cache (for debugging)
     */
    keys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.stats.size;
    }

    /**
     * Get max cache size
     */
    maxCacheSize(): number {
        return this.maxSize;
    }

    /**
     * Resize cache (will evict entries if new size is smaller)
     */
    resize(newMaxSize: number): void {
        const oldMaxSize = this.maxSize;
        this.maxSize = newMaxSize;
        this.stats.maxSize = newMaxSize;

        // Evict entries if new size is smaller
        while (this.stats.size > this.maxSize) {
            this.evictLRU();
        }

        logger.info('LRU Cache resized', {
            oldMaxSize,
            newMaxSize,
            currentSize: this.stats.size,
        });
    }

    /**
     * Get entries sorted by access time (most recent first)
     */
    getEntriesByAccessTime(): Array<{ key: string; value: T; timestamp: number }> {
        const entries: Array<{ key: string; value: T; timestamp: number }> = [];
        let current = this.head;

        while (current) {
            entries.push({
                key: current.key,
                value: current.value,
                timestamp: current.timestamp,
            });
            current = current.next;
        }

        return entries;
    }

    /**
     * Evict entries older than specified age (in milliseconds)
     */
    evictOlderThan(maxAge: number): number {
        const cutoffTime = Date.now() - maxAge;
        const keysToEvict: string[] = [];

        // Find keys to evict
        for (const [key, node] of this.cache) {
            if (node.timestamp < cutoffTime) {
                keysToEvict.push(key);
            }
        }

        // Evict old entries
        for (const key of keysToEvict) {
            this.delete(key);
        }

        if (keysToEvict.length > 0) {
            logger.info('LRU Cache evicted old entries', {
                count: keysToEvict.length,
                maxAge,
                cutoffTime: new Date(cutoffTime).toISOString(),
            });
        }

        return keysToEvict.length;
    }

    /**
     * Move node to front of list (most recently used)
     */
    private moveToFront(node: CacheNode<T>): void {
        if (node === this.head) {
            return; // Already at front
        }

        // Remove from current position
        this.removeNode(node);

        // Add to front
        this.addToFront(node);
    }

    /**
     * Add node to front of list
     */
    private addToFront(node: CacheNode<T>): void {
        node.prev = null;
        node.next = this.head;

        if (this.head) {
            this.head.prev = node;
        }

        this.head = node;

        if (!this.tail) {
            this.tail = node;
        }
    }

    /**
     * Remove node from list
     */
    private removeNode(node: CacheNode<T>): void {
        if (node.prev) {
            node.prev.next = node.next;
        } else {
            this.head = node.next;
        }

        if (node.next) {
            node.next.prev = node.prev;
        } else {
            this.tail = node.prev;
        }
    }

    /**
     * Evict least recently used entry
     */
    private evictLRU(): void {
        if (!this.tail) {
            return;
        }

        const lruNode = this.tail;
        this.removeNode(lruNode);
        this.cache.delete(lruNode.key);
        this.stats.size--;
        this.stats.evictions++;

        logger.debug('LRU Cache evicted entry', {
            key: lruNode.key,
            size: this.stats.size,
            evictions: this.stats.evictions,
        });
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    }
}