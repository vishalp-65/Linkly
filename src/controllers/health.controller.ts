import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { kafka } from '../config/kafka';
import { config } from '../config/environment';
import { metricsService } from '../services/metricsService';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';

export class HealthController {
    basicHealthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const startTime = Date.now();

        try {
            const [dbHealth, redisHealth, kafkaHealth] = await Promise.allSettled([
                this.checkService('database', () => db.healthCheck()),
                this.checkService('cache', () => redis.healthCheck()),
                this.checkService('kafka', () => kafka.healthCheck())
            ]);

            const memUsage = process.memoryUsage();
            const os = require('os');
            const totalMemory = os.totalmem();

            const dbHealthResult = dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'unhealthy' as const, responseTime: 0 };
            const redisHealthResult = redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'unhealthy' as const, responseTime: 0 };
            const kafkaHealthResult = kafkaHealth.status === 'fulfilled' ? kafkaHealth.value : { status: 'unhealthy' as const, responseTime: 0 };

            const isHealthy = dbHealthResult.status === 'healthy' && redisHealthResult.status === 'healthy';

            const healthResult = {
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                environment: config.nodeEnv,
                services: {
                    database: dbHealthResult,
                    cache: redisHealthResult,
                    kafka: kafkaHealthResult
                },
                system: {
                    memory: {
                        used: memUsage.heapUsed,
                        total: totalMemory,
                        percentage: Math.round((memUsage.heapUsed / totalMemory) * 100)
                    },
                    cpu: {
                        loadAverage: os.loadavg()
                    }
                }
            };

            const totalResponseTime = Date.now() - startTime;

            if (totalResponseTime > 1000 || !isHealthy) {
                logger.warn('Health check completed', {
                    status: healthResult.status,
                    responseTime: totalResponseTime
                });
            }

            res.status(isHealthy ? 200 : 503).json(healthResult);

        } catch (error) {
            next(error);
        }
    };

    readinessCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const dbReady = await db.healthCheck();
            const redisReady = await redis.healthCheck();

            let kafkaReady = true;
            try {
                kafkaReady = await kafka.healthCheck();
            } catch (error) {
                logger.warn('Kafka health check failed during readiness check');
            }

            const services = {
                database: dbReady ? 'ready' : 'not ready',
                cache: redisReady ? 'ready' : 'not ready',
                kafka: kafkaReady ? 'ready' : 'degraded'
            };

            const isReady = dbReady && redisReady;

            res.status(isReady ? 200 : 503).json({
                status: isReady ? 'ready' : 'not ready',
                timestamp: new Date().toISOString(),
                services
            });

        } catch (error) {
            logger.error('Readiness check failed');
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                error: 'Service check failed'
            });
        }
    };

    livenessCheck = (req: Request, res: Response): void => {
        res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            pid: process.pid
        });
    };

    getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const metrics = await metricsService.getMetrics();
            res.set('Content-Type', metricsService.getContentType());
            res.send(metrics);
        } catch (error) {
            next(error);
        }
    };

    private async checkService(
        name: string,
        checkFn: () => Promise<boolean>
    ): Promise<{ status: 'healthy' | 'unhealthy'; responseTime: number; error?: string }> {
        const start = Date.now();
        try {
            const isHealthy = await checkFn();
            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - start
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                responseTime: Date.now() - start,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
