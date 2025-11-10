import { Request, Response } from "express"
import { URLMapping } from "../types/database"
import { MultiLayerCacheService } from "./multiLayerCacheService"
import { URLRepository } from "../repositories/URLRepository"
import { analyticsEventProducer } from "./analyticsEventProducer"
import { directAnalyticsService } from "./directAnalyticsService"
import { geoipService } from "./geoipService"
import { logger } from "../config/logger"
import { metricsService } from "./metricsService"
import {
    addBusinessContext,
    createChildSpan
} from "../middleware/tracingMiddleware"
import { SpanStatusCode } from "@opentelemetry/api"

/**
 * URL Redirect Service
 * Handles URL redirects with expiry checking and access tracking
 */

export interface RedirectResult {
    success: boolean
    statusCode: number
    longUrl?: string
    shortCode: string
    error?: string
    latency: number
    cacheSource?: "memory" | "redis" | "database" | "not_found"
}

export interface RedirectStats {
    totalRedirects: number
    successfulRedirects: number
    notFoundErrors: number
    expiredErrors: number
    serverErrors: number
    averageLatency: number
    cacheHitRate: number
}

export class URLRedirectService {
    private cacheService: MultiLayerCacheService
    private urlRepository: URLRepository
    private analyticsService: typeof analyticsEventProducer
    private stats: RedirectStats

    constructor() {
        this.cacheService = new MultiLayerCacheService()
        this.urlRepository = new URLRepository()
        this.analyticsService = analyticsEventProducer
        this.stats = {
            totalRedirects: 0,
            successfulRedirects: 0,
            notFoundErrors: 0,
            expiredErrors: 0,
            serverErrors: 0,
            averageLatency: 0,
            cacheHitRate: 0
        }

        logger.info("URL Redirect Service initialized")
    }

