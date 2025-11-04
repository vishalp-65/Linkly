import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { kafka } from '../config/kafka';
import { logger } from '../config/logger';
import { config } from '../config/environment';
import { metricsService } from '../services/metricsService';

const router = Router();

interface HealthService {
    status: 'healthy' | 'unhealthy';
    responseTime: number;
    error?: string;
}

interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: {
        database: HealthService;
        cache: HealthService;
        kafka?: HealthService;
    };
    system: {
        memory: {
            used: number;
            total: number;
            percentage: number;
        };
        cpu: {
            loadAverage: number[];
        };
    };
}

// Basic health check endpoint
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    // Check database health
    const dbStart = Date.now();
    let dbHealth: HealthService = { status: 'healthy', responseTime: 0 };
    try {
        const isDbHealthy = await db.healthCheck();
        dbHealth = {
            status: isDbHealthy ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - dbStart,
        };
    } catch (error) {
        dbHealth = {
            status: 'unhealthy',
            responseTime: Date.now() - dbStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // Check Redis health
    const redisStart = Date.now();
    let redisHealth: HealthService = { status: 'healthy', responseTime: 0 };
    try {
        const isRedisHealthy = await redis.healthCheck();
        redisHealth = {
            status: isRedisHealthy ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - redisStart,
        };
    } catch (error) {
        redisHealth = {
            status: 'unhealthy',
            responseTime: Date.now() - redisStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // Check Kafka health (optional service)
    const kafkaStart = Date.now();
    let kafkaHealth: HealthService | undefined;
    try {
        const isKafkaHealthy = await kafka.healthCheck();
        kafkaHealth = {
            status: isKafkaHealthy ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - kafkaStart,
        };
    } catch (error) {
        kafkaHealth = {
            status: 'unhealthy',
            responseTime: Date.now() - kafkaStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }

    // Get system information
    const memUsage = process.memoryUsage();
    const os = require('os');
    const totalMemory = os.totalmem();
    const loadAverage = os.loadavg();

    // Determine overall health (Kafka is optional, so don't fail if it's down)
    const isHealthy = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';

    const healthResult: HealthCheckResult = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: config.nodeEnv,
        services: {
            database: dbHealth,
            cache: redisHealth,
            ...(kafkaHealth && { kafka: kafkaHealth }),
        },
        system: {
            memory: {
                used: memUsage.heapUsed,
                total: totalMemory,
                percentage: Math.round((memUsage.heapUsed / totalMemory) * 100),
            },
            cpu: {
                loadAverage,
            },
        },
    };

    const totalResponseTime = Date.now() - startTime;

    // Log health check if it's slow or unhealthy
    if (totalResponseTime > 1000 || !isHealthy) {
        logger.warn('Health check completed', {
            status: healthResult.status,
            responseTime: totalResponseTime,
            dbResponseTime: dbHealth.responseTime,
            redisResponseTime: redisHealth.responseTime,
        });
    }

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthResult);
}));

// Readiness check (for Kubernetes)
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
    try {
        // Check if all critical services are ready
        const dbReady = await db.healthCheck();
        const redisReady = await redis.healthCheck();

        // Kafka is optional - service can work without it
        let kafkaReady = true;
        try {
            kafkaReady = await kafka.healthCheck();
        } catch (error) {
            logger.warn('Kafka health check failed during readiness check', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't fail readiness if Kafka is down
        }

        const services = {
            database: dbReady ? 'ready' : 'not ready',
            cache: redisReady ? 'ready' : 'not ready',
            kafka: kafkaReady ? 'ready' : 'degraded',
        };

        // Service is ready if critical services (DB and Redis) are healthy
        const isReady = dbReady && redisReady;

        if (isReady) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                services,
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                services,
            });
        }
    } catch (error) {
        logger.error('Readiness check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: 'Service check failed',
        });
    }
}));

// Liveness check (for Kubernetes)
router.get('/live', (req: Request, res: Response) => {
    // Simple liveness check - if the process is running, it's alive
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
    });
});

