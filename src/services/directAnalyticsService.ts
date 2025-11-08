import { db } from "../config/database"
import { logger } from "../config/logger"
import { CreateAnalyticsEventInput } from "../types/database"
import { v4 as uuidv4 } from "uuid"
import { websocketService } from "./websocketService"

/**
 * Direct Analytics Service
 * Fallback service that directly inserts analytics events to database
 * Used when Kafka is not available
 */
class DirectAnalyticsService {
    private eventBuffer: CreateAnalyticsEventInput[] = []
    private readonly maxBufferSize = 100
    private readonly flushInterval = 1000 // 1 second
    private flushTimer: NodeJS.Timeout | null = null
    private isRunning = false

    constructor() {
        this.startPeriodicFlush()
    }

    public async publishClickEvent(eventData: CreateAnalyticsEventInput): Promise<void> {
        console.log("DIRECT ANALYTICS: Received click event", { eventData })

        // Parse user agent if not already parsed
        if (eventData.user_agent && !eventData.device_type) {
            const deviceInfo = this.parseUserAgent(eventData.user_agent)
            eventData.device_type = deviceInfo.device
            eventData.browser = deviceInfo.browser
            eventData.os = deviceInfo.os
        }

        // Emit real-time WebSocket event (don't wait for database)
        try {
            websocketService.emitClickEvent({
                shortCode: eventData.short_code,
                timestamp: (eventData.clicked_at || new Date()).toISOString(),
                country: eventData.country_code,
                device: eventData.device_type,
                browser: eventData.browser,
                referrer: eventData.referrer,
                ipAddress: eventData.ip_address
            })
        } catch (error) {
            logger.warn("Failed to emit WebSocket click event", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }

        // Add to buffer
        this.eventBuffer.push(eventData)

        console.log("DIRECT ANALYTICS: Added to buffer", {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize
        })

        // Check if buffer is full
        if (this.eventBuffer.length >= this.maxBufferSize) {
            await this.flushBuffer()
        }
    }

    private startPeriodicFlush(): void {
        if (this.flushTimer) {
            return
        }

        this.isRunning = true
        this.flushTimer = setInterval(async () => {
            if (this.eventBuffer.length > 0) {
                await this.flushBuffer()
            }
        }, this.flushInterval)

        logger.info("Direct analytics service started")
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

            console.log("DIRECT ANALYTICS: Inserting events to database", {
                eventCount: eventsToInsert.length
            })

            // Batch insert events
            const insertQuery = `
                INSERT INTO analytics_events (
                    event_id, short_code, clicked_at, ip_address, user_agent, 
                    referrer, country_code, region, city, device_type, browser, os
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `

            for (const event of eventsToInsert) {
                await client.query(insertQuery, [
                    uuidv4(),
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
                ])
            }

            await client.query("COMMIT")

            console.log("DIRECT ANALYTICS: Successfully inserted events to database", {
                eventCount: eventsToInsert.length
            })

            logger.debug("Direct analytics events inserted to database", {
                eventCount: eventsToInsert.length
            })
        } catch (error) {
            await client.query("ROLLBACK")

            // Re-add events to buffer for retry (up to max buffer size)
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

            logger.error("Failed to insert direct analytics events to database", {
                error: error instanceof Error ? error.message : "Unknown error",
                eventCount: eventsToInsert.length,
                stack: error instanceof Error ? error.stack : undefined
            })

            throw error
        } finally {
            client.release()
        }
    }

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
                await this.flushBuffer()
            }

            logger.info("Direct analytics service shutdown completed")
        } catch (error) {
            logger.error("Error during direct analytics service shutdown", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
        }
    }

    public getBufferStats(): {
        bufferSize: number
        maxBufferSize: number
        isRunning: boolean
    } {
        return {
            bufferSize: this.eventBuffer.length,
            maxBufferSize: this.maxBufferSize,
            isRunning: this.isRunning
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

        // Detect device type
        let device = "Desktop"
        if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
            device = "Mobile"
        } else if (ua.includes("tablet") || ua.includes("ipad")) {
            device = "Tablet"
        }

        // Detect browser
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

        // Detect OS
        let os = "Unknown"
        if (ua.includes("windows")) {
            os = "Windows"
        } else if (ua.includes("mac os") || ua.includes("macos")) {
            os = "Linux"
        } else if (ua.includes("linux")) {
            os = "Linux"
        } else if (ua.includes("android")) {
            os = "Android"
        } else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) {
            os = "iOS"
        }

        return { device, browser, os }
    }
}

export const directAnalyticsService = new DirectAnalyticsService()
export default directAnalyticsService