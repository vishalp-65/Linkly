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

            // Try to get basic analytics from daily summaries first
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
            let stats = basicStats.rows[0]

            // If no daily summaries exist, calculate from raw events
            if (parseInt(stats.total_clicks) === 0) {
                const rawStatsQuery = `
                    SELECT 
                        COUNT(*) as total_clicks,
                        COUNT(DISTINCT ip_address) as unique_visitors
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                `

                const rawStats = await client.query(rawStatsQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])

                if (rawStats.rows.length > 0) {
                    stats = rawStats.rows[0]

                    // Calculate peak hour and average clicks per hour separately
                    const peakHourQuery = `
                        SELECT 
                            EXTRACT(HOUR FROM clicked_at) as hour,
                            COUNT(*) as clicks
                        FROM analytics_events 
                        WHERE short_code = $1 
                          AND DATE(clicked_at) >= $2 
                          AND DATE(clicked_at) <= $3
                        GROUP BY EXTRACT(HOUR FROM clicked_at)
                        ORDER BY clicks DESC
                        LIMIT 1
                    `

                    const peakHourResult = await client.query(peakHourQuery, [
                        shortCode,
                        dateFromStr,
                        dateToStr
                    ])

                    if (peakHourResult.rows.length > 0) {
                        stats.peak_hour = peakHourResult.rows[0].hour
                    } else {
                        stats.peak_hour = 0
                    }

                    // Calculate average clicks per hour (total clicks / number of unique hours)
                    const uniqueHoursQuery = `
                        SELECT COUNT(DISTINCT EXTRACT(HOUR FROM clicked_at)) as unique_hours
                        FROM analytics_events 
                        WHERE short_code = $1 
                          AND DATE(clicked_at) >= $2 
                          AND DATE(clicked_at) <= $3
                    `

                    const uniqueHoursResult = await client.query(uniqueHoursQuery, [
                        shortCode,
                        dateFromStr,
                        dateToStr
                    ])

                    const uniqueHours = parseInt(uniqueHoursResult.rows[0].unique_hours) || 1
                    stats.avg_clicks_per_hour = parseInt(stats.total_clicks) / uniqueHours
                }
            }

            // Get clicks by day - try daily summaries first, then raw events
            let clicksByDayQuery = `
                SELECT 
                    date::text,
                    COALESCE(total_clicks, 0) as clicks
                FROM analytics_daily_summaries 
                WHERE short_code = $1 
                  AND date >= $2 
                  AND date <= $3
                ORDER BY date
            `

            let clicksByDayResult = await client.query(clicksByDayQuery, [
                shortCode,
                dateFromStr,
                dateToStr
            ])

            // If no daily summaries, get from raw events
            if (clicksByDayResult.rows.length === 0) {
                clicksByDayQuery = `
                    SELECT 
                        DATE(clicked_at)::text as date,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY DATE(clicked_at)
                    ORDER BY date
                `

                clicksByDayResult = await client.query(clicksByDayQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])
            }

            // Get aggregated top countries - try daily summaries first, then raw events
            let topCountriesQuery = `
                SELECT 
                    country_data.country,
                    SUM(country_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(top_countries) ->> 'country' as country,
                        (jsonb_array_elements(top_countries) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND top_countries IS NOT NULL
                ) country_data
                GROUP BY country_data.country
                ORDER BY clicks DESC
                LIMIT 10
            `

            let topCountriesResult = await client.query(topCountriesQuery, [
                shortCode,
                dateFromStr,
                dateToStr
            ])

            // If no daily summaries, get from raw events
            if (topCountriesResult.rows.length === 0) {
                topCountriesQuery = `
                    SELECT 
                        COALESCE(country_code, 'Unknown') as country,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY country_code
                    ORDER BY clicks DESC
                    LIMIT 10
                `

                topCountriesResult = await client.query(topCountriesQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])
            }

            // Get aggregated top referrers - try daily summaries first, then raw events
            let topReferrersQuery = `
                SELECT 
                    referrer_data.referrer,
                    SUM(referrer_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(top_referrers) ->> 'referrer' as referrer,
                        (jsonb_array_elements(top_referrers) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND top_referrers IS NOT NULL
                ) referrer_data
                GROUP BY referrer_data.referrer
                ORDER BY clicks DESC
                LIMIT 10
            `

            let topReferrersResult = await client.query(topReferrersQuery, [
                shortCode,
                dateFromStr,
                dateToStr
            ])

            // If no daily summaries, get from raw events
            if (topReferrersResult.rows.length === 0) {
                topReferrersQuery = `
                    SELECT 
                        COALESCE(referrer, 'Direct') as referrer,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY referrer
                    ORDER BY clicks DESC
                    LIMIT 10
                `

                topReferrersResult = await client.query(topReferrersQuery, [
                    shortCode,
                    dateFromStr,
                    dateToStr
                ])
            }

            // Get aggregated device breakdown - try daily summaries first, then raw events
            let deviceBreakdownQuery = `
                SELECT 
                    device_data.device,
                    SUM(device_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(device_breakdown) ->> 'device' as device,
                        (jsonb_array_elements(device_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND device_breakdown IS NOT NULL
                ) device_data
                GROUP BY device_data.device
                ORDER BY clicks DESC
            `

            let deviceBreakdownResult = await client.query(
                deviceBreakdownQuery,
                [shortCode, dateFromStr, dateToStr]
            )

            // If no daily summaries, get from raw events
            if (deviceBreakdownResult.rows.length === 0) {
                deviceBreakdownQuery = `
                    SELECT 
                        COALESCE(device_type, 'Unknown') as device,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY device_type
                    ORDER BY clicks DESC
                `

                deviceBreakdownResult = await client.query(
                    deviceBreakdownQuery,
                    [shortCode, dateFromStr, dateToStr]
                )
            }

            // Get aggregated browser breakdown - try daily summaries first, then raw events
            let browserBreakdownQuery = `
                SELECT 
                    browser_data.browser,
                    SUM(browser_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(browser_breakdown) ->> 'browser' as browser,
                        (jsonb_array_elements(browser_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND browser_breakdown IS NOT NULL
                ) browser_data
                GROUP BY browser_data.browser
                ORDER BY clicks DESC
                LIMIT 10
            `

            let browserBreakdownResult = await client.query(
                browserBreakdownQuery,
                [shortCode, dateFromStr, dateToStr]
            )

            // If no daily summaries, get from raw events
            if (browserBreakdownResult.rows.length === 0) {
                browserBreakdownQuery = `
                    SELECT 
                        COALESCE(browser, 'Unknown') as browser,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY COALESCE(browser, 'Unknown')
                    ORDER BY clicks DESC
                    LIMIT 10
                `

                browserBreakdownResult = await client.query(
                    browserBreakdownQuery,
                    [shortCode, dateFromStr, dateToStr]
                )
            }

            // Get hourly distribution - try daily summaries first, then raw events
            let hourlyDistributionQuery = `
                SELECT 
                    hour_data.hour,
                    AVG(hour_data.clicks) as clicks
                FROM (
                    SELECT 
                        (jsonb_array_elements(hourly_distribution) ->> 'hour')::int as hour,
                        (jsonb_array_elements(hourly_distribution) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE short_code = $1 
                      AND date >= $2 
                      AND date <= $3
                      AND hourly_distribution IS NOT NULL
                ) hour_data
                GROUP BY hour_data.hour
                ORDER BY hour_data.hour
            `

            let hourlyDistributionResult = await client.query(
                hourlyDistributionQuery,
                [shortCode, dateFromStr, dateToStr]
            )

            // If no daily summaries, get from raw events
            if (hourlyDistributionResult.rows.length === 0) {
                hourlyDistributionQuery = `
                    SELECT 
                        EXTRACT(HOUR FROM clicked_at)::int as hour,
                        COUNT(*) as clicks
                    FROM analytics_events 
                    WHERE short_code = $1 
                      AND DATE(clicked_at) >= $2 
                      AND DATE(clicked_at) <= $3
                    GROUP BY EXTRACT(HOUR FROM clicked_at)
                    ORDER BY hour
                `

                hourlyDistributionResult = await client.query(
                    hourlyDistributionQuery,
                    [shortCode, dateFromStr, dateToStr]
                )
            }

            return {
                shortCode,
                totalClicks: parseInt(stats.total_clicks) || 0,
                uniqueVisitors: parseInt(stats.unique_visitors) || 0,
                clicksByDay: clicksByDayResult.rows.map((row) => ({
                    date: row.date,
                    clicks: parseInt(row.clicks) || 0
                })),
                topCountries: topCountriesResult.rows.map((row) => ({
                    country: row.country,
                    clicks: parseInt(row.clicks) || 0
                })),
                topReferrers: topReferrersResult.rows.map((row) => ({
                    referrer: row.referrer,
                    clicks: parseInt(row.clicks) || 0
                })),
                deviceBreakdown: deviceBreakdownResult.rows.map((row) => ({
                    device: row.device,
                    clicks: parseInt(row.clicks) || 0
                })),
                browserBreakdown: browserBreakdownResult.rows.map((row) => ({
                    browser: row.browser,
                    clicks: parseInt(row.clicks) || 0
                })),
                hourlyDistribution: hourlyDistributionResult.rows.map(
                    (row) => ({
                        hour: parseInt(row.hour),
                        clicks: Math.round(parseFloat(row.clicks)) || 0
                    })
                ),
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
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
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

            // Get total URLs for user
            const totalUrlsQuery = `
                SELECT COUNT(DISTINCT short_code) as total_urls
                FROM url_mappings
                WHERE user_id = $1 AND NOT is_deleted
            `

            const totalUrlsResult = await client.query(totalUrlsQuery, [userId])

            // Get global stats from daily summaries for user's URLs
            const globalStatsQuery = `
                SELECT 
                    COALESCE(SUM(ads.total_clicks), 0) as total_clicks,
                    COALESCE(SUM(ads.unique_visitors), 0) as total_unique_visitors
                FROM analytics_daily_summaries ads
                INNER JOIN url_mappings um ON ads.short_code = um.short_code
                WHERE um.user_id = $1 
                  AND ads.date >= $2 
                  AND ads.date <= $3
                  AND NOT um.is_deleted
            `

            const globalStats = await client.query(globalStatsQuery, [
                userId,
                dateFromStr,
                dateToStr
            ])
            const stats = globalStats.rows[0]

            // Get clicks by day
            const clicksByDayQuery = `
                SELECT 
                    ads.date::text,
                    COALESCE(SUM(ads.total_clicks), 0) as clicks
                FROM analytics_daily_summaries ads
                INNER JOIN url_mappings um ON ads.short_code = um.short_code
                WHERE um.user_id = $1 
                  AND ads.date >= $2 
                  AND ads.date <= $3
                  AND NOT um.is_deleted
                GROUP BY ads.date
                ORDER BY ads.date
            `

            const clicksByDayResult = await client.query(clicksByDayQuery, [
                userId,
                dateFromStr,
                dateToStr
            ])

            // Get top URLs
            const topUrlsQuery = `
                SELECT 
                    ads.short_code,
                    SUM(ads.total_clicks) as clicks,
                    um.long_url
                FROM analytics_daily_summaries ads
                INNER JOIN url_mappings um ON ads.short_code = um.short_code
                WHERE um.user_id = $1 
                  AND ads.date >= $2 
                  AND ads.date <= $3
                  AND NOT um.is_deleted
                GROUP BY ads.short_code, um.long_url
                ORDER BY clicks DESC
                LIMIT 10
            `

            const topUrlsResult = await client.query(topUrlsQuery, [
                userId,
                dateFromStr,
                dateToStr
            ])

            // Get aggregated country data for user's URLs
            const topCountriesQuery = `
                SELECT 
                    country_data.country,
                    SUM(country_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(ads.top_countries) ->> 'country' as country,
                        (jsonb_array_elements(ads.top_countries) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries ads
                    INNER JOIN url_mappings um ON ads.short_code = um.short_code
                    WHERE um.user_id = $1 
                      AND ads.date >= $2 
                      AND ads.date <= $3
                      AND ads.top_countries IS NOT NULL
                      AND NOT um.is_deleted
                ) country_data
                GROUP BY country_data.country
                ORDER BY clicks DESC
                LIMIT 10
            `

            const topCountriesResult = await client.query(topCountriesQuery, [
                userId,
                dateFromStr,
                dateToStr
            ])

            // Get aggregated device distribution
            const deviceDistributionQuery = `
                SELECT 
                    device_data.device,
                    SUM(device_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(ads.device_breakdown) ->> 'device' as device,
                        (jsonb_array_elements(ads.device_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries ads
                    INNER JOIN url_mappings um ON ads.short_code = um.short_code
                    WHERE um.user_id = $1 
                      AND ads.date >= $2 
                      AND ads.date <= $3
                      AND ads.device_breakdown IS NOT NULL
                      AND NOT um.is_deleted
                ) device_data
                GROUP BY device_data.device
                ORDER BY clicks DESC
            `

            const deviceDistributionResult = await client.query(
                deviceDistributionQuery,
                [userId, dateFromStr, dateToStr]
            )

            // Get aggregated browser distribution
            const browserDistributionQuery = `
                SELECT 
                    browser_data.browser,
                    SUM(browser_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(ads.browser_breakdown) ->> 'browser' as browser,
                        (jsonb_array_elements(ads.browser_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries ads
                    INNER JOIN url_mappings um ON ads.short_code = um.short_code
                    WHERE um.user_id = $1 
                      AND ads.date >= $2 
                      AND ads.date <= $3
                      AND ads.browser_breakdown IS NOT NULL
                      AND NOT um.is_deleted
                ) browser_data
                GROUP BY browser_data.browser
                ORDER BY clicks DESC
                LIMIT 10
            `

            const browserDistributionResult = await client.query(
                browserDistributionQuery,
                [userId, dateFromStr, dateToStr]
            )

            return {
                totalUrls: parseInt(totalUrlsResult.rows[0].total_urls) || 0,
                totalClicks: parseInt(stats.total_clicks) || 0,
                totalUniqueVisitors: parseInt(stats.total_unique_visitors) || 0,
                topUrls: topUrlsResult.rows.map((row) => ({
                    shortCode: row.short_code,
                    clicks: parseInt(row.clicks) || 0,
                    longUrl: row.long_url
                })),
                topCountries: topCountriesResult.rows.map((row) => ({
                    country: row.country,
                    clicks: parseInt(row.clicks) || 0
                })),
                deviceDistribution: deviceDistributionResult.rows.map(
                    (row) => ({
                        device: row.device,
                        clicks: parseInt(row.clicks) || 0
                    })
                ),
                browserDistribution: browserDistributionResult.rows.map(
                    (row) => ({
                        browser: row.browser,
                        clicks: parseInt(row.clicks) || 0
                    })
                ),
                clicksByDay: clicksByDayResult.rows.map((row) => ({
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

            // Get recent clicks (last 5 minutes in 1-minute buckets)
            const recentClicksQuery = `
                SELECT 
                    DATE_TRUNC('minute', clicked_at) as minute,
                    COUNT(*) as count
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2
                GROUP BY DATE_TRUNC('minute', clicked_at)
                ORDER BY minute DESC
                LIMIT 5
            `

            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
            const recentClicksResult = await client.query(recentClicksQuery, [
                shortCode,
                fiveMinutesAgo.toISOString()
            ])

            // Get current hour clicks
            const currentHourQuery = `
                SELECT COUNT(*) as count
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2
            `

            const currentHourResult = await client.query(currentHourQuery, [
                shortCode,
                currentHourStart.toISOString()
            ])

            // Get last 24 hours clicks
            const last24HoursQuery = `
                SELECT COUNT(*) as count
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2
            `

            const last24HoursResult = await client.query(last24HoursQuery, [
                shortCode,
                last24Hours.toISOString()
            ])

            return {
                recentClicks: recentClicksResult.rows.map((row) => ({
                    timestamp: row.minute,
                    count: parseInt(row.count) || 0
                })),
                currentHourClicks: parseInt(currentHourResult.rows[0].count) || 0,
                last24HoursClicks: parseInt(last24HoursResult.rows[0].count) || 0
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
}

export const analyticsRepository = new AnalyticsRepository()
export default analyticsRepository