// Database connection pool stats
router.get('/health/database', asyncHandler(async (req: Request, res: Response) => {
    try {
        const poolStats = db.getPoolStats();
        const isHealthy = await db.healthCheck();

        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            pool: poolStats,
        });
    } catch (error) {
        logger.error('Database health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

// Redis health check
router.get('/health/cache', asyncHandler(async (req: Request, res: Response) => {
    try {
        const isHealthy = await redis.healthCheck();

        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Redis health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

// Kafka health check
router.get('/health/kafka', asyncHandler(async (req: Request, res: Response) => {
    try {
        const isHealthy = await kafka.healthCheck();

        res.json({
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Kafka health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

// Comprehensive health check with detailed system information
router.get('/health/detailed', asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        // Check all services with timing
        const [dbResult, redisResult, kafkaResult] = await Promise.allSettled([
            (async () => {
                const start = Date.now();
                const healthy = await db.healthCheck();
                return { healthy, responseTime: Date.now() - start };
            })(),
            (async () => {
                const start = Date.now();
                const healthy = await redis.healthCheck();
                return { healthy, responseTime: Date.now() - start };
            })(),
            (async () => {
                const start = Date.now();
                try {
                    const healthy = await kafka.healthCheck();
                    return { healthy, responseTime: Date.now() - start };
                } catch (error) {
                    return {
                        healthy: false,
                        responseTime: Date.now() - start,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            })(),
        ]);

        // Get system metrics
        const memUsage = process.memoryUsage();
        const os = require('os');
        const cpuUsage = process.cpuUsage();

        // Get database pool stats
        const dbPoolStats = db.getPoolStats();

        // Calculate health scores
        const dbHealth = dbResult.status === 'fulfilled' ? dbResult.value : { healthy: false, responseTime: 0, error: 'Check failed' };
        const redisHealth = redisResult.status === 'fulfilled' ? redisResult.value : { healthy: false, responseTime: 0, error: 'Check failed' };
        const kafkaHealth = kafkaResult.status === 'fulfilled' ? kafkaResult.value : { healthy: false, responseTime: 0, error: 'Check failed' };

        const overallHealth = dbHealth.healthy && redisHealth.healthy;
        const totalResponseTime = Date.now() - startTime;

        const detailedHealth = {
            status: overallHealth ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: config.nodeEnv,
            responseTime: totalResponseTime,

            services: {
                database: {
                    status: dbHealth.healthy ? 'healthy' : 'unhealthy',
                    responseTime: dbHealth.responseTime,
                    error: 'error' in dbHealth ? dbHealth.error : undefined,
                    pool: dbPoolStats,
                },
                cache: {
                    status: redisHealth.healthy ? 'healthy' : 'unhealthy',
                    responseTime: redisHealth.responseTime,
                    error: 'error' in redisHealth ? redisHealth.error : undefined,
                },
                analytics: {
                    status: kafkaHealth.healthy ? 'healthy' : 'degraded',
                    responseTime: kafkaHealth.responseTime,
                    error: 'error' in kafkaHealth ? kafkaHealth.error : undefined,
                    note: 'Optional service - system can operate without it',
                },
            },

            system: {
                memory: {
                    rss: memUsage.rss,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                    arrayBuffers: memUsage.arrayBuffers,
                    totalSystem: os.totalmem(),
                    freeSystem: os.freemem(),
                    usagePercentage: Math.round((memUsage.heapUsed / os.totalmem()) * 100),
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system,
                    loadAverage: os.loadavg(),
                    cores: os.cpus().length,
                },
                process: {
                    pid: process.pid,
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                },
                network: {
                    hostname: os.hostname(),
                    networkInterfaces: Object.keys(os.networkInterfaces()),
                },
            },

            performance: {
                eventLoopDelay: typeof process.hrtime.bigint === 'function' ? 'Available' : 'Not available',
                gcStats: 'Available via metrics endpoint',
            },
        };

        const statusCode = overallHealth ? 200 : 503;
        res.status(statusCode).json(detailedHealth);

    } catch (error) {
        logger.error('Detailed health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check system failure',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}));

// Prometheus metrics endpoint
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
    try {
        const metrics = await metricsService.getMetrics();

        res.set('Content-Type', metricsService.getContentType());
        res.send(metrics);
    } catch (error) {
        logger.error('Failed to collect metrics', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(500).json({
            error: 'Failed to collect metrics',
            timestamp: new Date().toISOString(),
        });
    }
}));

export default router;
