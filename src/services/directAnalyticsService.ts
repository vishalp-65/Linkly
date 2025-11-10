import { db } from "../config/database"
import { logger } from "../config/logger"
import { CreateAnalyticsEventInput } from "../types/database"
import { v4 as uuidv4 } from "uuid"
import { websocketService } from "./websocketService"
import { analyticsCacheService } from "./analyticsCacheService"

/**
 * Direct Analytics Service
 * Fallback service that directly inserts analytics events to database
 * Used when Kafka is not available
 * 
 * IMPORTANT: This service emits WebSocket events ONCE per click
 */
class DirectAnalyticsService {
    private eventBuffer: CreateAnalyticsEventInput[] = []
    private readonly maxBufferSize = 100
    private readonly flushInterval = 1000 // 1 second
    private flushTimer: NodeJS.Timeout | null = null
    private isRunning = false
    private isProcessing = false

    constructor() {
        this.startPeriodicFlush()
    }

    /**
     * Publish click event to database
     * WebSocket event is emitted IMMEDIATELY and ONLY ONCE here
     */
    public async publishClickEvent(eventData: CreateAnalyticsEventInput): Promise<void> {
        try {
            // Parse user agent if not already parsed
            if (eventData.user_agent && !eventData.device_type) {
                const deviceInfo = this.parseUserAgent(eventData.user_agent)
                eventData.device_type = deviceInfo.device
                eventData.browser = deviceInfo.browser
                eventData.os = deviceInfo.os
            }

            // Set defaults for missing data
            if (!eventData.device_type) eventData.device_type = "Desktop"
            if (!eventData.browser) eventData.browser = "Unknown"
            if (!eventData.os) eventData.os = "Unknown"

            // Emit WebSocket event IMMEDIATELY (single source of truth)
            this.emitWebSocketEvent(eventData)

            // Add to buffer for database insertion
            this.eventBuffer.push(eventData)

            logger.debug("Click event added to direct analytics buffer", {
                shortCode: eventData.short_code,
                bufferSize: this.eventBuffer.length
            })

            // Flush if buffer is full
            if (this.eventBuffer.length >= this.maxBufferSize) {
                // Don't await - let it process in background
                this.flushBuffer().catch((error) => {
                    logger.error("Failed to flush buffer on max size", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }

        } catch (error) {
            logger.error("Error publishing click event to direct analytics", {
                shortCode: eventData.short_code,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    /**
     * Emit WebSocket event (centralized, called once per click)
     */
    private emitWebSocketEvent(eventData: CreateAnalyticsEventInput): void {
        try {
            const wsEvent = {
                shortCode: eventData.short_code,
                timestamp: (eventData.clicked_at || new Date()).toISOString(),
                country: eventData.country_code || "Unknown",
                device: eventData.device_type || "Unknown",
                browser: eventData.browser || "Unknown",
                referrer: eventData.referrer,
                ipAddress: eventData.ip_address
            }

            websocketService.emitClickEvent(wsEvent)

            logger.debug("WebSocket click event emitted", {
                shortCode: eventData.short_code,
                subscriberCount: websocketService.getSubscriberCount(eventData.short_code)
            })

        } catch (error) {
            logger.warn("Failed to emit WebSocket event", {
                shortCode: eventData.short_code,
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Start periodic buffer flush
     */
    private startPeriodicFlush(): void {
        if (this.flushTimer) {
            return
        }

        this.isRunning = true
        this.flushTimer = setInterval(async () => {
            if (this.eventBuffer.length > 0 && !this.isProcessing) {
                await this.flushBuffer().catch((error) => {
                    logger.error("Periodic flush failed", {
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }
        }, this.flushInterval)

        logger.info("Direct analytics service started")
    }

    /**
     * Flush event buffer to database
     */
    private async flushBuffer(): Promise<void> {
        if (this.eventBuffer.length === 0 || this.isProcessing) {
            return
        }

        this.isProcessing = true
        const eventsToInsert = [...this.eventBuffer]
        this.eventBuffer = []

        const client = await db.getClient()

        try {
            await client.query("BEGIN")

            logger.debug("Flushing direct analytics buffer to database", {
                eventCount: eventsToInsert.length
            })

            // Batch insert using single query with multiple value sets
            const values: any[] = []
            const placeholders: string[] = []
            let paramIndex = 1

            for (let i = 0; i < eventsToInsert.length; i++) {
                const event = eventsToInsert[i]
                const eventId = uuidv4()

                placeholders.push(
                    `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
                )

                values.push(
                    eventId,
                    event.short_code,
                    event.clicked_at || new Date(),
                    event.ip_address,
                    event.user_agent,
                    event.referrer,
                    event.country_code,
                    event.region,
                    event.city,
                    event.device_type,
                    event.browser,
                    event.os
                )
            }

            const insertQuery = `
                INSERT INTO analytics_events (
                    event_id, short_code, clicked_at, ip_address, user_agent, 
                    referrer, country_code, region, city, device_type, browser, os
                ) VALUES ${placeholders.join(", ")}
            `

            await client.query(insertQuery, values)
            await client.query("COMMIT")

            logger.info("Direct analytics events flushed to database", {
                eventCount: eventsToInsert.length
            })

            // Invalidate analytics cache for affected short codes
            const uniqueShortCodes = new Set(eventsToInsert.map(e => e.short_code))
            for (const shortCode of uniqueShortCodes) {
                analyticsCacheService.invalidateAnalytics(shortCode).catch((error) => {
                    logger.warn("Failed to invalidate analytics cache", {
                        shortCode,
                        error: error instanceof Error ? error.message : "Unknown error"
                    })
                })
            }

        } catch (error) {
            await client.query("ROLLBACK")

            logger.error("Failed to flush direct analytics events to database", {
                error: error instanceof Error ? error.message : "Unknown error",
                eventCount: eventsToInsert.length,
                stack: error instanceof Error ? error.stack : undefined
            })

            // Re-queue events if buffer has space
            const remainingCapacity = this.maxBufferSize - this.eventBuffer.length
            if (remainingCapacity > 0) {
                const eventsToRequeue = eventsToInsert.slice(0, remainingCapacity)
                this.eventBuffer.unshift(...eventsToRequeue)

                logger.warn("Re-queued direct analytics events for retry", {
                    requeuedCount: eventsToRequeue.length,
                    droppedCount: eventsToInsert.length - eventsToRequeue.length
                })
            } else {
                logger.error("Direct analytics buffer full, dropping events", {
                    droppedCount: eventsToInsert.length
                })
            }

            throw error

        } finally {
            client.release()
            this.isProcessing = false
        }
    }

    /**
     * Shutdown service gracefully
     */
    public async shutdown(): Promise<void> {
        try {
            this.isRunning = false

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

            logger.info("Direct analytics service shutdown completed")

        } catch (error) {
            logger.error("Error during direct analytics service shutdown", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    /**
     * Get buffer statistics
     */
    public getBufferStats(): {
        bufferSize: number
        maxBufferSize: number
        isRunning: boolean
        isProcessing: boolean
    } {
        return {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize,
            isRunning: this.isRunning,
            isProcessing: this.isProcessing
        }
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
     * Force flush buffer (for testing)
     */
    public async forceFlush(): Promise<void> {
        await this.flushBuffer()
    }
}

export const directAnalyticsService = new DirectAnalyticsService()
export default directAnalyticsService