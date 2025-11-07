import { Producer } from "kafkajs"
import { kafka } from "../config/kafka"
import { logger } from "../config/logger"
import { CreateAnalyticsEventInput } from "../types/database"
import { v4 as uuidv4 } from "uuid"

export interface ClickEventPayload {
    eventId: string
    shortCode: string
    timestamp: string
    ipAddress?: string
    userAgent?: string
    referrer?: string
    countryCode?: string
    region?: string
    city?: string
    deviceType?: string
    browser?: string
    os?: string
}

class AnalyticsEventProducer {
    private producer: Producer | null = null
    private eventBuffer: ClickEventPayload[] = []
    private readonly maxBufferSize = 10000
    private readonly flushInterval = 5000 // 5 seconds
    private flushTimer: NodeJS.Timeout | null = null
    private isProducerReady = false

    constructor() {
        this.initializeProducer()
        this.startBufferFlush()
    }

    private async initializeProducer(): Promise<void> {
        try {
            await kafka.connect()
            this.producer = kafka.getProducer()
            this.isProducerReady = true

            logger.info("Analytics event producer initialized")

            // Flush any buffered events
            if (this.eventBuffer.length > 0) {
                await this.flushBuffer()
            }
        } catch (error) {
            logger.error("Failed to initialize analytics event producer", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            this.isProducerReady = false
        }
    }

    private startBufferFlush(): void {
        this.flushTimer = setInterval(async () => {
            if (this.eventBuffer.length > 0) {
                await this.flushBuffer()
            }
        }, this.flushInterval)
    }

    public async publishClickEvent(
        eventData: CreateAnalyticsEventInput
    ): Promise<void> {
        console.log("ANALYTICS PRODUCER: Received click event", { eventData })

        const event: ClickEventPayload = {
            eventId: uuidv4(),
            shortCode: eventData.short_code,
            timestamp: (eventData.clicked_at || new Date()).toISOString(),
            ipAddress: eventData.ip_address,
            userAgent: eventData.user_agent,
            referrer: eventData.referrer,
            countryCode: eventData.country_code,
            region: eventData.region,
            city: eventData.city,
            deviceType: eventData.device_type,
            browser: eventData.browser,
            os: eventData.os
        }

        console.log("ANALYTICS PRODUCER: Created event payload", { event })

        // Add to buffer
        this.eventBuffer.push(event)

        console.log("ANALYTICS PRODUCER: Added to buffer", {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize,
            isProducerReady: this.isProducerReady
        })

        // Check if buffer is full
        if (this.eventBuffer.length >= this.maxBufferSize) {
            await this.flushBuffer()
        }

        // If producer is ready and buffer has events, try to send immediately for low latency
        if (this.isProducerReady && this.eventBuffer.length > 0) {
            // Don't await to keep redirect fast
            this.flushBuffer().catch((error) => {
                logger.error("Failed to flush event buffer", {
                    error:
                        error instanceof Error ? error.message : "Unknown error"
                })
            })
        } else if (!this.isProducerReady) {
            console.log("ANALYTICS PRODUCER: Producer not ready, event buffered", {
                bufferSize: this.eventBuffer.length
            })
        }
    }

    private async flushBuffer(): Promise<void> {
        if (
            this.eventBuffer.length === 0 ||
            !this.isProducerReady ||
            !this.producer
        ) {
            return
        }

        const eventsToSend = [...this.eventBuffer]
        this.eventBuffer = []

        try {
            const messages = eventsToSend.map((event) => ({
                key: event.shortCode, // Partition by short code for ordered processing
                value: JSON.stringify(event),
                timestamp: new Date(event.timestamp).getTime().toString(),
                headers: {
                    eventType: "click",
                    version: "1.0"
                }
            }))

            await this.producer.send({
                topic: "url_clicks",
                messages
            })

            console.log("ANALYTICS PRODUCER: Events sent to Kafka", {
                eventCount: eventsToSend.length,
                topic: "url_clicks"
            })

            logger.debug("Analytics events published to Kafka", {
                eventCount: eventsToSend.length,
                topic: "url_clicks"
            })
        } catch (error) {
            logger.error("Failed to publish analytics events to Kafka", {
                error: error instanceof Error ? error.message : "Unknown error",
                eventCount: eventsToSend.length,
                stack: error instanceof Error ? error.stack : undefined
            })

            // Re-add events to buffer for retry (up to max buffer size)
            const remainingCapacity =
                this.maxBufferSize - this.eventBuffer.length
            if (remainingCapacity > 0) {
                const eventsToRequeue = eventsToSend.slice(0, remainingCapacity)
                this.eventBuffer.unshift(...eventsToRequeue)

                logger.warn("Re-queued analytics events for retry", {
                    requeuedCount: eventsToRequeue.length,
                    droppedCount: eventsToSend.length - eventsToRequeue.length
                })
            } else {
                logger.error("Event buffer full, dropping analytics events", {
                    droppedCount: eventsToSend.length
                })
            }

            // Retry producer initialization if it failed
            if (!this.isProducerReady) {
                setTimeout(() => {
                    this.initializeProducer().catch((retryError) => {
                        logger.error(
                            "Failed to retry producer initialization",
                            {
                                error:
                                    retryError instanceof Error
                                        ? retryError.message
                                        : "Unknown error"
                            }
                        )
                    })
                }, 5000) // Retry after 5 seconds
            }
        }
    }

    public async publishBulkEvents(
        events: CreateAnalyticsEventInput[]
    ): Promise<void> {
        for (const event of events) {
            await this.publishClickEvent(event)
        }
    }

    public getBufferStats(): {
        bufferSize: number
        maxBufferSize: number
        isProducerReady: boolean
    } {
        return {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize,
            isProducerReady: this.isProducerReady
        }
    }

    public async shutdown(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer)
            this.flushTimer = null
        }

        // Flush remaining events
        if (this.eventBuffer.length > 0) {
            await this.flushBuffer()
        }

        logger.info("Analytics event producer shutdown complete")
    }
}

// Singleton instance
export const analyticsEventProducer = new AnalyticsEventProducer()
export default analyticsEventProducer
