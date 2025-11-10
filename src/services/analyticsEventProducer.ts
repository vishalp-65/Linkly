import { Producer } from "kafkajs"
import { kafka } from "../config/kafka"
import { logger } from "../config/logger"
import { CreateAnalyticsEventInput } from "../types/database"
import { v4 as uuidv4 } from "uuid"
import { websocketService } from "./websocketService"

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

/**
 * Analytics Event Producer
 * Publishes analytics events to Kafka
 * 
 * IMPORTANT: This service emits WebSocket events ONCE per click
 */
class AnalyticsEventProducer {
    private producer: Producer | null = null
    private eventBuffer: ClickEventPayload[] = []
    private readonly maxBufferSize = 10000
    private readonly flushInterval = 5000 // 5 seconds
    private flushTimer: NodeJS.Timeout | null = null
    private isProducerReady = false
    private isProcessing = false
    private initializationAttempts = 0
    private readonly maxInitializationAttempts = 5

    constructor() {
        this.initializeProducer()
        this.startBufferFlush()
    }

    /**
     * Initialize Kafka producer with retry logic
     */
    private async initializeProducer(): Promise<void> {
        try {
            this.initializationAttempts++

            logger.info("Initializing analytics event producer", {
                attempt: this.initializationAttempts
            })

            // Set a timeout for Kafka connection
            const connectPromise = kafka.connect()
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Kafka connection timeout')), 3000)
            )

            await Promise.race([connectPromise, timeoutPromise])
            this.producer = kafka.getProducer()
            this.isProducerReady = true

            logger.info("Analytics event producer initialized successfully")

            // Flush any buffered events
            if (this.eventBuffer.length > 0) {
                logger.info("Flushing buffered events after producer initialization", {
                    eventCount: this.eventBuffer.length
                })
                this.flushBuffer().catch((error) => {
                    logger.error("Failed to flush buffered events", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }

        } catch (error) {
            this.isProducerReady = false

            logger.warn("Kafka not available for analytics event producer", {
                error: error instanceof Error ? error.message : "Unknown error",
                attempt: this.initializationAttempts
            })

            // Only retry a few times with exponential backoff, then give up
            if (this.initializationAttempts < this.maxInitializationAttempts) {
                const retryDelay = Math.min(5000 * this.initializationAttempts, 30000)
                logger.info("Will retry producer initialization", {
                    nextAttempt: this.initializationAttempts + 1,
                    delayMs: retryDelay
                })

                setTimeout(() => {
                    this.initializeProducer().catch(() => {
                        // Error already logged in initializeProducer
                    })
                }, retryDelay)
            } else {
                logger.warn("Max Kafka initialization attempts reached, analytics will use direct database writes")
            }
        }
    }

    /**
     * Start periodic buffer flush
     */
    private startBufferFlush(): void {
        if (this.flushTimer) {
            return
        }

        this.flushTimer = setInterval(async () => {
            if (this.eventBuffer.length > 0 && !this.isProcessing) {
                await this.flushBuffer().catch((error) => {
                    logger.error("Periodic flush failed", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }
        }, this.flushInterval)

        logger.info("Analytics event producer buffer flush started")
    }

    /**
     * Publish click event to Kafka
     * WebSocket event is emitted IMMEDIATELY and ONLY ONCE here
     */
    public async publishClickEvent(eventData: CreateAnalyticsEventInput): Promise<void> {
        try {
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

            // Emit WebSocket event IMMEDIATELY (single source of truth)
            this.emitWebSocketEvent(event)

            // Add to buffer for Kafka
            this.eventBuffer.push(event)

            logger.debug("Click event added to Kafka buffer", {
                shortCode: event.shortCode,
                bufferSize: this.eventBuffer.length,
                isProducerReady: this.isProducerReady
            })

            // Flush if buffer is full or producer is ready
            if (this.eventBuffer.length >= this.maxBufferSize) {
                // Don't await - let it process in background
                this.flushBuffer().catch((error) => {
                    logger.error("Failed to flush buffer on max size", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            } else if (this.isProducerReady && this.eventBuffer.length > 0 && !this.isProcessing) {
                // Opportunistic flush for low latency
                this.flushBuffer().catch((error) => {
                    logger.error("Failed opportunistic flush", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }

        } catch (error) {
            logger.error("Error publishing click event to Kafka producer", {
                shortCode: eventData.short_code,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    /**
     * Emit WebSocket event (centralized, called once per click)
     */
    private emitWebSocketEvent(event: ClickEventPayload): void {
        try {
            const wsEvent = {
                shortCode: event.shortCode,
                timestamp: event.timestamp,
                country: event.countryCode || "Unknown",
                device: event.deviceType || "Unknown",
                browser: event.browser || "Unknown",
                referrer: event.referrer,
                ipAddress: event.ipAddress
            }

            websocketService.emitClickEvent(wsEvent)

            logger.debug("WebSocket click event emitted", {
                shortCode: event.shortCode,
                subscriberCount: websocketService.getSubscriberCount(event.shortCode)
            })

        } catch (error) {
            logger.warn("Failed to emit WebSocket event", {
                shortCode: event.shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Flush event buffer to Kafka
     */
    private async flushBuffer(): Promise<void> {
        if (this.eventBuffer.length === 0 || !this.isProducerReady || !this.producer || this.isProcessing) {
            return
        }

        this.isProcessing = true
        const eventsToSend = [...this.eventBuffer]
        this.eventBuffer = []

        try {
            const messages = eventsToSend.map((event) => ({
                key: event.shortCode,
                value: JSON.stringify(event),
                timestamp: new Date(event.timestamp).getTime().toString(),
                headers: {
                    eventType: "click",
                    version: "1.0",
                    eventId: event.eventId
                }
            }))

            await this.producer.send({
                topic: "url_clicks",
                messages
            })

            logger.info("Analytics events published to Kafka", {
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
            const remainingCapacity = this.maxBufferSize - this.eventBuffer.length
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

            // Mark producer as not ready and attempt reconnection
            this.isProducerReady = false
            this.initializationAttempts = 0

            setTimeout(() => {
                this.initializeProducer().catch(() => {
                    // Error already logged
                })
            }, 5000)

            throw error

        } finally {
            this.isProcessing = false
        }
    }

    /**
     * Publish bulk events
     */
    public async publishBulkEvents(events: CreateAnalyticsEventInput[]): Promise<void> {
        for (const event of events) {
            await this.publishClickEvent(event)
        }
    }

    /**
     * Get buffer statistics
     */
    public getBufferStats(): {
        bufferSize: number
        maxBufferSize: number
        isProducerReady: boolean
        isProcessing: boolean
    } {
        return {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize,
            isProducerReady: this.isProducerReady,
            isProcessing: this.isProcessing
        }
    }

    /**
     * Shutdown producer gracefully
     */
    public async shutdown(): Promise<void> {
        try {
            // Stop periodic flush
            if (this.flushTimer) {
                clearInterval(this.flushTimer)
                this.flushTimer = null
            }

            // Flush remaining events
            if (this.eventBuffer.length > 0) {
                logger.info("Flushing remaining events on shutdown", {
                    eventCount: this.eventBuffer.length
                })
                await this.flushBuffer()
            }

            logger.info("Analytics event producer shutdown complete")

        } catch (error) {
            logger.error("Error during analytics producer shutdown", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Force flush buffer (for testing)
     */
    public async forceFlush(): Promise<void> {
        await this.flushBuffer()
    }

    /**
     * Manually retry producer initialization
     */
    public async retryInitialization(): Promise<void> {
        if (!this.isProducerReady) {
            this.initializationAttempts = 0
            await this.initializeProducer()
        }
    }
}

// Singleton instance
export const analyticsEventProducer = new AnalyticsEventProducer()
export default analyticsEventProducer