import { analyticsEventConsumer } from "./analyticsEventConsumer"
import { analyticsAggregator } from "./analyticsAggregator"
import { logger } from "../config/logger"

/**
 * Analytics Service Manager
 * Manages both the event consumer and aggregator services
 */
class AnalyticsService {
    private isRunning = false

    public async start(): Promise<void> {
        try {
            if (this.isRunning) {
                logger.warn("Analytics service is already running")
                return
            }

            logger.info("Starting analytics service...")

            // Try to start event consumer first (to store raw events)
            try {
                await analyticsEventConsumer.start()
                logger.info("Analytics event consumer started successfully")
            } catch (error) {
                logger.warn("Failed to start analytics event consumer, will rely on direct analytics service", {
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            }

            // Try to start aggregator (to create summaries)
            try {
                await analyticsAggregator.start()
                logger.info("Analytics aggregator started successfully")
            } catch (error) {
                logger.warn("Failed to start analytics aggregator", {
                    error: error instanceof Error ? error.message : "Unknown error"
                })
            }

            this.isRunning = true
            logger.info("Analytics service started (with possible fallbacks)")
        } catch (error) {
            logger.error("Failed to start analytics service", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            // Don't throw error - let the service start with limited functionality
            this.isRunning = true
        }
    }

    public async stop(): Promise<void> {
        try {
            if (!this.isRunning) {
                logger.warn("Analytics service is not running")
                return
            }

            logger.info("Stopping analytics service...")

            // Stop aggregator first
            await analyticsAggregator.stop()

            // Stop event consumer
            await analyticsEventConsumer.stop()

            this.isRunning = false
            logger.info("Analytics service stopped successfully")
        } catch (error) {
            logger.error("Error stopping analytics service", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    public getStats(): {
        isRunning: boolean
        consumer: ReturnType<typeof analyticsEventConsumer.getStats>
        aggregator: ReturnType<typeof analyticsAggregator.getStats>
    } {
        return {
            isRunning: this.isRunning,
            consumer: analyticsEventConsumer.getStats(),
            aggregator: analyticsAggregator.getStats()
        }
    }

    public async healthCheck(): Promise<{
        service: boolean
        consumer: boolean
        aggregator: boolean
    }> {
        const consumerStats = analyticsEventConsumer.getStats()
        const aggregatorStats = analyticsAggregator.getStats()

        return {
            service: this.isRunning,
            consumer: consumerStats.isRunning,
            aggregator: aggregatorStats.isRunning
        }
    }
}

export const analyticsService = new AnalyticsService()
export default analyticsService