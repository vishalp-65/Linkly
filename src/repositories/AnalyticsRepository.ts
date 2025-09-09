import { db } from '../config/database';
import { logger } from '../config/logger';
import { AnalyticsFilters, PaginatedResult } from '../types/database';

export interface AnalyticsData {
    shortCode: string;
    totalClicks: number;
    uniqueVisitors: number;
    clicksByDay: { date: string; clicks: number }[];
    topCountries: { country: string; clicks: number }[];
    topReferrers: { referrer: string; clicks: number }[];
    deviceBreakdown: { device: string; clicks: number }[];
    browserBreakdown: { browser: string; clicks: number }[];
    hourlyDistribution: { hour: number; clicks: number }[];
    peakHour: number;
    avgClicksPerHour: number;
    dateRange: {
        from: string;
        to: string;
    };
}

export interface GlobalAnalyticsData {
    totalUrls: number;
    totalClicks: number;
    totalUniqueVisitors: number;
    topUrls: { shortCode: string; clicks: number; longUrl?: string }[];
    topCountries: { country: string; clicks: number }[];
    deviceDistribution: { device: string; clicks: number }[];
    browserDistribution: { browser: string; clicks: number }[];
    clicksByDay: { date: string; clicks: number }[];
    dateRange: {
        from: string;
        to: string;
    };
}

