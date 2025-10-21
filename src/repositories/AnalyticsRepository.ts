import { db } from "../config/database"
import { logger } from "../config/logger"
import { AnalyticsFilters } from "../types/database"

export interface AnalyticsData {
    shortCode: string
    totalClicks: number
    uniqueVisitors: number
    clicksByDay: { date: string; clicks: number }[]
    topCountries: { country: string; clicks: number }[]
    topReferrers: { referrer: string; clicks: number }[]
    deviceBreakdown: { device: string; clicks: number }[]
    browserBreakdown: { browser: string; clicks: number }[]
    hourlyDistribution: { hour: number; clicks: number }[]
    peakHour: number
    avgClicksPerHour: number
    dateRange: {
        from: string
        to: string
    }
}

export interface GlobalAnalyticsData {
    totalUrls: number
    totalClicks: number
    totalUniqueVisitors: number
    topUrls: { shortCode: string; clicks: number; longUrl?: string }[]
    topCountries: { country: string; clicks: number }[]
    deviceDistribution: { device: string; clicks: number }[]
    browserDistribution: { browser: string; clicks: number }[]
    clicksByDay: { date: string; clicks: number }[]
    dateRange: {
        from: string
        to: string
    }
}

export class AnalyticsRepository {
    async getAnalytics(
        shortCode: string,
        filters: AnalyticsFilters
    ): Promise<AnalyticsData> {
        const client = await db.getClient()

        try {
            const dateFrom =
                filters.date_from ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            const dateTo = filters.date_to || new Date()

            const dateFromStr = dateFrom.toISOString().split("T")[0]
            const dateToStr = dateTo.toISOString().split("T")[0]

            // Check if we have daily summaries
            const hasSummariesQuery = `
                SELECT COUNT(*) as count
                FROM analytics_daily_summaries 
                WHERE short_code = $1 
                  AND date >= $2 
                  AND date <= $3
            `
            const hasSummariesResult = await client.query(hasSummariesQuery, [
                shortCode,
                dateFromStr,
                dateToStr
            ])
            const hasSummaries = parseInt(hasSummariesResult.rows[0].count) > 0

            let stats: any

            if (hasSummaries) {
                // Use daily summaries
                const basicStatsQuery = `
                    SELECT 
                        COALESCE(SUM(total_clicks), 0) as total_clicks,
                        COALESCE(SUM(unique_visitors), 0) as unique_visitors,
                        COALESCE(AVG(avg_clicks_per_hour), 0) as avg_clicks_per_hour,
                        COALESCE(MAX(peak_hour), 0) as peak_hour
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                `
                const basicStats = await client.query(basicStatsQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])
                stats = basicStats.rows[0]
            } else {
                // Use raw events
                const rawStatsQuery = `
                    SELECT 
                        COUNT(*) as total_clicks,
                        COUNT(DISTINCT ip_address) as unique_visitors
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamp 
                      AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                `
                const rawStats = await client.query(rawStatsQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])
                stats = rawStats.rows[0]

                // Calculate peak hour
                const peakHourQuery = `
                    SELECT 
                        EXTRACT(HOUR FROM clicked_at)::int as hour,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamp 
                      AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                    GROUP BY EXTRACT(HOUR FROM clicked_at)
                    ORDER BY clicks DESC
                    LIMIT 1
                `
                const peakHourResult = await client.query(peakHourQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])

                stats.peak_hour =
                    peakHourResult.rows.length > 0
                        ? peakHourResult.rows[0].hour
                        : 0

