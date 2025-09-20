import { db } from '../config/database';
import { logger } from '../config/logger';
import * as cron from 'node-cron';
import UAParser from 'ua-parser-js';

interface DailyAnalyticsSummary {
    shortCode: string;
    date: Date;
    totalClicks: number;
    uniqueVisitors: number;
    topCountries: { country: string; clicks: number }[];
    topReferrers: { referrer: string; clicks: number }[];
    deviceBreakdown: { device: string; clicks: number }[];
    browserBreakdown: { browser: string; clicks: number }[];
    hourlyDistribution: { hour: number; clicks: number }[];
    peakHour: number;
    avgClicksPerHour: number;
}

interface GeoLocation {
    country: string;
    region: string;
    city: string;
}

class BatchAnalyticsProcessor {
    private isRunning = false;
    private cronJob: cron.ScheduledTask | null = null;

    constructor() {
        this.setupCronJob();
    }

    private setupCronJob(): void {
        // Run daily at 2 AM
        this.cronJob = cron.schedule('0 2 * * *', async () => {
            await this.processDailyAnalytics();
        }, {
            timezone: process.env.TZ || 'UTC',
        });
    }

    public start(): void {
        if (this.isRunning) {
            logger.warn('Batch analytics processor is already running');
            return;
        }

        if (this.cronJob) {
            this.cronJob.start();
            this.isRunning = true;
            logger.info('Batch analytics processor started - scheduled to run daily at 2 AM');
        }
    }

