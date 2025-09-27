import { db } from '../config/database';
import { redis } from '../config/redis';
import { kafka } from '../config/kafka';
import { logger } from '../config/logger';
import { config } from '../config/environment';

/**
 * Health Check Service
 * Provides programmatic health checking capabilities
 */

export interface ServiceHealth {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime: number;
    error?: string;
    metadata?: Record<string, any>;
}

export interface SystemHealth {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    version: string;
    environment: string;
    services: ServiceHealth[];
    system: {
        memory: {
            used: number;
            total: number;
            percentage: number;
            details: NodeJS.MemoryUsage;
        };
        cpu: {
            usage: NodeJS.CpuUsage;
            loadAverage: number[];
            cores: number;
        };
        process: {
            pid: number;
            nodeVersion: string;
            platform: string;
            arch: string;
        };
    };
}

export interface HealthCheckOptions {
    includeOptionalServices?: boolean;
    timeout?: number;
    includeSystemInfo?: boolean;
}

export class HealthCheckService {
    private readonly defaultTimeout = 5000; // 5 seconds

    /**
     * Perform comprehensive health check
     */
    async checkHealth(options: HealthCheckOptions = {}): Promise<SystemHealth> {
        const startTime = Date.now();
        const {
            includeOptionalServices = true,
            timeout = this.defaultTimeout,
            includeSystemInfo = true,
        } = options;

        try {
            // Check critical services
            const criticalServices = await this.checkCriticalServices(timeout);

            // Check optional services if requested
            const optionalServices = includeOptionalServices
                ? await this.checkOptionalServices(timeout)
                : [];

            const allServices = [...criticalServices, ...optionalServices];

            // Determine overall health
            const overallStatus = this.determineOverallHealth(allServices);

            // Get system information if requested
            const systemInfo = includeSystemInfo ? this.getSystemInfo() : this.getMinimalSystemInfo();

            return {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                environment: config.nodeEnv,
                services: allServices,
                system: systemInfo,
            };
        } catch (error) {
            logger.error('Health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime,
            });

            throw error;
        }
    }

    /**
     * Check only critical services (database and cache)
     */
    async checkCriticalServices(timeout: number): Promise<ServiceHealth[]> {
        const services: ServiceHealth[] = [];

        // Database health check
        try {
            const dbStart = Date.now();
            const dbHealthy = await Promise.race([
                db.healthCheck(),
                this.timeoutPromise(timeout, 'Database health check timeout'),
            ]);

            const dbPoolStats = db.getPoolStats();

            services.push({
                name: 'database',
                status: dbHealthy ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - dbStart,
                metadata: {
                    pool: dbPoolStats,
                    type: 'postgresql',
                },
            });
        } catch (error) {
            services.push({
                name: 'database',
                status: 'unhealthy',
                responseTime: timeout,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Redis health check
        try {
            const redisStart = Date.now();
            const redisHealthy = await Promise.race([
                redis.healthCheck(),
                this.timeoutPromise(timeout, 'Redis health check timeout'),
            ]);

            services.push({
                name: 'cache',
                status: redisHealthy ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - redisStart,
                metadata: {
                    type: 'redis',
                },
            });
        } catch (error) {
            services.push({
                name: 'cache',
                status: 'unhealthy',
                responseTime: timeout,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        return services;
    }

    /**
     * Check optional services (Kafka, etc.)
     */
    async checkOptionalServices(timeout: number): Promise<ServiceHealth[]> {
        const services: ServiceHealth[] = [];

        // Kafka health check (optional service)
        try {
            const kafkaStart = Date.now();
            const kafkaHealthy = await Promise.race([
                kafka.healthCheck(),
                this.timeoutPromise(timeout, 'Kafka health check timeout'),
            ]);

            services.push({
                name: 'analytics',
                status: kafkaHealthy ? 'healthy' : 'degraded',
                responseTime: Date.now() - kafkaStart,
                metadata: {
                    type: 'kafka',
                    optional: true,
                    note: 'Service can operate without this component',
                },
            });
        } catch (error) {
            services.push({
                name: 'analytics',
                status: 'degraded',
                responseTime: timeout,
                error: error instanceof Error ? error.message : 'Unknown error',
                metadata: {
                    type: 'kafka',
                    optional: true,
                    note: 'Service can operate without this component',
                },
            });
        }

        return services;
    }

    /**
     * Determine overall system health based on service health
     */
    private determineOverallHealth(services: ServiceHealth[]): 'healthy' | 'unhealthy' | 'degraded' {
        const criticalServices = services.filter(s =>
            s.name === 'database' || s.name === 'cache'
        );

        const optionalServices = services.filter(s =>
            s.metadata?.optional === true
        );

        // If any critical service is unhealthy, system is unhealthy
        const criticalUnhealthy = criticalServices.some(s => s.status === 'unhealthy');
        if (criticalUnhealthy) {
            return 'unhealthy';
        }

        // If all critical services are healthy but some optional services are degraded
        const optionalDegraded = optionalServices.some(s => s.status === 'degraded' || s.status === 'unhealthy');
        if (optionalDegraded) {
            return 'degraded';
        }

        return 'healthy';
    }

    /**
     * Get comprehensive system information
     */
    private getSystemInfo() {
        const memUsage = process.memoryUsage();
        const os = require('os');
        const cpuUsage = process.cpuUsage();

        return {
            memory: {
                used: memUsage.heapUsed,
                total: os.totalmem(),
                percentage: Math.round((memUsage.heapUsed / os.totalmem()) * 100),
                details: memUsage,
            },
            cpu: {
                usage: cpuUsage,
                loadAverage: os.loadavg(),
                cores: os.cpus().length,
            },
            process: {
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };
    }

    /**
     * Get minimal system information for lightweight checks
     */
    private getMinimalSystemInfo() {
        const memUsage = process.memoryUsage();
        const os = require('os');

        return {
            memory: {
                used: memUsage.heapUsed,
                total: os.totalmem(),
                percentage: Math.round((memUsage.heapUsed / os.totalmem()) * 100),
                details: memUsage,
            },
            cpu: {
                usage: process.cpuUsage(),
                loadAverage: os.loadavg(),
                cores: os.cpus().length,
            },
            process: {
                pid: process.pid,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
            },
        };
    }

    /**
     * Check if system is ready to serve traffic
     */
    async isReady(timeout: number = 3000): Promise<boolean> {
        try {
            const criticalServices = await this.checkCriticalServices(timeout);
            return criticalServices.every(service => service.status === 'healthy');
        } catch (error) {
            logger.error('Readiness check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Check if system is alive (basic liveness check)
     */
    isAlive(): boolean {
        // Simple check - if we can execute this function, the process is alive
        return true;
    }

    /**
     * Get service-specific health information
     */
    async getServiceHealth(serviceName: string, timeout: number = 3000): Promise<ServiceHealth> {
        const startTime = Date.now();

        try {
            switch (serviceName.toLowerCase()) {
                case 'database':
                case 'db':
                    const dbHealthy = await Promise.race([
                        db.healthCheck(),
                        this.timeoutPromise(timeout, 'Database timeout'),
                    ]);
                    return {
                        name: 'database',
                        status: dbHealthy ? 'healthy' : 'unhealthy',
                        responseTime: Date.now() - startTime,
                        metadata: {
                            pool: db.getPoolStats(),
                            type: 'postgresql',
                        },
                    };

                case 'cache':
                case 'redis':
                    const redisHealthy = await Promise.race([
                        redis.healthCheck(),
                        this.timeoutPromise(timeout, 'Redis timeout'),
                    ]);
                    return {
                        name: 'cache',
                        status: redisHealthy ? 'healthy' : 'unhealthy',
                        responseTime: Date.now() - startTime,
                        metadata: {
                            type: 'redis',
                        },
                    };

                case 'analytics':
                case 'kafka':
                    const kafkaHealthy = await Promise.race([
                        kafka.healthCheck(),
                        this.timeoutPromise(timeout, 'Kafka timeout'),
                    ]);
                    return {
                        name: 'analytics',
                        status: kafkaHealthy ? 'healthy' : 'degraded',
                        responseTime: Date.now() - startTime,
                        metadata: {
                            type: 'kafka',
                            optional: true,
                        },
                    };

                default:
                    throw new Error(`Unknown service: ${serviceName}`);
            }
        } catch (error) {
            return {
                name: serviceName,
                status: 'unhealthy',
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Create a timeout promise
     */
    private timeoutPromise(ms: number, message: string): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms);
        });
    }

    /**
     * Get health check summary for monitoring systems
     */
    async getHealthSummary(): Promise<{
        status: string;
        checks: Record<string, boolean>;
        timestamp: string;
    }> {
        const health = await this.checkHealth({
            includeOptionalServices: false,
            includeSystemInfo: false,
        });

        const checks: Record<string, boolean> = {};
        health.services.forEach(service => {
            checks[service.name] = service.status === 'healthy';
        });

        return {
            status: health.status,
            checks,
            timestamp: health.timestamp,
        };
    }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();