                // Calculate average clicks per hour
                const uniqueHoursQuery = `
                    SELECT COUNT(DISTINCT EXTRACT(HOUR FROM clicked_at)) as unique_hours
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamp 
                      AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                `
                const uniqueHoursResult = await client.query(uniqueHoursQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])

                const uniqueHours =
                    parseInt(uniqueHoursResult.rows[0].unique_hours) || 1
                stats.avg_clicks_per_hour =
                    parseInt(stats.total_clicks) / uniqueHours
            }

            // Parallel query execution
            const [
                clicksByDayResult,
                topCountriesResult,
                topReferrersResult,
                deviceBreakdownResult,
                browserBreakdownResult,
                hourlyDistributionResult
            ] = await Promise.all([
                this.getClicksByDay(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                ),
                this.getTopCountries(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                ),
                this.getTopReferrers(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                ),
                this.getDeviceBreakdown(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                ),
                this.getBrowserBreakdown(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                ),
                this.getHourlyDistribution(
                    client,
                    shortCode,
                    dateFromStr,
                    dateToStr,
                    hasSummaries
                )
            ])

            return {
                shortCode,
                totalClicks: parseInt(stats.total_clicks) || 0,
                uniqueVisitors: parseInt(stats.unique_visitors) || 0,
                clicksByDay: clicksByDayResult,
                topCountries: topCountriesResult,
                topReferrers: topReferrersResult,
                deviceBreakdown: deviceBreakdownResult,
                browserBreakdown: browserBreakdownResult,
                hourlyDistribution: hourlyDistributionResult,
                peakHour: parseInt(stats.peak_hour) || 0,
                avgClicksPerHour: parseFloat(stats.avg_clicks_per_hour) || 0,
                dateRange: {
                    from: dateFromStr,
                    to: dateToStr
                }
            }
        } catch (error) {
            logger.error("Failed to get analytics data", {
                shortCode,
                filters,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        } finally {
            client.release()
        }
    }

    async getGlobalAnalytics(
        filters: AnalyticsFilters,
        userId: number
    ): Promise<GlobalAnalyticsData> {
        const client = await db.getClient()

        try {
            const dateFrom =
                filters.date_from ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            const dateTo = filters.date_to || new Date()

            const dateFromStr = dateFrom.toISOString().split("T")[0]
            const dateToStr = dateTo.toISOString().split("T")[0]

            // Get user's URLs
            const userUrlsQuery = `
                SELECT short_code
                FROM url_mappings
                WHERE user_id = $1 AND NOT is_deleted
            `
            const userUrlsResult = await client.query(userUrlsQuery, [userId])
            const userShortCodes = userUrlsResult.rows.map(
                (row: any) => row.short_code
            )

            if (userShortCodes.length === 0) {
                return {
                    totalUrls: 0,
                    totalClicks: 0,
                    totalUniqueVisitors: 0,
                    topUrls: [],
                    topCountries: [],
                    deviceDistribution: [],
                    browserDistribution: [],
                    clicksByDay: [],
                    dateRange: { from: dateFromStr, to: dateToStr }
                }
            }

            // Check if we have daily summaries for any of user's URLs
            const hasSummariesQuery = `
                SELECT COUNT(*) as count
                FROM analytics_daily_summaries 
                WHERE short_code = ANY($1)
                  AND date >= $2 
                  AND date <= $3
            `
            const hasSummariesResult = await client.query(hasSummariesQuery, [
                userShortCodes,
                dateFromStr,
                dateToStr
            ])
            const hasSummaries = parseInt(hasSummariesResult.rows[0].count) > 0

            // Get total URLs count
            const totalUrlsResult = await client.query(
                `SELECT COUNT(*) as total FROM url_mappings WHERE user_id = $1 AND NOT is_deleted`,
                [userId]
            )

            let globalStatsResult,
                clicksByDayResult,
                topUrlsResult,
                topCountriesResult,
                deviceDistributionResult,
                browserDistributionResult

            if (hasSummaries) {
                // Use daily summaries
                [
                    globalStatsResult,
                    clicksByDayResult,
                    topUrlsResult,
                    topCountriesResult,
                    deviceDistributionResult,
                    browserDistributionResult
                ] = await Promise.all([
                    client.query(
                        `
                        SELECT 
                            COALESCE(SUM(ads.total_clicks), 0) as total_clicks,
                            COALESCE(SUM(ads.unique_visitors), 0) as total_unique_visitors
                        FROM analytics_daily_summaries ads
                        WHERE ads.short_code = ANY($1)
                          AND ads.date >= $2 
                          AND ads.date <= $3
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            ads.date::text,
                            COALESCE(SUM(ads.total_clicks), 0) as clicks
                        FROM analytics_daily_summaries ads
                        WHERE ads.short_code = ANY($1)
                          AND ads.date >= $2 
                          AND ads.date <= $3
                        GROUP BY ads.date
                        ORDER BY ads.date
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            ads.short_code,
                            SUM(ads.total_clicks) as clicks,
                            um.long_url
                        FROM analytics_daily_summaries ads
                        INNER JOIN url_mappings um ON ads.short_code = um.short_code
                        WHERE ads.short_code = ANY($1)
                          AND ads.date >= $2 
                          AND ads.date <= $3
                          AND um.user_id = $4
                          AND NOT um.is_deleted
                        GROUP BY ads.short_code, um.long_url
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr, userId]
                    ),

                    client.query(
                        `
                        SELECT 
                            country_data.country,
                            SUM(country_data.clicks::bigint) as clicks
                        FROM (
                            SELECT 
                                jsonb_array_elements(ads.top_countries) ->> 'country' as country,
                                jsonb_array_elements(ads.top_countries) ->> 'clicks' as clicks
                            FROM analytics_daily_summaries ads
                            WHERE ads.short_code = ANY($1)
                              AND ads.date >= $2 
                              AND ads.date <= $3
                              AND ads.top_countries IS NOT NULL
                        ) country_data
                        GROUP BY country_data.country
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            device_data.device,
                            SUM(device_data.clicks::bigint) as clicks
                        FROM (
                            SELECT 
                                jsonb_array_elements(ads.device_breakdown) ->> 'device' as device,
                                jsonb_array_elements(ads.device_breakdown) ->> 'clicks' as clicks
                            FROM analytics_daily_summaries ads
                            WHERE ads.short_code = ANY($1)
                              AND ads.date >= $2 
                              AND ads.date <= $3
                              AND ads.device_breakdown IS NOT NULL
                        ) device_data
                        GROUP BY device_data.device
                        ORDER BY clicks DESC
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            browser_data.browser,
                            SUM(browser_data.clicks::bigint) as clicks
                        FROM (
                            SELECT 
                                jsonb_array_elements(ads.browser_breakdown) ->> 'browser' as browser,
                                jsonb_array_elements(ads.browser_breakdown) ->> 'clicks' as clicks
                            FROM analytics_daily_summaries ads
                            WHERE ads.short_code = ANY($1)
                              AND ads.date >= $2 
                              AND ads.date <= $3
                              AND ads.browser_breakdown IS NOT NULL
                        ) browser_data
                        GROUP BY browser_data.browser
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    )
                ])
            } else {
                // Use raw events
                [
                    globalStatsResult,
                    clicksByDayResult,
                    topUrlsResult,
                    topCountriesResult,
                    deviceDistributionResult,
                    browserDistributionResult
                ] = await Promise.all([
                    client.query(
                        `
                        SELECT 
                            COUNT(*) as total_clicks,
                            COUNT(DISTINCT ip_address) as total_unique_visitors
                        FROM analytics_events
                        WHERE short_code = ANY($1)
                          AND clicked_at >= $2::timestamp 
                          AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            DATE(clicked_at)::text as date,
                            COUNT(*) as clicks
                        FROM analytics_events
                        WHERE short_code = ANY($1)
                          AND clicked_at >= $2::timestamp 
                          AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                        GROUP BY DATE(clicked_at)
                        ORDER BY date
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            ae.short_code,
                            COUNT(*) as clicks,
                            um.long_url
                        FROM analytics_events ae
                        INNER JOIN url_mappings um ON ae.short_code = um.short_code
                        WHERE ae.short_code = ANY($1)
                          AND ae.clicked_at >= $2::timestamp 
                          AND ae.clicked_at <= ($3::timestamp + INTERVAL '1 day')
                          AND um.user_id = $4
                          AND NOT um.is_deleted
                        GROUP BY ae.short_code, um.long_url
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr, userId]
                    ),

                    client.query(
                        `
                        SELECT 
                            COALESCE(country_code, 'Unknown') as country,
                            COUNT(*) as clicks
                        FROM analytics_events
                        WHERE short_code = ANY($1)
                          AND clicked_at >= $2::timestamp 
                          AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                        GROUP BY country_code
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            COALESCE(device_type, 'Unknown') as device,
                            COUNT(*) as clicks
                        FROM analytics_events
                        WHERE short_code = ANY($1)
                          AND clicked_at >= $2::timestamp 
                          AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                        GROUP BY device_type
                        ORDER BY clicks DESC
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    ),

                    client.query(
                        `
                        SELECT 
                            COALESCE(browser, 'Unknown') as browser,
                            COUNT(*) as clicks
                        FROM analytics_events
                        WHERE short_code = ANY($1)
                          AND clicked_at >= $2::timestamp 
                          AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                        GROUP BY browser
                        ORDER BY clicks DESC
                        LIMIT 10
                    `,
                        [userShortCodes, dateFromStr, dateToStr]
                    )
                ])
            }

            return {
                totalUrls: parseInt(totalUrlsResult.rows[0].total) || 0,
                totalClicks:
                    parseInt(globalStatsResult.rows[0].total_clicks) || 0,
                totalUniqueVisitors:
                    parseInt(globalStatsResult.rows[0].total_unique_visitors) ||
                    0,
                topUrls: topUrlsResult.rows.map((row: any) => ({
                    shortCode: row.short_code,
                    clicks: parseInt(row.clicks) || 0,
                    longUrl: row.long_url
                })),
                topCountries: topCountriesResult.rows.map((row: any) => ({
                    country: row.country,
                    clicks: parseInt(row.clicks) || 0
                })),
                deviceDistribution: deviceDistributionResult.rows.map(
                    (row: any) => ({
                        device: row.device,
                        clicks: parseInt(row.clicks) || 0
                    })
                ),
                browserDistribution: browserDistributionResult.rows.map(
                    (row: any) => ({
                        browser: row.browser,
                        clicks: parseInt(row.clicks) || 0
                    })
                ),
                clicksByDay: clicksByDayResult.rows.map((row: any) => ({
                    date: row.date,
                    clicks: parseInt(row.clicks) || 0
                })),
                dateRange: {
                    from: dateFromStr,
                    to: dateToStr
                }
            }
        } catch (error) {
            logger.error("Failed to get global analytics data", {
                filters,
                userId,
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        } finally {
            client.release()
        }
    }

    async getRealtimeAnalytics(shortCode: string): Promise<{
        recentClicks: { timestamp: string; count: number }[]
        currentHourClicks: number
        last24HoursClicks: number
    }> {
        const client = await db.getClient()

        try {
            const now = new Date()
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
            const currentHourStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours()
            )
            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

            // Parallel query execution with proper timestamp handling
            const [recentClicksResult, currentHourResult, last24HoursResult] =
                await Promise.all([
                    client.query(
                        `
                    SELECT 
                        DATE_TRUNC('minute', clicked_at) as minute,
                        COUNT(*) as count
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamptz
                    GROUP BY DATE_TRUNC('minute', clicked_at)
                    ORDER BY minute DESC
                    LIMIT 5
                `,
                        [shortCode, fiveMinutesAgo.toISOString()]
                    ),

                    client.query(
                        `
                    SELECT COUNT(*) as count
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamptz
                `,
                        [shortCode, currentHourStart.toISOString()]
                    ),

                    client.query(
                        `
                    SELECT COUNT(*) as count
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND clicked_at >= $2::timestamptz
                `,
                        [shortCode, last24Hours.toISOString()]
                    )
                ])

            return {
                recentClicks: recentClicksResult.rows.map((row: any) => ({
                    timestamp: row.minute,
                    count: parseInt(row.count) || 0
                })),
                currentHourClicks:
                    parseInt(currentHourResult.rows[0].count) || 0,
                last24HoursClicks:
                    parseInt(last24HoursResult.rows[0].count) || 0
            }
        } catch (error) {
            logger.error("Failed to get realtime analytics data", {
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        } finally {
            client.release()
        }
    }

    // Helper methods
    private async getClicksByDay(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    date::text,
                    COALESCE(total_clicks, 0) as clicks
                FROM analytics_daily_summaries 
                WHERE short_code = $1 
                  AND date >= $2 
                  AND date <= $3
                ORDER BY date
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                date: row.date,
                clicks: parseInt(row.clicks) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    DATE(clicked_at)::text as date,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY DATE(clicked_at)
                ORDER BY date
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                date: row.date,
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }

    private async getTopCountries(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    country_data.country,
                    SUM(country_data.clicks::bigint) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(top_countries) ->> 'country' as country,
                        jsonb_array_elements(top_countries) ->> 'clicks' as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND top_countries IS NOT NULL
                ) country_data
                GROUP BY country_data.country
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                country: row.country,
                clicks: parseInt(row.clicks) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    COALESCE(country_code, 'Unknown') as country,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY country_code
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                country: row.country,
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }

    private async getTopReferrers(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    referrer_data.referrer,
                    SUM(referrer_data.clicks::bigint) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(top_referrers) ->> 'referrer' as referrer,
                        jsonb_array_elements(top_referrers) ->> 'clicks' as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND top_referrers IS NOT NULL
                ) referrer_data
                GROUP BY referrer_data.referrer
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                referrer: row.referrer,
                clicks: parseInt(row.clicks) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    COALESCE(referrer, 'Direct') as referrer,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY referrer
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                referrer: row.referrer,
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }

    private async getDeviceBreakdown(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    device_data.device,
                    SUM(device_data.clicks::bigint) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(device_breakdown) ->> 'device' as device,
                        jsonb_array_elements(device_breakdown) ->> 'clicks' as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND device_breakdown IS NOT NULL
                ) device_data
                GROUP BY device_data.device
                ORDER BY clicks DESC
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                device: row.device,
                clicks: parseInt(row.clicks) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    COALESCE(device_type, 'Unknown') as device,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY device_type
                ORDER BY clicks DESC
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                device: row.device,
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }

    private async getBrowserBreakdown(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    browser_data.browser,
                    SUM(browser_data.clicks::bigint) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(browser_breakdown) ->> 'browser' as browser,
                        jsonb_array_elements(browser_breakdown) ->> 'clicks' as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND browser_breakdown IS NOT NULL
                ) browser_data
                GROUP BY browser_data.browser
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                browser: row.browser,
                clicks: parseInt(row.clicks) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    COALESCE(browser, 'Unknown') as browser,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY browser
                ORDER BY clicks DESC
                LIMIT 10
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                browser: row.browser,
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }

    private async getHourlyDistribution(
        client: any,
        shortCode: string,
        dateFromStr: string,
        dateToStr: string,
        hasSummaries: boolean
    ) {
        if (hasSummaries) {
            const result = await client.query(
                `
                SELECT 
                    (hour_data.hour)::int as hour,
                    AVG(hour_data.clicks::numeric) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(hourly_distribution) ->> 'hour' as hour,
                        jsonb_array_elements(hourly_distribution) ->> 'clicks' as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND hourly_distribution IS NOT NULL
                ) hour_data
                GROUP BY hour_data.hour
                ORDER BY hour
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                hour: parseInt(row.hour),
                clicks: Math.round(parseFloat(row.clicks)) || 0
            }))
        } else {
            const result = await client.query(
                `
                SELECT 
                    EXTRACT(HOUR FROM clicked_at)::int as hour,
                    COUNT(*) as clicks
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2::timestamp 
                  AND clicked_at <= ($3::timestamp + INTERVAL '1 day')
                GROUP BY EXTRACT(HOUR FROM clicked_at)
                ORDER BY hour
            `,
                [shortCode, dateFromStr, dateToStr]
            )
            return result.rows.map((row: any) => ({
                hour: parseInt(row.hour),
                clicks: parseInt(row.clicks) || 0
            }))
        }
    }
}

export const analyticsRepository = new AnalyticsRepository()
export default analyticsRepository
