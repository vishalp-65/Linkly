import { Consumer } from 'kafkajs';
import { kafka } from '../config/kafka';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { ClickEventPayload } from './analyticsEventProducer';

interface WindowedAggregate {
    shortCode: string;
    windowStart: Date;
    windowEnd: Date;
    clickCount: number;
    uniqueIps: Set<string>;
    referrers: Map<string, number>;
    countries: Map<string, number>;
    devices: Map<string, number>;
    browsers: Map<string, number>;
}

class AnalyticsAggregator {
    private consumer: Consumer | null = null;
    private isRunning = false;
    private readonly windowSizeMs = 5 * 60 * 1000; // 5 minutes
    private readonly groupId = 'analytics-aggregator';
    private aggregateWindows = new Map<string, WindowedAggregate>();
    private flushTimer: NodeJS.Timeout | null = null;

    constructor() {
        this.setupGracefulShutdown();
    }

    public async start(): Promise<void> {
        try {
            if (this.isRunning) {
                logger.warn('Analytics aggregator is already running');
                return;
            }

            // Ensure Kafka is connected
            try {
                await kafka.connect();
            } catch (error) {
                logger.warn('Kafka not available for analytics aggregator, service will not start', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Don't throw - let the service continue without this aggregator
                return;
            }

            // Create consumer
            this.consumer = kafka.createConsumer(this.groupId);

            // Set up consumer event handlers
            this.consumer.on('consumer.connect', () => {
                logger.info('Analytics aggregator consumer connected');
            });

            this.consumer.on('consumer.disconnect', () => {
                logger.warn('Analytics aggregator consumer disconnected');
                this.isRunning = false;
            });

            this.consumer.on('consumer.crash', (error) => {
                logger.error('Analytics aggregator consumer crashed', {
                    error: error.payload?.error?.message || 'Unknown error',
                    stack: error.payload?.error?.stack,
                });
                this.isRunning = false;
            });

            // Connect consumer
            await this.consumer.connect();

            // Subscribe to topic
            await this.consumer.subscribe({
                topic: 'url_clicks',
                fromBeginning: false, // Only process new messages
            });

            // Start consuming messages
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        await this.processMessage(message);
                    } catch (error) {
                        logger.error('Error processing analytics message', {
                            topic,
                            partition,
                            offset: message.offset,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            stack: error instanceof Error ? error.stack : undefined,
                        });
                    }
                },
            });

            // Start periodic flush
            this.startPeriodicFlush();

            this.isRunning = true;
            logger.info('Analytics aggregator started successfully');

        } catch (error) {
            logger.error('Failed to start analytics aggregator', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }

    private async processMessage(message: any): Promise<void> {
        if (!message.value) {
            return;
        }

        try {
            const event: ClickEventPayload = JSON.parse(message.value.toString());
            const windowKey = this.getWindowKey(event.shortCode, new Date(event.timestamp));

            // Get or create aggregate window
            let aggregate = this.aggregateWindows.get(windowKey);
            if (!aggregate) {
                const windowStart = this.getWindowStart(new Date(event.timestamp));
                aggregate = {
                    shortCode: event.shortCode,
                    windowStart,
                    windowEnd: new Date(windowStart.getTime() + this.windowSizeMs),
                    clickCount: 0,
                    uniqueIps: new Set(),
                    referrers: new Map(),
                    countries: new Map(),
                    devices: new Map(),
                    browsers: new Map(),
                };
                this.aggregateWindows.set(windowKey, aggregate);
            }

            // Update aggregates
            aggregate.clickCount++;

            if (event.ipAddress) {
                aggregate.uniqueIps.add(event.ipAddress);
            }

            if (event.referrer) {
                const referrerDomain = this.extractDomain(event.referrer);
                aggregate.referrers.set(referrerDomain, (aggregate.referrers.get(referrerDomain) || 0) + 1);
            }

            if (event.countryCode) {
                aggregate.countries.set(event.countryCode, (aggregate.countries.get(event.countryCode) || 0) + 1);
            }

            if (event.deviceType) {
                aggregate.devices.set(event.deviceType, (aggregate.devices.get(event.deviceType) || 0) + 1);
            }

            if (event.browser) {
                aggregate.browsers.set(event.browser, (aggregate.browsers.get(event.browser) || 0) + 1);
            }

            logger.debug('Processed analytics event', {
                shortCode: event.shortCode,
                windowKey,
                clickCount: aggregate.clickCount,
            });

        } catch (error) {
            logger.error('Failed to parse analytics message', {
                error: error instanceof Error ? error.message : 'Unknown error',
                messageValue: message.value?.toString().substring(0, 200),
            });
        }
    }

    private getWindowKey(shortCode: string, timestamp: Date): string {
        const windowStart = this.getWindowStart(timestamp);
        return `${shortCode}:${windowStart.getTime()}`;
    }

    private getWindowStart(timestamp: Date): Date {
        const windowStartMs = Math.floor(timestamp.getTime() / this.windowSizeMs) * this.windowSizeMs;
        return new Date(windowStartMs);
    }

    private extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return 'unknown';
        }
    }

    private startPeriodicFlush(): void {
        // Flush completed windows every minute
        this.flushTimer = setInterval(async () => {
            await this.flushCompletedWindows();
        }, 60000);
    }

    private async flushCompletedWindows(): Promise<void> {
        const now = new Date();
        const completedWindows: string[] = [];

        for (const [windowKey, aggregate] of this.aggregateWindows.entries()) {
            // Flush windows that ended more than 1 minute ago (to allow for late arrivals)
            if (aggregate.windowEnd.getTime() < now.getTime() - 60000) {
                try {
                    await this.persistAggregate(aggregate);
                    completedWindows.push(windowKey);
                } catch (error) {
                    logger.error('Failed to persist aggregate', {
                        windowKey,
                        shortCode: aggregate.shortCode,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            }
        }

        // Remove flushed windows from memory
        for (const windowKey of completedWindows) {
            this.aggregateWindows.delete(windowKey);
        }

        if (completedWindows.length > 0) {
            logger.info('Flushed completed aggregate windows', {
                flushedCount: completedWindows.length,
                remainingCount: this.aggregateWindows.size,
            });
        }
    }

    private async persistAggregate(aggregate: WindowedAggregate): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Get top referrer and country
            const topReferrer = this.getTopEntry(aggregate.referrers);
            const topCountry = this.getTopEntry(aggregate.countries);

            // Insert or update aggregate
            const query = `
                INSERT INTO analytics_aggregates (
                    short_code, date, hour, click_count, unique_ips, 
                    unique_countries, top_referrer, top_country, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                ON CONFLICT (short_code, date, hour) 
                DO UPDATE SET 
                    click_count = analytics_aggregates.click_count + EXCLUDED.click_count,
                    unique_ips = GREATEST(analytics_aggregates.unique_ips, EXCLUDED.unique_ips),
                    unique_countries = GREATEST(analytics_aggregates.unique_countries, EXCLUDED.unique_countries),
                    top_referrer = COALESCE(EXCLUDED.top_referrer, analytics_aggregates.top_referrer),
                    top_country = COALESCE(EXCLUDED.top_country, analytics_aggregates.top_country),
                    updated_at = NOW()
            `;

            const values = [
                aggregate.shortCode,
                aggregate.windowStart.toISOString().split('T')[0], // Date part only
                aggregate.windowStart.getHours(),
                aggregate.clickCount,
                aggregate.uniqueIps.size,
                aggregate.countries.size,
                topReferrer,
                topCountry,
            ];

            await client.query(query, values);

            // Store detailed breakdowns in separate tables if needed
            await this.persistDetailedBreakdowns(client, aggregate);

            await client.query('COMMIT');

            logger.debug('Persisted analytics aggregate', {
                shortCode: aggregate.shortCode,
                windowStart: aggregate.windowStart.toISOString(),
                clickCount: aggregate.clickCount,
                uniqueIps: aggregate.uniqueIps.size,
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    private async persistDetailedBreakdowns(client: any, aggregate: WindowedAggregate): Promise<void> {
        // Store referrer breakdown
        if (aggregate.referrers.size > 0) {
            const referrerQuery = `
                INSERT INTO analytics_referrer_breakdown (
                    short_code, date, hour, referrer, click_count, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (short_code, date, hour, referrer)
                DO UPDATE SET 
                    click_count = analytics_referrer_breakdown.click_count + EXCLUDED.click_count
            `;

            for (const [referrer, count] of aggregate.referrers.entries()) {
                await client.query(referrerQuery, [
                    aggregate.shortCode,
                    aggregate.windowStart.toISOString().split('T')[0],
                    aggregate.windowStart.getHours(),
                    referrer,
                    count,
                ]);
            }
        }

        // Store country breakdown
        if (aggregate.countries.size > 0) {
            const countryQuery = `
                INSERT INTO analytics_country_breakdown (
                    short_code, date, hour, country_code, click_count, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (short_code, date, hour, country_code)
                DO UPDATE SET 
                    click_count = analytics_country_breakdown.click_count + EXCLUDED.click_count
            `;

            for (const [country, count] of aggregate.countries.entries()) {
                await client.query(countryQuery, [
                    aggregate.shortCode,
                    aggregate.windowStart.toISOString().split('T')[0],
                    aggregate.windowStart.getHours(),
                    country,
                    count,
                ]);
            }
        }

        // Store device breakdown
        if (aggregate.devices.size > 0) {
            const deviceQuery = `
                INSERT INTO analytics_device_breakdown (
                    short_code, date, hour, device_type, click_count, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (short_code, date, hour, device_type)
                DO UPDATE SET 
                    click_count = analytics_device_breakdown.click_count + EXCLUDED.click_count
            `;

            for (const [device, count] of aggregate.devices.entries()) {
                await client.query(deviceQuery, [
                    aggregate.shortCode,
                    aggregate.windowStart.toISOString().split('T')[0],
                    aggregate.windowStart.getHours(),
                    device,
                    count,
                ]);
            }
        }
    }

    private getTopEntry(map: Map<string, number>): string | null {
        if (map.size === 0) return null;

        let topEntry = '';
        let maxCount = 0;

        for (const [entry, count] of map.entries()) {
            if (count > maxCount) {
                maxCount = count;
                topEntry = entry;
            }
        }

        return topEntry || null;
    }

    public async stop(): Promise<void> {
        try {
            this.isRunning = false;

            // Stop periodic flush
            if (this.flushTimer) {
                clearInterval(this.flushTimer);
                this.flushTimer = null;
            }

            // Flush remaining windows
            await this.flushCompletedWindows();

            // Disconnect consumer
            if (this.consumer) {
                await this.consumer.disconnect();
                this.consumer = null;
            }

            logger.info('Analytics aggregator stopped successfully');

        } catch (error) {
            logger.error('Error stopping analytics aggregator', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    public getStats(): {
        isRunning: boolean;
        activeWindows: number;
        oldestWindow?: Date;
        newestWindow?: Date;
    } {
        let oldestWindow: Date | undefined;
        let newestWindow: Date | undefined;

        for (const aggregate of this.aggregateWindows.values()) {
            if (!oldestWindow || aggregate.windowStart < oldestWindow) {
                oldestWindow = aggregate.windowStart;
            }
            if (!newestWindow || aggregate.windowStart > newestWindow) {
                newestWindow = aggregate.windowStart;
            }
        }

        return {
            isRunning: this.isRunning,
            activeWindows: this.aggregateWindows.size,
            oldestWindow,
            newestWindow,
        };
    }

    private setupGracefulShutdown(): void {
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, stopping analytics aggregator...');
            await this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, stopping analytics aggregator...');
            await this.stop();
            process.exit(0);
        });
    }
}

export const analyticsAggregator = new AnalyticsAggregator();
export default analyticsAggregator;