export class AnalyticsRepository {
    async getAnalytics(shortCode: string, filters: AnalyticsFilters): Promise<AnalyticsData> {
        const client = await db.getClient();

        try {
            const dateFrom = filters.date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const dateTo = filters.date_to || new Date();

            const dateFromStr = dateFrom.toISOString().split('T')[0];
            const dateToStr = dateTo.toISOString().split('T')[0];

            // Get basic analytics from daily summaries
            const basicStatsQuery = `
                SELECT 
                    SUM(total_clicks) as total_clicks,
                    SUM(unique_visitors) as unique_visitors,
                    AVG(avg_clicks_per_hour) as avg_clicks_per_hour,
                    MAX(peak_hour) as peak_hour
                FROM analytics_daily_summaries 
                WHERE short_code = $1 
                  AND date >= $2 
                  AND date <= $3
            `;

            const basicStats = await client.query(basicStatsQuery, [shortCode, dateFromStr, dateToStr]);
            const stats = basicStats.rows[0];

            // Get clicks by day
            const clicksByDayQuery = `
                SELECT 
                    date::text,
                    total_clicks as clicks
                FROM analytics_daily_summaries 
                WHERE short_code = $1 
                  AND date >= $2 
                  AND date <= $3
                ORDER BY date
            `;

            const clicksByDayResult = await client.query(clicksByDayQuery, [shortCode, dateFromStr, dateToStr]);

            // Get aggregated top countries
            const topCountriesQuery = `
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
            `;

            const topCountriesResult = await client.query(topCountriesQuery, [shortCode, dateFromStr, dateToStr]);

            // Get aggregated top referrers
            const topReferrersQuery = `
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
            `;

            const topReferrersResult = await client.query(topReferrersQuery, [shortCode, dateFromStr, dateToStr]);

            // Get aggregated device breakdown
            const deviceBreakdownQuery = `
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
            `;

            const deviceBreakdownResult = await client.query(deviceBreakdownQuery, [shortCode, dateFromStr, dateToStr]);

            // Get aggregated browser breakdown
            const browserBreakdownQuery = `
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
            `;

            const browserBreakdownResult = await client.query(browserBreakdownQuery, [shortCode, dateFromStr, dateToStr]);

            // Get hourly distribution (average across all days)
            const hourlyDistributionQuery = `
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
            `;

            const hourlyDistributionResult = await client.query(hourlyDistributionQuery, [shortCode, dateFromStr, dateToStr]);

            return {
                shortCode,
                totalClicks: parseInt(stats.total_clicks) || 0,
                uniqueVisitors: parseInt(stats.unique_visitors) || 0,
                clicksByDay: clicksByDayResult.rows.map(row => ({
                    date: row.date,
                    clicks: parseInt(row.clicks),
                })),
                topCountries: topCountriesResult.rows.map(row => ({
                    country: row.country,
                    clicks: parseInt(row.clicks),
                })),
                topReferrers: topReferrersResult.rows.map(row => ({
                    referrer: row.referrer,
                    clicks: parseInt(row.clicks),
                })),
                deviceBreakdown: deviceBreakdownResult.rows.map(row => ({
                    device: row.device,
                    clicks: parseInt(row.clicks),
                })),
                browserBreakdown: browserBreakdownResult.rows.map(row => ({
                    browser: row.browser,
                    clicks: parseInt(row.clicks),
                })),
                hourlyDistribution: hourlyDistributionResult.rows.map(row => ({
                    hour: parseInt(row.hour),
                    clicks: Math.round(parseFloat(row.clicks)),
                })),
                peakHour: parseInt(stats.peak_hour) || 0,
                avgClicksPerHour: parseFloat(stats.avg_clicks_per_hour) || 0,
                dateRange: {
                    from: dateFromStr,
                    to: dateToStr,
                },
            };

        } catch (error) {
            logger.error('Failed to get analytics data', {
                shortCode,
                filters,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    async getGlobalAnalytics(filters: AnalyticsFilters): Promise<GlobalAnalyticsData> {
        const client = await db.getClient();

        try {
            const dateFrom = filters.date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const dateTo = filters.date_to || new Date();

            const dateFromStr = dateFrom.toISOString().split('T')[0];
            const dateToStr = dateTo.toISOString().split('T')[0];

            // Get global stats
            const globalStatsQuery = `
                SELECT 
                    SUM(active_urls) as total_urls,
                    SUM(total_clicks) as total_clicks,
                    SUM(total_unique_visitors) as total_unique_visitors
                FROM analytics_global_summaries 
                WHERE date >= $1 AND date <= $2
            `;

            const globalStats = await client.query(globalStatsQuery, [dateFromStr, dateToStr]);
            const stats = globalStats.rows[0];

            // Get clicks by day
            const clicksByDayQuery = `
                SELECT 
                    date::text,
                    total_clicks as clicks
                FROM analytics_global_summaries 
                WHERE date >= $1 AND date <= $2
                ORDER BY date
            `;

            const clicksByDayResult = await client.query(clicksByDayQuery, [dateFromStr, dateToStr]);

            // Get top URLs
            const topUrlsQuery = `
                SELECT 
                    ads.short_code,
                    SUM(ads.total_clicks) as clicks,
                    um.long_url
                FROM analytics_daily_summaries ads
                LEFT JOIN url_mappings um ON ads.short_code = um.short_code
                WHERE ads.date >= $1 AND ads.date <= $2
                GROUP BY ads.short_code, um.long_url
                ORDER BY clicks DESC
                LIMIT 10
            `;

            const topUrlsResult = await client.query(topUrlsQuery, [dateFromStr, dateToStr]);

            // Get aggregated country data from daily summaries
            const topCountriesQuery = `
                SELECT 
                    country_data.country,
                    SUM(country_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(top_countries) ->> 'country' as country,
                        (jsonb_array_elements(top_countries) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE date >= $1 
                      AND date <= $2
                      AND top_countries IS NOT NULL
                ) country_data
                GROUP BY country_data.country
                ORDER BY clicks DESC
                LIMIT 10
            `;

            const topCountriesResult = await client.query(topCountriesQuery, [dateFromStr, dateToStr]);

            // Get aggregated device distribution
            const deviceDistributionQuery = `
                SELECT 
                    device_data.device,
                    SUM(device_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(device_breakdown) ->> 'device' as device,
                        (jsonb_array_elements(device_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE date >= $1 
                      AND date <= $2
                      AND device_breakdown IS NOT NULL
                ) device_data
                GROUP BY device_data.device
                ORDER BY clicks DESC
            `;

            const deviceDistributionResult = await client.query(deviceDistributionQuery, [dateFromStr, dateToStr]);

            // Get aggregated browser distribution
            const browserDistributionQuery = `
                SELECT 
                    browser_data.browser,
                    SUM(browser_data.clicks) as clicks
                FROM (
                    SELECT 
                        jsonb_array_elements(browser_breakdown) ->> 'browser' as browser,
                        (jsonb_array_elements(browser_breakdown) ->> 'clicks')::int as clicks
                    FROM analytics_daily_summaries 
                    WHERE date >= $1 
                      AND date <= $2
                      AND browser_breakdown IS NOT NULL
                ) browser_data
                GROUP BY browser_data.browser
                ORDER BY clicks DESC
                LIMIT 10
            `;

            const browserDistributionResult = await client.query(browserDistributionQuery, [dateFromStr, dateToStr]);

            return {
                totalUrls: parseInt(stats.total_urls) || 0,
                totalClicks: parseInt(stats.total_clicks) || 0,
                totalUniqueVisitors: parseInt(stats.total_unique_visitors) || 0,
                topUrls: topUrlsResult.rows.map(row => ({
                    shortCode: row.short_code,
                    clicks: parseInt(row.clicks),
                    longUrl: row.long_url,
                })),
                topCountries: topCountriesResult.rows.map(row => ({
                    country: row.country,
                    clicks: parseInt(row.clicks),
                })),
                deviceDistribution: deviceDistributionResult.rows.map(row => ({
                    device: row.device,
                    clicks: parseInt(row.clicks),
                })),
                browserDistribution: browserDistributionResult.rows.map(row => ({
                    browser: row.browser,
                    clicks: parseInt(row.clicks),
                })),
                clicksByDay: clicksByDayResult.rows.map(row => ({
                    date: row.date,
                    clicks: parseInt(row.clicks),
                })),
                dateRange: {
                    from: dateFromStr,
                    to: dateToStr,
                },
            };

        } catch (error) {
            logger.error('Failed to get global analytics data', {
                filters,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        } finally {
            client.release();
        }
    }

    async getRealtimeAnalytics(shortCode: string): Promise<{
        recentClicks: { timestamp: string; count: number }[];
        currentHourClicks: number;
        last24HoursClicks: number;
    }> {
        const client = await db.getClient();

        try {
            const now = new Date();
            const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const currentHourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

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
            `;

            const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
            const recentClicksResult = await client.query(recentClicksQuery, [shortCode, fiveMinutesAgo.toISOString()]);

            // Get current hour clicks
            const currentHourQuery = `
                SELECT COUNT(*) as count
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2
            `;

            const currentHourResult = await client.query(currentHourQuery, [shortCode, currentHourStart.toISOString()]);

            // Get last 24 hours clicks
            const last24HoursQuery = `
                SELECT COUNT(*) as count
                FROM analytics_events 
                WHERE short_code = $1 
                  AND clicked_at >= $2
            `;

            const last24HoursResult = await client.query(last24HoursQuery, [shortCode, last24Hours.toISOString()]);

            return {
                recentClicks: recentClicksResult.rows.map(row => ({
                    timestamp: row.minute,
                    count: parseInt(row.count),
                })),
                currentHourClicks: parseInt(currentHourResult.rows[0].count),
                last24HoursClicks: parseInt(last24HoursResult.rows[0].count),
            };

        } catch (error) {
            logger.error('Failed to get realtime analytics data', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        } finally {
            client.release();
        }
    }
}

export const analyticsRepository = new AnalyticsRepository();
export default analyticsRepository;