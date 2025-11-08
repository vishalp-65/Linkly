import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import { config } from "./config/environment"
import { logger } from "./config/logger"
import { db } from "./config/database"
import { redis } from "./config/redis"
import { kafka } from "./config/kafka"
import { errorHandler, notFoundHandler } from "./middleware/errorHandler"
import { skipHealthCheckLogs } from "./middleware/requestLogger"
import {
    connectionCounterMiddleware,
    skipMetrics
} from "./middleware/metricsMiddleware"
import {
    tracingMiddleware,
    traceContextMiddleware
} from "./middleware/tracingMiddleware"
import { ExpiryManagerService } from "./services/expiryManagerService"
import { analyticsService } from "./services/analyticsService"
import { directAnalyticsService } from "./services/directAnalyticsService"
import routes from "./routes"

class App {
    public app: express.Application
    private expiryManager: ExpiryManagerService

    constructor() {
        this.app = express()
        this.expiryManager = new ExpiryManagerService()
        this.initializeMiddleware()
        this.initializeRoutes()
        this.initializeErrorHandling()
    }

    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"]
                    }
                },
                hsts: {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true
                }
            })
        )

        console.log(
            "CORS Origin:",
            !config.isDevelopment
                ? "Development Mode - All Origins Allowed"
                : process.env.ALLOWED_ORIGINS
        )

        // CORS configuration
        this.app.use(
            cors({
                origin: config.isDevelopment
                    ? true
                    : process.env.ALLOWED_ORIGINS?.split(",") || false,
                credentials: true,
                methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"]
            })
        )

        // Compression middleware
        this.app.use(
            compression({
                filter: (req, res) => {
                    if (req.headers["x-no-compression"]) {
                        return false
                    }
                    return compression.filter(req, res)
                },
                threshold: 1024 // Only compress responses larger than 1KB
            })
        )

        // Body parsing middleware
        this.app.use(
            express.json({
                limit: "10mb",
                strict: true
            })
        )
        this.app.use(
            express.urlencoded({
                extended: true,
                limit: "10mb"
            })
        )

        // Request logging middleware (skip for health checks)
        this.app.use(skipHealthCheckLogs)

        // Tracing middleware (adds custom spans and attributes)
        this.app.use(tracingMiddleware)

        // Trace context middleware (adds trace IDs to logs and headers)
        this.app.use(traceContextMiddleware)

        // Metrics collection middleware (skip for metrics endpoint)
        this.app.use(skipMetrics)

        // Connection counter middleware
        this.app.use(connectionCounterMiddleware)

        // Trust proxy (for accurate IP addresses behind load balancers)
        this.app.set("trust proxy", 1)
    }

    private initializeRoutes(): void {
        // Application routes
        this.app.use(routes)

        // Root endpoint
        this.app.get("/info", (req, res) => {
            res.json({
                name: "URL Shortener API",
                version: "1.0.0",
                environment: config.nodeEnv,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                endpoints: {
                    shorten: "/api/v1/shorten",
                    analytics: "/api/v1/analytics",
                    health: "/health",
                    docs: "/api/docs"
                }
            })
        })
    }

    private initializeErrorHandling(): void {
        // 404 handler
        this.app.use(notFoundHandler)

        // Global error handler
        this.app.use(errorHandler)
    }

    public async initialize(): Promise<void> {
        try {
            // Initialize database connection
            logger.info("Initializing database connection...")
            const dbHealthy = await db.healthCheck()
            if (!dbHealthy) {
                throw new Error("Database connection failed")
            }
            logger.info("Database connection established")

            // Initialize Redis connection
            logger.info("Initializing Redis connection...")
            await redis.connect()
            const redisHealthy = await redis.healthCheck()
            if (!redisHealthy) {
                throw new Error("Redis connection failed")
            }
            logger.info("Redis connection established")

            // Initialize Kafka connection (optional - service will work without it)
            logger.info("Checking Kafka availability...")
            try {
                // Set a short timeout for Kafka connection attempt
                const kafkaConnectPromise = kafka.connect()
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Kafka connection timeout')), 3000)
                )

                await Promise.race([kafkaConnectPromise, timeoutPromise])
                const kafkaHealthy = await kafka.healthCheck()
                if (kafkaHealthy) {
                    logger.info("Kafka connection established")
                } else {
                    logger.warn(
                        "Kafka not available, analytics will use direct database writes"
                    )
                }
            } catch (error) {
                logger.warn(
                    "Kafka not available, analytics will use direct database writes",
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown error"
                    }
                )
            }

            // Start expiry management background jobs
            logger.info("Starting expiry management service...")
            this.expiryManager.start()
            logger.info("Expiry management service started")

            // Start analytics service (only if Kafka is available)
            try {
                logger.info("Starting analytics service...")
                await analyticsService.start()
                logger.info("Analytics service started")
            } catch (error) {
                logger.warn(
                    "Analytics service failed to start, analytics will be limited",
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown error"
                    }
                )
            }

            logger.info("Application initialized successfully")
        } catch (error) {
            logger.error("Application initialization failed", {
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }
    }

    public async shutdown(): Promise<void> {
        logger.info("Shutting down application...")

        try {
            // Stop analytics services
            try {
                logger.info("Stopping analytics service...")
                await analyticsService.stop()
                logger.info("Analytics service stopped")
            } catch (error) {
                logger.warn("Error stopping analytics service", {
                    error:
                        error instanceof Error ? error.message : "Unknown error"
                })
            }

            try {
                logger.info("Stopping direct analytics service...")
                await directAnalyticsService.shutdown()
                logger.info("Direct analytics service stopped")
            } catch (error) {
                logger.warn("Error stopping direct analytics service", {
                    error:
                        error instanceof Error ? error.message : "Unknown error"
                })
            }

            // Stop expiry management service
            logger.info("Stopping expiry management service...")
            this.expiryManager.stop()
            logger.info("Expiry management service stopped")

            // Close database connections
            await db.close()
            logger.info("Database connections closed")

            // Close Redis connections
            await redis.close()
            logger.info("Redis connections closed")

            // Close Kafka connections
            try {
                await kafka.disconnect()
                logger.info("Kafka connections closed")
            } catch (error) {
                logger.warn("Error closing Kafka connections", {
                    error:
                        error instanceof Error ? error.message : "Unknown error"
                })
            }

            logger.info("Application shutdown completed")
        } catch (error) {
            logger.error("Error during application shutdown", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    /**
     * Get expiry manager service for external access
     */
    public getExpiryManager(): ExpiryManagerService {
        return this.expiryManager
    }
}

export default App