    public stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.isRunning = false;
            logger.info('Batch analytics processor stopped');
        }
    }

    public async processDailyAnalytics(targetDate?: Date): Promise<void> {
        const processDate = targetDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
        const dateStr = processDate.toISOString().split('T')[0];

        logger.info('Starting daily analytics processing', { date: dateStr });

        try {
            // Process analytics events from the previous day
            await this.processAnalyticsEvents(processDate);

            // Generate daily summaries
            await this.generateDailySummaries(processDate);

            // Compute geographic distribution
            await this.computeGeographicDistribution(processDate);

            // Calculate device and browser breakdowns
            await this.calculateDeviceBrowserBreakdowns(processDate);

            // Generate summary reports
            await this.generateSummaryReports(processDate);

            // Clean up old raw events (optional)
            await this.cleanupOldEvents(processDate);

            logger.info('Daily analytics processing completed successfully', { date: dateStr });

        } catch (error) {
            logger.error('Failed to process daily analytics', {
                date: dateStr,
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    private async processAnalyticsEvents(date: Date): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Process raw analytics events and enrich with additional data
            const query = `
                SELECT 
                    event_id,
                    short_code,
                    clicked_at,
                    ip_address,
                    user_agent,
                    referrer,
                    country_code,
                    region,
                    city
                FROM analytics_events 
                WHERE DATE(clicked_at) = $1
                ORDER BY clicked_at
            `;

            const result = await client.query(query, [date.toISOString().split('T')[0]]);
            const events = result.rows;

            logger.info('Processing analytics events', {
                date: date.toISOString().split('T')[0],
                eventCount: events.length
            });

            // Process events in batches
            const batchSize = 1000;
            for (let i = 0; i < events.length; i += batchSize) {
                const batch = events.slice(i, i + batchSize);
                await this.processBatch(client, batch);
            }

            await client.query('COMMIT');

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async processBatch(client: any, events: any[]): Promise<void> {
        for (const event of events) {
            try {
                // Parse user agent for device and browser info
                const deviceInfo = this.parseUserAgent(event.user_agent);

                // Enhance geographic data if needed
                const geoInfo = await this.enhanceGeographicData(event.ip_address, event.country_code);

                // Update the event with enriched data
                await client.query(`
                    UPDATE analytics_events 
                    SET 
                        device_type = $1,
                        browser = $2,
                        os = $3,
                        country_code = $4,
                        region = $5,
                        city = $6
                    WHERE event_id = $7
                `, [
                    deviceInfo.device,
                    deviceInfo.browser,
                    deviceInfo.os,
                    geoInfo.country || event.country_code,
                    geoInfo.region || event.region,
                    geoInfo.city || event.city,
                    event.event_id,
                ]);

            } catch (error) {
                logger.warn('Failed to enrich analytics event', {
                    eventId: event.event_id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    }

    private parseUserAgent(userAgent: string | null): { device: string; browser: string; os: string } {
        if (!userAgent) {
            return { device: 'unknown', browser: 'unknown', os: 'unknown' };
        }

        try {
            const parser = new UAParser(userAgent);
            const result = parser.getResult();

            return {
                device: this.normalizeDeviceType(result.device.type || 'desktop'),
                browser: result.browser.name || 'unknown',
                os: result.os.name || 'unknown',
            };
        } catch (error) {
            logger.warn('Failed to parse user agent', { userAgent, error });
            return { device: 'unknown', browser: 'unknown', os: 'unknown' };
        }
    }

    private normalizeDeviceType(deviceType: string): string {
        const normalized = deviceType.toLowerCase();
        if (normalized.includes('mobile') || normalized.includes('smartphone')) return 'mobile';
        if (normalized.includes('tablet')) return 'tablet';
        if (normalized.includes('desktop') || normalized.includes('computer')) return 'desktop';
        return normalized || 'desktop';
    }

    private async enhanceGeographicData(ipAddress: string | null, existingCountry: string | null): Promise<GeoLocation> {
        // In a real implementation, you would use a GeoIP service like MaxMind
        // For now, return existing data or defaults
        return {
            country: existingCountry || 'unknown',
            region: 'unknown',
            city: 'unknown',
        };
    }

    private async generateDailySummaries(date: Date): Promise<void> {
        const client = await db.getClient();
        const dateStr = date.toISOString().split('T')[0];

        try {
            // Get all short codes that had activity on this date
            const shortCodesQuery = `
                SELECT DISTINCT short_code 
                FROM analytics_events 
                WHERE DATE(clicked_at) = $1
            `;
            const shortCodesResult = await client.query(shortCodesQuery, [dateStr]);

            for (const row of shortCodesResult.rows) {
                const shortCode = row.short_code;
                const summary = await this.generateShortCodeSummary(client, shortCode, date);
                await this.persistDailySummary(client, summary);
            }

            logger.info('Generated daily summaries', {
                date: dateStr,
                shortCodeCount: shortCodesResult.rows.length
            });

        } finally {
            client.release();
        }
    }

    private async generateShortCodeSummary(client: any, shortCode: string, date: Date): Promise<DailyAnalyticsSummary> {
        const dateStr = date.toISOString().split('T')[0];

        // Get basic stats
        const basicStatsQuery = `
            SELECT 
                COUNT(*) as total_clicks,
                COUNT(DISTINCT ip_address) as unique_visitors
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2
        `;
        const basicStats = await client.query(basicStatsQuery, [shortCode, dateStr]);

        // Get hourly distribution
        const hourlyQuery = `
            SELECT 
                EXTRACT(HOUR FROM clicked_at) as hour,
                COUNT(*) as clicks
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2
            GROUP BY EXTRACT(HOUR FROM clicked_at)
            ORDER BY hour
        `;
        const hourlyResult = await client.query(hourlyQuery, [shortCode, dateStr]);

        // Get top countries
        const countriesQuery = `
            SELECT 
                country_code as country,
                COUNT(*) as clicks
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2 AND country_code IS NOT NULL
            GROUP BY country_code
            ORDER BY clicks DESC
            LIMIT 10
        `;
        const countriesResult = await client.query(countriesQuery, [shortCode, dateStr]);

        // Get top referrers
        const referrersQuery = `
            SELECT 
                referrer,
                COUNT(*) as clicks
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2 AND referrer IS NOT NULL
            GROUP BY referrer
            ORDER BY clicks DESC
            LIMIT 10
        `;
        const referrersResult = await client.query(referrersQuery, [shortCode, dateStr]);

        // Get device breakdown
        const devicesQuery = `
            SELECT 
                device_type as device,
                COUNT(*) as clicks
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2 AND device_type IS NOT NULL
            GROUP BY device_type
            ORDER BY clicks DESC
        `;
        const devicesResult = await client.query(devicesQuery, [shortCode, dateStr]);

        // Get browser breakdown
        const browsersQuery = `
            SELECT 
                browser,
                COUNT(*) as clicks
            FROM analytics_events 
            WHERE short_code = $1 AND DATE(clicked_at) = $2 AND browser IS NOT NULL
            GROUP BY browser
            ORDER BY clicks DESC
            LIMIT 10
        `;
        const browsersResult = await client.query(browsersQuery, [shortCode, dateStr]);

        const hourlyDistribution = hourlyResult.rows.map((row: any) => ({
            hour: parseInt(row.hour),
            clicks: parseInt(row.clicks),
        }));

        const peakHour = hourlyDistribution.reduce((max: any, current: any) =>
            current.clicks > max.clicks ? current : max,
            { hour: 0, clicks: 0 }
        ).hour;

        const totalClicks = parseInt(basicStats.rows[0].total_clicks);
        const avgClicksPerHour = totalClicks / 24;

        return {
            shortCode,
            date,
            totalClicks,
            uniqueVisitors: parseInt(basicStats.rows[0].unique_visitors),
            topCountries: countriesResult.rows.map((row: any) => ({
                country: row.country,
                clicks: parseInt(row.clicks),
            })),
            topReferrers: referrersResult.rows.map((row: any) => ({
                referrer: row.referrer,
                clicks: parseInt(row.clicks),
            })),
            deviceBreakdown: devicesResult.rows.map((row: any) => ({
                device: row.device,
                clicks: parseInt(row.clicks),
            })),
            browserBreakdown: browsersResult.rows.map((row: any) => ({
                browser: row.browser,
                clicks: parseInt(row.clicks),
            })),
            hourlyDistribution,
            peakHour,
            avgClicksPerHour,
        };
    }

    private async persistDailySummary(client: any, summary: DailyAnalyticsSummary): Promise<void> {
        const query = `
            INSERT INTO analytics_daily_summaries (
                short_code, date, total_clicks, unique_visitors,
                top_countries, top_referrers, device_breakdown, browser_breakdown,
                hourly_distribution, peak_hour, avg_clicks_per_hour, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (short_code, date) 
            DO UPDATE SET 
                total_clicks = EXCLUDED.total_clicks,
                unique_visitors = EXCLUDED.unique_visitors,
                top_countries = EXCLUDED.top_countries,
                top_referrers = EXCLUDED.top_referrers,
                device_breakdown = EXCLUDED.device_breakdown,
                browser_breakdown = EXCLUDED.browser_breakdown,
                hourly_distribution = EXCLUDED.hourly_distribution,
                peak_hour = EXCLUDED.peak_hour,
                avg_clicks_per_hour = EXCLUDED.avg_clicks_per_hour,
                updated_at = NOW()
        `;

        await client.query(query, [
            summary.shortCode,
            summary.date.toISOString().split('T')[0],
            summary.totalClicks,
            summary.uniqueVisitors,
            JSON.stringify(summary.topCountries),
            JSON.stringify(summary.topReferrers),
            JSON.stringify(summary.deviceBreakdown),
            JSON.stringify(summary.browserBreakdown),
            JSON.stringify(summary.hourlyDistribution),
            summary.peakHour,
            summary.avgClicksPerHour,
        ]);
    }

    private async computeGeographicDistribution(date: Date): Promise<void> {
        // This would typically involve more sophisticated geographic analysis
        // For now, we'll aggregate the country data we already have
        logger.info('Computing geographic distribution', { date: date.toISOString().split('T')[0] });
    }

    private async calculateDeviceBrowserBreakdowns(date: Date): Promise<void> {
        // Device and browser breakdowns are already calculated in the summary generation
        logger.info('Device and browser breakdowns calculated', { date: date.toISOString().split('T')[0] });
    }

    private async generateSummaryReports(date: Date): Promise<void> {
        const client = await db.getClient();
        const dateStr = date.toISOString().split('T')[0];

        try {
            // Generate global summary report
            const globalSummaryQuery = `
                SELECT 
                    COUNT(DISTINCT short_code) as active_urls,
                    SUM(total_clicks) as total_clicks,
                    SUM(unique_visitors) as total_unique_visitors,
                    AVG(avg_clicks_per_hour) as avg_clicks_per_hour
                FROM analytics_daily_summaries 
                WHERE date = $1
            `;
            const globalSummary = await client.query(globalSummaryQuery, [dateStr]);

            // Store global summary
            await client.query(`
                INSERT INTO analytics_global_summaries (
                    date, active_urls, total_clicks, total_unique_visitors, 
                    avg_clicks_per_hour, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (date) 
                DO UPDATE SET 
                    active_urls = EXCLUDED.active_urls,
                    total_clicks = EXCLUDED.total_clicks,
                    total_unique_visitors = EXCLUDED.total_unique_visitors,
                    avg_clicks_per_hour = EXCLUDED.avg_clicks_per_hour,
                    updated_at = NOW()
            `, [
                dateStr,
                globalSummary.rows[0].active_urls,
                globalSummary.rows[0].total_clicks,
                globalSummary.rows[0].total_unique_visitors,
                globalSummary.rows[0].avg_clicks_per_hour,
            ]);

            logger.info('Generated summary reports', { date: dateStr });

        } finally {
            client.release();
        }
    }

    private async cleanupOldEvents(date: Date): Promise<void> {
        // Keep raw events for 30 days, then delete them
        const cutoffDate = new Date(date.getTime() - 30 * 24 * 60 * 60 * 1000);
        const client = await db.getClient();

        try {
            const result = await client.query(`
                DELETE FROM analytics_events 
                WHERE clicked_at < $1
            `, [cutoffDate.toISOString()]);

            logger.info('Cleaned up old analytics events', {
                cutoffDate: cutoffDate.toISOString().split('T')[0],
                deletedCount: result.rowCount,
            });

        } finally {
            client.release();
        }
    }

    public async runManualProcessing(date: Date): Promise<void> {
        logger.info('Running manual analytics processing', { date: date.toISOString().split('T')[0] });
        await this.processDailyAnalytics(date);
    }

    public isProcessorRunning(): boolean {
        return this.isRunning;
    }
}

export const batchAnalyticsProcessor = new BatchAnalyticsProcessor();
export default batchAnalyticsProcessor;