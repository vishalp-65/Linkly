import { Request, Response, NextFunction } from "express"
import { analyticsRepository } from "../repositories/AnalyticsRepository"
import { analyticsCacheService } from "../services/analyticsCacheService"
import { ApiResponse } from "../utils/ApiResponse"
import { logger } from "../config/logger"
import { AnalyticsFilters } from "../types/database"
import { db } from "../config/database"
import { websocketService } from "../services/websocketService"

export class AnalyticsController {
    /**
     * Check if user owns the short code
     */
    private async checkOwnership(
        shortCode: string,
        userId: number
    ): Promise<void> {
        const client = await db.getClient()
        try {
            const query = `
                SELECT user_id 
                FROM url_mappings 
                WHERE short_code = $1 AND NOT is_deleted
            `
            const result = await client.query(query, [shortCode])

            if (result.rows.length === 0) {
                throw new Error("Short URL not found")
            }

            const ownerId = result.rows[0].user_id

            if (ownerId !== userId) {
                throw new Error(
                    "You don't have permission to view analytics for this URL"
                )
            }
        } finally {
            client.release()
        }
    }

    /**
     * Get analytics for a specific short code
     */
    getAnalytics = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { shortCode } = req.params
            const { date_from, date_to, country_code, device_type, no_cache } =
                req.query

            const userId = (req as any).user?.userId

            if (!userId) {
                throw new Error("Authentication required")
            }

            await this.checkOwnership(shortCode, userId)

            const filters: AnalyticsFilters = {
                date_from: date_from
                    ? new Date(date_from as string)
                    : undefined,
                date_to: date_to ? new Date(date_to as string) : undefined,
                country_code: country_code as string,
                device_type: device_type as string
            }

            const dateFromStr =
                filters.date_from?.toISOString().split("T")[0] ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0]
            const dateToStr =
                filters.date_to?.toISOString().split("T")[0] ||
                new Date().toISOString().split("T")[0]

            let analyticsData

            // Check cache if not explicitly disabled
            if (!no_cache) {
                analyticsData = await analyticsCacheService.getAnalytics(
                    shortCode,
                    dateFromStr,
                    dateToStr
                )
            }

            // Fetch from database if not in cache
            if (!analyticsData) {
                analyticsData = await analyticsRepository.getAnalytics(
                    shortCode,
                    filters
                )
                // Cache the results
                await analyticsCacheService.setAnalytics(
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    analyticsData
                )
            }

            // Apply client-side filters for country and device
            if (country_code) {
                analyticsData.topCountries = analyticsData.topCountries.filter(
                    (country) =>
                        country.country.toLowerCase() ===
                        (country_code as string).toLowerCase()
                )
            }

            if (device_type) {
                analyticsData.deviceBreakdown =
                    analyticsData.deviceBreakdown.filter(
                        (device) =>
                            device.device.toLowerCase() ===
                            (device_type as string).toLowerCase()
                    )
            }

            logger.info("Analytics data retrieved", {
                shortCode,
                userId,
                dateRange: `${dateFromStr} to ${dateToStr}`,
                totalClicks: analyticsData.totalClicks
            })

            // Transform data to match frontend expectations
            const transformedData = {
                shortCode: analyticsData.shortCode,
                totalClicks: analyticsData.totalClicks,
                uniqueVisitors: analyticsData.uniqueVisitors,
                clicksByDate: analyticsData.clicksByDay,
                clicksByCountry: analyticsData.topCountries,
                clicksByIndianState: analyticsData.topIndianStates,
                clicksByDevice: analyticsData.deviceBreakdown,
                clicksByReferrer: analyticsData.topReferrers
            }

            ApiResponse.success(res, transformedData)
        } catch (error) {
            next(error)
        }
    }

    /**
     * Get real-time analytics (always fresh data, no cache)
     */
    getRealtimeAnalytics = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { shortCode } = req.params

            const userId = (req as any).user?.userId

            if (!userId) {
                throw new Error("Authentication required")
            }

            await this.checkOwnership(shortCode, userId)

            // Always fetch fresh data for realtime (no cache)
            const realtimeData = await analyticsRepository.getRealtimeAnalytics(
                shortCode
            )

            logger.info("Real-time analytics data retrieved", {
                shortCode,
                userId,
                currentHourClicks: realtimeData.currentHourClicks,
                last24HoursClicks: realtimeData.last24HoursClicks
            })

            // Transform data to match frontend expectations with actual device and country data
            const transformedData = {
                activeUsers: realtimeData.currentHourClicks, // Approximate active users
                recentClicks: realtimeData.recentClicks.map(click => ({
                    timestamp: click.timestamp,
                    country: click.country || "Unknown",
                    device: click.device || "Unknown",
                    browser: click.browser || "Unknown"
                }))
            }

            ApiResponse.success(res, transformedData)
        } catch (error) {
            next(error)
        }
    }

    /**
     * Get global analytics across all user's URLs
     */
    getGlobalAnalytics = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { date_from, date_to, no_cache } = req.query

            const userId = (req as any).user?.userId

            if (!userId) {
                throw new Error("Authentication required")
            }

            const filters: AnalyticsFilters = {
                date_from: date_from
                    ? new Date(date_from as string)
                    : undefined,
                date_to: date_to ? new Date(date_to as string) : undefined
            }

            const dateFromStr =
                filters.date_from?.toISOString().split("T")[0] ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0]
            const dateToStr =
                filters.date_to?.toISOString().split("T")[0] ||
                new Date().toISOString().split("T")[0]

            let globalData

            // Check cache if not explicitly disabled
            if (!no_cache) {
                globalData = await analyticsCacheService.getGlobalAnalytics(
                    userId,
                    dateFromStr,
                    dateToStr
                )
            }

            // Fetch from database if not in cache
            if (!globalData) {
                globalData = await analyticsRepository.getGlobalAnalytics(
                    filters,
                    userId
                )
                // Cache the results
                await analyticsCacheService.setGlobalAnalytics(
                    userId,
                    dateFromStr,
                    dateToStr,
                    globalData
                )
            }

            logger.info("Global analytics data retrieved", {
                userId,
                dateRange: `${dateFromStr} to ${dateToStr}`,
                totalClicks: globalData.totalClicks,
                totalUrls: globalData.totalUrls
            })

            // Transform data to match frontend expectations
            const transformedData = {
                totalUrls: globalData.totalUrls,
                totalClicks: globalData.totalClicks,
                activeUrls: globalData.totalUrls, // All non-deleted URLs are considered active
                topUrls: globalData.topUrls.map(url => ({
                    short_code: url.shortCode,
                    long_url: url.longUrl,
                    access_count: url.clicks
                }))
            }

            ApiResponse.success(res, transformedData)
        } catch (error) {
            next(error)
        }
    }

    /**
     * Invalidate cache for a specific short code
     */
    invalidateCache = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { shortCode } = req.params

            const userId = (req as any).user?.userId

            if (!userId) {
                throw new Error("Authentication required")
            }

            await this.checkOwnership(shortCode, userId)

            await analyticsCacheService.invalidateAnalytics(shortCode)

            logger.info("Analytics cache invalidated", { shortCode, userId })

            ApiResponse.success(res, {
                message: "Analytics cache invalidated successfully."
            })
        } catch (error) {
            next(error)
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const cacheStats = await analyticsCacheService.getCacheStats()
            ApiResponse.success(res, cacheStats)
        } catch (error) {
            next(error)
        }
    }

    /**
     * Get WebSocket statistics
     */
    getWebSocketStats = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const stats = websocketService.getStats()
            ApiResponse.success(res, stats)
        } catch (error) {
            next(error)
        }
    }
}