    /**
     * Handle URL redirect request
     */
    async handleRedirect(
        req: Request,
        res: Response,
        shortCode: string
    ): Promise<RedirectResult> {
        const startTime = Date.now()
        this.stats.totalRedirects++

        // Add business context to current span
        addBusinessContext({
            shortCode,
            operation: "redirect_url"
        })

        try {
            // Create child span for cache lookup
            const lookupSpan = createChildSpan("cache.lookup_url", {
                "url_shortener.short_code": shortCode,
                "cache.operation": "lookup"
            })

            // Lookup URL mapping using multi-layer cache
            const lookupResult = await this.cacheService.lookupUrl(shortCode)
            const urlMapping = lookupResult.urlMapping

            // Add cache result to span
            lookupSpan.setAttributes({
                "cache.hit": urlMapping !== null,
                "cache.source": lookupResult.source,
                "cache.latency_ms": lookupResult.latency
            })
            lookupSpan.setStatus({ code: SpanStatusCode.OK })
            lookupSpan.end()

            // Add cache context to business span
            addBusinessContext({
                cacheHit: lookupResult.source !== "database"
            })

            // URL not found
            if (!urlMapping) {
                this.stats.notFoundErrors++
                const latency = Date.now() - startTime
                this.updateAverageLatency(latency)
                metricsService.recordUrlRedirect("404", false, latency)

                logger.info("URL not found", {
                    shortCode,
                    ip: this.getClientIP(req),
                    userAgent: req.get("User-Agent"),
                    latency
                })

                // Prevent caching of 404 responses
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
                res.setHeader('Pragma', 'no-cache')
                res.setHeader('Expires', '0')

                res.status(404).json({
                    error: "URL not found",
                    message: "The requested short URL does not exist",
                    shortCode
                })

                return {
                    success: false,
                    statusCode: 404,
                    shortCode,
                    error: "URL not found",
                    latency,
                    cacheSource: lookupResult.source
                }
            }

            // Check if URL is soft deleted
            if (urlMapping.is_deleted) {
                this.stats.notFoundErrors++
                const latency = Date.now() - startTime
                this.updateAverageLatency(latency)
                metricsService.recordUrlRedirect("404", false, latency)

                logger.info("URL is deleted", {
                    shortCode,
                    deletedAt: urlMapping.deleted_at,
                    ip: this.getClientIP(req),
                    latency
                })

                // Prevent caching of 404 responses
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
                res.setHeader('Pragma', 'no-cache')
                res.setHeader('Expires', '0')

                res.status(404).json({
                    error: "URL not found",
                    message: "The requested short URL does not exist",
                    shortCode
                })

                return {
                    success: false,
                    statusCode: 404,
                    shortCode,
                    error: "URL deleted",
                    latency,
                    cacheSource: lookupResult.source
                }
            }

            // Check if URL has expired
            if (this.isExpired(urlMapping)) {
                this.stats.expiredErrors++
                const latency = Date.now() - startTime
                this.updateAverageLatency(latency)
                metricsService.recordUrlRedirect("410", false, latency)

                // Mark expired URL in cache to prevent repeated DB queries
                this.markExpiredInCache(shortCode).catch((error) => {
                    logger.warn("Failed to mark expired URL in cache", {
                        shortCode,
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })

                logger.info("URL has expired", {
                    shortCode,
                    expiresAt: urlMapping.expires_at,
                    ip: this.getClientIP(req),
                    latency
                })

                // Prevent caching of 410 responses
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
                res.setHeader('Pragma', 'no-cache')
                res.setHeader('Expires', '0')

                res.status(410).json({
                    error: "URL expired",
                    message: "The requested short URL has expired",
                    shortCode,
                    expiresAt: urlMapping.expires_at
                })

                return {
                    success: false,
                    statusCode: 410,
                    shortCode,
                    error: "URL expired",
                    latency,
                    cacheSource: lookupResult.source
                }
            }

            // Perform redirect
            const latency = Date.now() - startTime
            this.stats.successfulRedirects++
            this.updateAverageLatency(latency)
            this.updateCacheHitRate(lookupResult.source)

            // Record metrics
            const cacheHit = lookupResult.source !== "database"
            metricsService.recordUrlRedirect("301", cacheHit, latency)

            // CRITICAL: Set cache-control headers to prevent browser caching of redirects
            // This ensures every click is tracked for analytics
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')

            // CRITICAL: Perform HTTP redirect IMMEDIATELY before any analytics processing
            // This ensures fast user experience regardless of analytics status
            res.redirect(301, urlMapping.long_url)

            logger.info("URL redirect successful", {
                shortCode,
                longUrl: urlMapping.long_url,
                ip: this.getClientIP(req),
                cacheSource: lookupResult.source,
                latency
            })

            // Process analytics asynchronously AFTER redirect response is sent
            // Use setImmediate to ensure this runs after response is flushed
            setImmediate(() => {
                this.processAnalyticsAsync(req, shortCode, urlMapping, lookupResult.source)
            })

            return {
                success: true,
                statusCode: 301,
                longUrl: urlMapping.long_url,
                shortCode,
                latency,
                cacheSource: lookupResult.source
            }
        } catch (error) {
            this.stats.serverErrors++
            const latency = Date.now() - startTime
            this.updateAverageLatency(latency)

            metricsService.recordUrlRedirect("500", false, latency)
            metricsService.recordError("redirect_error", "url_redirect_service")

            logger.error("Error handling URL redirect", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined,
                ip: this.getClientIP(req),
                latency
            })

            // Prevent caching of 500 responses
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
            res.setHeader('Pragma', 'no-cache')
            res.setHeader('Expires', '0')

            res.status(500).json({
                error: "Internal server error",
                message: "An error occurred while processing the redirect",
                shortCode
            })

            return {
                success: false,
                statusCode: 500,
                shortCode,
                error: "Internal server error",
                latency
            }
        }
    }

    /**
     * Process analytics asynchronously after redirect
     * This ensures analytics never blocks the redirect response
     */
    private async processAnalyticsAsync(
        req: Request,
        shortCode: string,
        urlMapping: URLMapping,
        cacheSource: string
    ): Promise<void> {
        try {
            // Create child span for analytics
            const analyticsSpan = createChildSpan("analytics.publish_event", {
                "url_shortener.short_code": shortCode,
                "analytics.event_type": "click"
            })

            // Extract analytics data from request
            const userAgent = req.get("User-Agent") || ""
            const deviceInfo = this.parseUserAgent(userAgent)
            const ipAddress = this.getClientIP(req)

            // Get geolocation data with timeout (non-blocking)
            const geoData = await this.getGeoDataWithTimeout(ipAddress, 1500)

            // Prepare analytics data
            const analyticsData = {
                short_code: shortCode,
                ip_address: ipAddress,
                user_agent: userAgent,
                referrer: req.get("Referer"),
                device_type: deviceInfo.device,
                browser: deviceInfo.browser,
                os: deviceInfo.os,
                country_code: geoData.country_code || undefined,
                region: geoData.region || undefined,
                city: geoData.city || undefined,
                clicked_at: new Date()
            }

            // Determine which service to use
            const isKafkaReady = this.analyticsService.getBufferStats().isProducerReady

            logger.debug("Publishing analytics event", {
                shortCode,
                method: isKafkaReady ? "Kafka" : "Direct",
                device: deviceInfo.device,
                browser: deviceInfo.browser,
                country: analyticsData.country_code || "Unknown"
            })

            // Publish to analytics service (Kafka or Direct DB)
            // This will handle WebSocket emission internally
            const publishPromise = isKafkaReady
                ? this.analyticsService.publishClickEvent(analyticsData)
                : directAnalyticsService.publishClickEvent(analyticsData)

            await publishPromise

            // Update access tracking (non-critical, don't wait)
            this.updateAccessTracking(shortCode, urlMapping).catch((error) => {
                logger.warn("Failed to update access tracking", {
                    shortCode,
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            })

            // Invalidate analytics cache after successful publish
            this.invalidateAnalyticsCache(shortCode).catch((error) => {
                logger.warn("Failed to invalidate analytics cache", {
                    shortCode,
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            })

            analyticsSpan.setStatus({ code: SpanStatusCode.OK })
            analyticsSpan.end()

            logger.debug("Analytics event processed successfully", { shortCode })

        } catch (error) {
            logger.error("Failed to process analytics", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            // Don't throw - analytics failures shouldn't affect anything at this point
        }
    }

    /**
     * Get geolocation data with timeout
     * Uses synchronous lookup for immediate results
     */
    private async getGeoDataWithTimeout(ipAddress: string, timeoutMs: number): Promise<any> {
        try {
            // Use lookupSync for immediate results with timeout
            return await geoipService.lookupSync(ipAddress, timeoutMs)
        } catch (error) {
            logger.debug("GeoIP lookup failed or timed out", {
                ipAddress,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return {
                country_code: null,
                country_name: null,
                region: null,
                city: null,
                latitude: null,
                longitude: null
            }
        }
    }

    /**
     * Resolve URL without performing redirect (for API endpoints)
     */
    async resolveUrl(shortCode: string): Promise<{
        urlMapping: URLMapping | null
        status: "found" | "not_found" | "expired" | "deleted"
        latency: number
    }> {
        const startTime = Date.now()

        try {
            const lookupResult = await this.cacheService.lookupUrl(shortCode)
            const urlMapping = lookupResult.urlMapping
            const latency = Date.now() - startTime

            if (!urlMapping) {
                return { urlMapping: null, status: "not_found", latency }
            }

            if (urlMapping.is_deleted) {
                return { urlMapping: null, status: "deleted", latency }
            }

            if (this.isExpired(urlMapping)) {
                return { urlMapping: null, status: "expired", latency }
            }

            return { urlMapping, status: "found", latency }
        } catch (error) {
            logger.error("Error resolving URL", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    /**
     * Batch resolve multiple URLs
     */
    async batchResolveUrls(shortCodes: string[]): Promise<
        Map<string, {
            urlMapping: URLMapping | null
            status: "found" | "not_found" | "expired" | "deleted"
        }>
    > {
        const results = new Map()
        const concurrency = 10
        const chunks = this.chunkArray(shortCodes, concurrency)

        for (const chunk of chunks) {
            const promises = chunk.map(async (shortCode) => {
                try {
                    const result = await this.resolveUrl(shortCode)
                    return { shortCode, result }
                } catch (error) {
                    logger.error("Error in batch resolve", {
                        shortCode,
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                    return {
                        shortCode,
                        result: {
                            urlMapping: null,
                            status: "not_found" as const,
                            latency: 0
                        }
                    }
                }
            })

            const chunkResults = await Promise.all(promises)

            for (const { shortCode, result } of chunkResults) {
                results.set(shortCode, {
                    urlMapping: result.urlMapping,
                    status: result.status
                })
            }
        }

        return results
    }

    /**
     * Get redirect service statistics
     */
    getStats(): RedirectStats {
        return { ...this.stats }
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
            cacheHitRate: 0
        }
        logger.info("Redirect service statistics reset")
    }

    /**
     * Get cache service for external access
     */
    getCacheService(): MultiLayerCacheService {
        return this.cacheService
    }

    /**
     * Warm up cache with popular URLs
     */
    async warmUpCache(limit: number = 1000): Promise<void> {
        await this.cacheService.warmUpCache(limit)
    }

    /**
     * Health check for redirect service
     */
    async healthCheck(): Promise<{
        service: boolean
        cache: {
            memory: boolean
            redis: boolean
            database: boolean
            overall: boolean
        }
        analytics: {
            service: boolean
            kafka: boolean
            bufferSize: number
            bufferUtilization: number
        }
    }> {
        try {
            const cacheHealth = await this.cacheService.healthCheck()
            const bufferStats = this.analyticsService.getBufferStats()

            return {
                service: true,
                cache: cacheHealth,
                analytics: {
                    service: bufferStats.isProducerReady,
                    kafka: bufferStats.isProducerReady,
                    bufferSize: bufferStats.bufferSize,
                    bufferUtilization: bufferStats.bufferSize / bufferStats.maxBufferSize
                }
            }
        } catch (error) {
            logger.error("Redirect service health check failed", {
                error: error instanceof Error ? error.message : "Unknown error"
            })

            return {
                service: false,
                cache: {
                    memory: false,
                    redis: false,
                    database: false,
                    overall: false
                },
                analytics: {
                    service: false,
                    kafka: false,
                    bufferSize: 0,
                    bufferUtilization: 0
                }
            }
        }
    }

    /**
     * Check if URL mapping has expired
     */
    private isExpired(urlMapping: URLMapping): boolean {
        if (!urlMapping.expires_at) {
            return false
        }
        const now = new Date()
        const expiryTime = new Date(urlMapping.expires_at)
        return now >= expiryTime
    }

    /**
     * Mark expired URL in cache to prevent repeated DB queries
     */
    private async markExpiredInCache(shortCode: string): Promise<void> {
        try {
            await this.cacheService.markAsExpired(shortCode, 7 * 24 * 60 * 60)
            logger.debug("Marked expired URL in cache", { shortCode })
        } catch (error) {
            logger.error("Failed to mark expired URL in cache", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Update access tracking asynchronously
     */
    private async updateAccessTracking(
        shortCode: string,
        urlMapping: URLMapping
    ): Promise<void> {
        try {
            await this.urlRepository.incrementAccessCount(shortCode)

            const updatedMapping: URLMapping = {
                ...urlMapping,
                access_count: urlMapping.access_count + 1,
                last_accessed_at: new Date()
            }

            await this.cacheService.updateCache(shortCode, updatedMapping)

            logger.debug("Access tracking updated", {
                shortCode,
                newAccessCount: updatedMapping.access_count
            })
        } catch (error) {
            logger.error("Failed to update access tracking", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
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
            "unknown"
        )
    }

    /**
     * Parse user agent to extract device, browser, and OS information
     */
    private parseUserAgent(userAgent: string): {
        device: string
        browser: string
        os: string
    } {
        const ua = userAgent.toLowerCase()

        let device = "Desktop"
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
            device = "Mobile"
        } else if (ua.includes("tablet") || ua.includes("ipad")) {
            device = "Tablet"
        }

        let browser = "Unknown"
        if (ua.includes("chrome") && !ua.includes("edg")) {
            browser = "Chrome"
        } else if (ua.includes("firefox")) {
            browser = "Firefox"
        } else if (ua.includes("safari") && !ua.includes("chrome")) {
            browser = "Safari"
        } else if (ua.includes("edg")) {
            browser = "Edge"
        } else if (ua.includes("opera") || ua.includes("opr")) {
            browser = "Opera"
        } else if (ua.includes("msie") || ua.includes("trident")) {
            browser = "Internet Explorer"
        }

        let os = "Unknown"
        if (ua.includes("windows")) {
            os = "Windows"
        } else if (ua.includes("mac os") || ua.includes("macos")) {
            os = "macOS"
        } else if (ua.includes("linux")) {
            os = "Linux"
        } else if (ua.includes("android")) {
            os = "Android"
        } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
            os = "iOS"
        }

        return { device, browser, os }
    }

    /**
     * Update average latency calculation
     */
    private updateAverageLatency(latency: number): void {
        const total = this.stats.totalRedirects
        const currentAvg = this.stats.averageLatency
        this.stats.averageLatency = (currentAvg * (total - 1) + latency) / total
    }

    /**
     * Update cache hit rate based on cache source
     */
    private updateCacheHitRate(cacheSource: string): void {
        const cacheHits = cacheSource === "memory" || cacheSource === "redis" ? 1 : 0
        const totalRequests = this.stats.totalRedirects

        if (totalRequests > 0) {
            const currentHits = Math.floor(
                (this.stats.cacheHitRate * (totalRequests - 1)) / 100
            )
            this.stats.cacheHitRate = ((currentHits + cacheHits) / totalRequests) * 100
        }
    }

    /**
     * Chunk array into smaller arrays
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = []
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize))
        }
        return chunks
    }

    /**
     * Preload URLs into cache
     */
    async preloadUrls(shortCodes: string[]): Promise<void> {
        try {
            logger.info("Preloading URLs into cache", { count: shortCodes.length })

            const chunks = this.chunkArray(shortCodes, 50)

            for (const chunk of chunks) {
                const promises = chunk.map(async (shortCode) => {
                    try {
                        await this.cacheService.lookupUrl(shortCode)
                    } catch (error) {
                        logger.warn("Failed to preload URL", {
                            shortCode,
                            error: error instanceof Error ? error.message : "Unknown error"
                        })
                    }
                })

                await Promise.all(promises)
            }

            logger.info("URL preloading completed", { count: shortCodes.length })
        } catch (error) {
            logger.error("Error during URL preloading", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    /**
     * Invalidate URL from all cache layers
     */
    async invalidateUrl(shortCode: string): Promise<void> {
        await this.cacheService.invalidateCache(shortCode)
        logger.info("URL invalidated from cache", { shortCode })
    }

    /**
     * Invalidate analytics cache for a short code
     */
    private async invalidateAnalyticsCache(shortCode: string): Promise<void> {
        try {
            const { analyticsCacheService } = await import("../services/analyticsCacheService")
            await analyticsCacheService.invalidateAnalytics(shortCode)
            logger.debug("Analytics cache invalidated", { shortCode })
        } catch (error) {
            logger.warn("Failed to invalidate analytics cache", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Get detailed performance metrics
     */
    getPerformanceMetrics(): {
        stats: RedirectStats
        cacheStats: any
        analyticsStats: any
        healthStatus: any
    } {
        return {
            stats: this.getStats(),
            cacheStats: this.cacheService.getStats(),
            analyticsStats: this.analyticsService.getBufferStats(),
            healthStatus: {
                lastCheck: new Date().toISOString()
            }
        }
    }

    /**
     * Get analytics service for external access
     */
    getAnalyticsService(): typeof analyticsEventProducer {
        return this.analyticsService
    }

    /**
     * Shutdown redirect service
     */
    async shutdown(): Promise<void> {
        try {
            await this.analyticsService.shutdown()
            await directAnalyticsService.shutdown()
            logger.info("URL Redirect Service shutdown completed")
        } catch (error) {
            logger.error("Error during redirect service shutdown", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }
}