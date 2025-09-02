import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { config } from '../config/environment';

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

    // Get system information
    const memUsage = process.memoryUsage();
    const os = require('os');
    const totalMemory = os.totalmem();
    const loadAverage = os.loadavg();

    // Determine overall health
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

        if (dbReady && redisReady) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'ready',
                    cache: 'ready',
                },
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: dbReady ? 'ready' : 'not ready',
                    cache: redisReady ? 'ready' : 'not ready',
                },
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

export default router;
