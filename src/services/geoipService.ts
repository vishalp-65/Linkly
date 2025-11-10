import axios from "axios"
import { logger } from "../config/logger"

export interface GeoIPData {
    country_code: string | null
    country_name: string | null
    region: string | null
    city: string | null
    latitude: number | null
    longitude: number | null
}

/**
 * GeoIP Service
 * Provides IP geolocation lookup with caching and rate limiting
 */
class GeoIPService {
    private cache: Map<string, GeoIPData> = new Map()
    private readonly cacheTTL = 24 * 60 * 60 * 1000 // 24 hours
    private readonly maxCacheSize = 10000
    private cacheTimestamps: Map<string, number> = new Map()

    // Rate limiting
    private requestQueue: Array<() => Promise<void>> = []
    private isProcessingQueue = false
    private readonly requestDelay = 1400 // 1.4 seconds between requests (to stay under 45 req/min)
    private lastRequestTime = 0

    /**
     * Lookup geolocation data for an IP address with caching and rate limiting
     */
    async lookup(ipAddress: string | null | undefined): Promise<GeoIPData> {
        // Return default for invalid IPs
        if (!ipAddress || ipAddress === "unknown" || this.isPrivateIP(ipAddress)) {
            return this.getDefaultGeoData()
        }

        // Check cache first
        const cached = this.getFromCache(ipAddress)
        if (cached) {
            logger.debug("GeoIP cache hit", { ipAddress })
            return cached
        }

        // If cache miss, add to queue for async lookup
        // Don't block the request - return default immediately
        this.queueLookup(ipAddress).catch((error) => {
            logger.warn("Failed to queue GeoIP lookup", {
                ipAddress,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        })

        return this.getDefaultGeoData()
    }

    /**
     * Synchronous lookup with timeout (for critical paths)
     */
    async lookupSync(ipAddress: string | null | undefined, timeoutMs: number = 2000): Promise<GeoIPData> {
        // Return default for invalid IPs
        if (!ipAddress || ipAddress === "unknown" || this.isPrivateIP(ipAddress)) {
            return this.getDefaultGeoData()
        }

        // Check cache first
        const cached = this.getFromCache(ipAddress)
        if (cached) {
            return cached
        }

        try {
            // Perform lookup with timeout
            const result = await Promise.race([
                this.performLookup(ipAddress),
                new Promise<GeoIPData>((_, reject) =>
                    setTimeout(() => reject(new Error("GeoIP timeout")), timeoutMs)
                )
            ])

            return result

        } catch (error) {
            logger.debug("GeoIP sync lookup failed", {
                ipAddress,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return this.getDefaultGeoData()
        }
    }

    /**
     * Queue a lookup for async processing
     */
    private async queueLookup(ipAddress: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push(async () => {
                try {
                    await this.performLookup(ipAddress)
                    resolve()
                } catch (error) {
                    reject(error)
                }
            })

            // Start processing queue if not already running
            if (!this.isProcessingQueue) {
                this.processQueue().catch((error) => {
                    logger.error("Error processing GeoIP queue", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }
        })
    }

    /**
     * Process queued requests with rate limiting
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return
        }

        this.isProcessingQueue = true

        while (this.requestQueue.length > 0) {
            const now = Date.now()
            const timeSinceLastRequest = now - this.lastRequestTime

            // Rate limit: wait if needed
            if (timeSinceLastRequest < this.requestDelay) {
                await this.delay(this.requestDelay - timeSinceLastRequest)
            }

            const request = this.requestQueue.shift()
            if (request) {
                try {
                    this.lastRequestTime = Date.now()
                    await request()
                } catch (error) {
                    logger.warn("Failed to process GeoIP request", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                }
            }
        }

        this.isProcessingQueue = false
    }

    /**
     * Perform actual GeoIP lookup
     */
    private async performLookup(ipAddress: string): Promise<GeoIPData> {
        try {
            const response = await axios.get(
                `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,lat,lon`,
                {
                    timeout: 3000,
                    headers: {
                        'User-Agent': 'URL-Shortener-Service/1.0'
                    }
                }
            )

            if (response.data.status === "success") {
                const geoData: GeoIPData = {
                    country_code: response.data.countryCode || null,
                    country_name: response.data.country || null,
                    region: response.data.regionName || null,
                    city: response.data.city || null,
                    latitude: response.data.lat || null,
                    longitude: response.data.lon || null
                }

                // Cache the result
                this.addToCache(ipAddress, geoData)

                logger.debug("GeoIP lookup successful", {
                    ipAddress,
                    country: geoData.country_code
                })

                return geoData
            } else {
                logger.warn("GeoIP lookup failed", {
                    ipAddress,
                    reason: response.data.message
                })
                return this.getDefaultGeoData()
            }

        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === "ECONNABORTED") {
                    logger.debug("GeoIP lookup timeout", { ipAddress })
                } else if (error.response?.status === 429) {
                    logger.warn("GeoIP rate limit exceeded", { ipAddress })
                } else {
                    logger.error("GeoIP API error", {
                        ipAddress,
                        status: error.response?.status,
                        error: error.message
                    })
                }
            } else {
                logger.error("GeoIP lookup error", {
                    ipAddress,
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            }
            return this.getDefaultGeoData()
        }
    }

    /**
     * Batch lookup multiple IP addresses
     */
    async batchLookup(ipAddresses: string[]): Promise<Map<string, GeoIPData>> {
        const results = new Map<string, GeoIPData>()

        // Check cache first
        const uncachedIPs: string[] = []
        for (const ip of ipAddresses) {
            const cached = this.getFromCache(ip)
            if (cached) {
                results.set(ip, cached)
            } else if (!this.isPrivateIP(ip) && ip !== "unknown") {
                uncachedIPs.push(ip)
            } else {
                results.set(ip, this.getDefaultGeoData())
            }
        }

        // Queue uncached IPs for async lookup
        for (const ip of uncachedIPs) {
            this.queueLookup(ip).catch((error) => {
                logger.warn("Failed to queue batch GeoIP lookup", {
                    ip,
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            })
            // Return default for now, will be cached for future requests
            results.set(ip, this.getDefaultGeoData())
        }

        return results
    }

    /**
     * Check if IP is private/local
     */
    private isPrivateIP(ip: string): boolean {
        // Remove IPv6 prefix if present
        const cleanIP = ip.replace(/^::ffff:/, "")

        // Check for localhost
        if (cleanIP === "127.0.0.1" || cleanIP === "::1" || cleanIP === "localhost") {
            return true
        }

        // Check for private IP ranges
        const parts = cleanIP.split(".")
        if (parts.length !== 4) {
            return false // Not a valid IPv4
        }

        const first = parseInt(parts[0])
        const second = parseInt(parts[1])

        // 10.0.0.0 - 10.255.255.255
        if (first === 10) return true

        // 172.16.0.0 - 172.31.255.255
        if (first === 172 && second >= 16 && second <= 31) return true

        // 192.168.0.0 - 192.168.255.255
        if (first === 192 && second === 168) return true

        return false
    }

    /**
     * Get default geo data for unknown locations
     */
    private getDefaultGeoData(): GeoIPData {
        return {
            country_code: null,
            country_name: null,
            region: null,
            city: null,
            latitude: null,
            longitude: null
        }
    }

    /**
     * Get data from cache
     */
    private getFromCache(ipAddress: string): GeoIPData | null {
        const cached = this.cache.get(ipAddress)
        const timestamp = this.cacheTimestamps.get(ipAddress)

        if (cached && timestamp) {
            const age = Date.now() - timestamp
            if (age < this.cacheTTL) {
                return cached
            } else {
                // Expired, remove from cache
                this.cache.delete(ipAddress)
                this.cacheTimestamps.delete(ipAddress)
            }
        }

        return null
    }

    /**
     * Add data to cache with LRU eviction
     */
    private addToCache(ipAddress: string, data: GeoIPData): void {
        // Implement LRU by removing oldest entries if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            // Find and remove oldest entry
            let oldestIP: string | null = null
            let oldestTime = Date.now()

            for (const [ip, timestamp] of this.cacheTimestamps.entries()) {
                if (timestamp < oldestTime) {
                    oldestTime = timestamp
                    oldestIP = ip
                }
            }

            if (oldestIP) {
                this.cache.delete(oldestIP)
                this.cacheTimestamps.delete(oldestIP)
            }
        }

        this.cache.set(ipAddress, data)
        this.cacheTimestamps.set(ipAddress, Date.now())
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear()
        this.cacheTimestamps.clear()
        logger.info("GeoIP cache cleared")
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number
        maxSize: number
        utilizationPercent: number
        queueSize: number
        isProcessing: boolean
    } {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            utilizationPercent: (this.cache.size / this.maxCacheSize) * 100,
            queueSize: this.requestQueue.length,
            isProcessing: this.isProcessingQueue
        }
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Warm up cache with common IPs
     */
    async warmUpCache(ipAddresses: string[]): Promise<void> {
        logger.info("Warming up GeoIP cache", { count: ipAddresses.length })

        for (const ip of ipAddresses) {
            if (!this.isPrivateIP(ip) && ip !== "unknown") {
                this.queueLookup(ip).catch(() => {
                    // Ignore errors during warmup
                })
            }
        }
    }
}

export const geoipService = new GeoIPService()
export default geoipService