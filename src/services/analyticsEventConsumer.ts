import { Consumer } from "kafkajs"
import { kafka } from "../config/kafka"
import { db } from "../config/database"
import { logger } from "../config/logger"
import { ClickEventPayload } from "./analyticsEventProducer"
import { metricsService } from "./metricsService"
import { analyticsCacheService } from "./analyticsCacheService"

/**
 * Analytics Event Consumer
 * Consumes click events from Kafka and stores them in the analytics_events table
 */
class AnalyticsEventConsumer {
    private consumer: Consumer | null = null
    private isRunning = false
    private readonly groupId = "analytics-event-consumer"
    private eventBuffer: ClickEventPayload[] = []
    private readonly maxBufferSize = 1000
    private readonly flushInterval = 2000 // 2 seconds
    private flushTimer: NodeJS.Timeout | null = null

    constructor() {
        this.setupGracefulShutdown()
    }

    public async start(): Promise<void> {
        try {
            if (this.isRunning) {
                logger.warn("Analytics event consumer is already running")
                return
            }

            // Try to ensure Kafka is connected
            try {
                await kafka.connect()
            } catch (error) {
                logger.warn("Kafka not available for analytics consumer, service will not start", {
                    error: error instanceof Error ? error.message : "Unknown error"
                })
                // Don't throw - let the service continue without this consumer
                return
            }

            // Create consumer
            this.consumer = kafka.createConsumer(this.groupId)

            // Set up consumer event handlers
            this.consumer.on("consumer.connect", () => {
                logger.info("Analytics event consumer connected")
            })

            this.consumer.on("consumer.disconnect", () => {
                logger.warn("Analytics event consumer disconnected")
                this.isRunning = false
            })

            this.consumer.on("consumer.crash", (error) => {
                logger.error("Analytics event consumer crashed", {
                    error: error.payload?.error?.message || "Unknown error",
                    stack: error.payload?.error?.stack
                })
                this.isRunning = false
            })

            // Connect consumer
            await this.consumer.connect()

            // Subscribe to topic
            await this.consumer.subscribe({
                topic: "url_clicks",
                fromBeginning: false // Only process new messages
            })

            // Start consuming messages
            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    try {
                        await this.processMessage(message)
                    } catch (error) {
                        logger.error("Error processing analytics message", {
                            topic,
                            partition,
                            offset: message.offset,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Unknown error",
                            stack:
                                error instanceof Error ? error.stack : undefined
                        })

                        // Record error metric
                        metricsService.recordAnalyticsEvent("click", "error")
                    }
                }
            })

            // Start periodic flush
            this.startPeriodicFlush()

            this.isRunning = true
            logger.info("Analytics event consumer started successfully")
        } catch (error) {
            logger.error("Failed to start analytics event consumer", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }
    }

    private async processMessage(message: any): Promise<void> {
        if (!message.value) {
            return
        }

        try {
            const event: ClickEventPayload = JSON.parse(
                message.value.toString()
            )

            console.log("ANALYTICS CONSUMER: Processing message", {
                shortCode: event.shortCode,
                eventId: event.eventId
            })

            // Add to buffer
            this.eventBuffer.push(event)

            console.log("ANALYTICS CONSUMER: Event added to buffer", {
                bufferSize: this.eventBuffer.length,
                maxBufferSize: this.maxBufferSize
            })

            // Flush immediately for real-time updates (don't wait for buffer to fill)
            await this.flushBuffer()

            logger.debug("Processed analytics event", {
                shortCode: event.shortCode,
                eventId: event.eventId,
                bufferSize: this.eventBuffer.length
            })
        } catch (error) {
            logger.error("Failed to parse analytics message", {
                error: error instanceof Error ? error.message : "Unknown error",
                messageValue: message.value?.toString().substring(0, 200)
            })
            throw error
        }
    }

    private startPeriodicFlush(): void {
        this.flushTimer = setInterval(async () => {
            if (this.eventBuffer.length > 0) {
                await this.flushBuffer()
            }
        }, this.flushInterval)
    }

    private async flushBuffer(): Promise<void> {
        if (this.eventBuffer.length === 0) {
            return
        }

        const eventsToInsert = [...this.eventBuffer]
        this.eventBuffer = []

        const client = await db.getClient()

        try {
            await client.query("BEGIN")

            // Batch insert events
            const insertQuery = `
                INSERT INTO analytics_events (
                    event_id, short_code, clicked_at, ip_address, user_agent, 
                    referrer, country_code, region, city, device_type, browser, os
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `

            for (const event of eventsToInsert) {
                await client.query(insertQuery, [
                    event.eventId,
                    event.shortCode,
                    event.timestamp,
                    event.ipAddress,
                    event.userAgent,
                    event.referrer,
                    event.countryCode,
                    event.region,
                    event.city,
                    event.deviceType,
                    event.browser,
                    event.os
                ])
            }

            await client.query("COMMIT")

            console.log("ANALYTICS CONSUMER: Successfully inserted events to database", {
                eventCount: eventsToInsert.length
            })

            // Invalidate analytics cache for affected short codes
            // NOTE: WebSocket events are already emitted by the producer, so we don't emit them here
            const uniqueShortCodes = new Set<string>()
            for (const event of eventsToInsert) {
                uniqueShortCodes.add(event.shortCode)
            }

            for (const shortCode of uniqueShortCodes) {
                analyticsCacheService.invalidateAnalytics(shortCode).catch((cacheError) => {
                    logger.warn("Failed to invalidate analytics cache from consumer", {
                        shortCode,
                        error: cacheError instanceof Error ? cacheError.message : "Unknown error"
                    })
                })
            }

            // Record success metrics
            metricsService.recordAnalyticsEvent("click", "success")

            logger.debug("Flushed analytics events to database", {
                eventCount: eventsToInsert.length
            })
        } catch (error) {
            await client.query("ROLLBACK")

            // Re-add events to buffer for retry (up to max buffer size)
            const remainingCapacity = this.maxBufferSize - this.eventBuffer.length
            if (remainingCapacity > 0) {
                const eventsToRequeue = eventsToInsert.slice(0, remainingCapacity)
                this.eventBuffer.unshift(...eventsToRequeue)

                logger.warn("Re-queued analytics events for retry", {
                    requeuedCount: eventsToRequeue.length,
                    droppedCount: eventsToInsert.length - eventsToRequeue.length
                })
            } else {
                logger.error("Event buffer full, dropping analytics events", {
                    droppedCount: eventsToInsert.length
                })
            }

            // Record error metrics
            metricsService.recordAnalyticsEvent("click", "error")

            logger.error("Failed to flush analytics events to database", {
                error: error instanceof Error ? error.message : "Unknown error",
                eventCount: eventsToInsert.length,
                stack: error instanceof Error ? error.stack : undefined
            })

            throw error
        } finally {
            client.release()
        }
    }

    public async stop(): Promise<void> {
        try {
            this.isRunning = false

            // Stop periodic flush
            if (this.flushTimer) {
                clearInterval(this.flushTimer)
                this.flushTimer = null
            }

            // Flush remaining events
            if (this.eventBuffer.length > 0) {
                await this.flushBuffer()
            }

            // Disconnect consumer
            if (this.consumer) {
                await this.consumer.disconnect()
                this.consumer = null
            }

            logger.info("Analytics event consumer stopped successfully")
        } catch (error) {
            logger.error("Error stopping analytics event consumer", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    public getStats(): {
        isRunning: boolean
        bufferSize: number
        maxBufferSize: number
    } {
        return {
            isRunning: this.isRunning,
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize
        }
    }

    private setupGracefulShutdown(): void {
        process.on("SIGINT", async () => {
            logger.info("Received SIGINT, stopping analytics event consumer...")
            await this.stop()
            process.exit(0)
        })

        process.on("SIGTERM", async () => {
            logger.info("Received SIGTERM, stopping analytics event consumer...")
            await this.stop()
            process.exit(0)
        })
    }
}

export const analyticsEventConsumer = new AnalyticsEventConsumer()
export default analyticsEventConsumer