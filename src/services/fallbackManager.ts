/**
 * Fallback Manager for ID generation service
 * Manages the fallback mechanism when counter service is unavailable
 * Implements circuit breaker pattern and health monitoring
 */

import { IDGenerator } from './idGenerator';
import { HashIdGenerator } from './hashIdGenerator';
import { logger } from '../config/logger';

export interface FallbackStatus {
    isCounterServiceHealthy: boolean;
    isHashServiceHealthy: boolean;
    currentMode: 'counter' | 'hash' | 'unavailable';
    lastHealthCheck: Date;
    consecutiveFailures: number;
    circuitBreakerOpen: boolean;
}

export interface FallbackConfig {
    healthCheckInterval: number; // milliseconds
    maxConsecutiveFailures: number;
    circuitBreakerTimeout: number; // milliseconds
    fallbackRetryDelay: number; // milliseconds
}

export class FallbackManager {
    private static instance: FallbackManager;
    private idGenerator: IDGenerator;
    private hashGenerator: HashIdGenerator;
    private status: FallbackStatus;
    private config: FallbackConfig;
    private healthCheckTimer: NodeJS.Timeout | null = null;

    private constructor() {
        this.idGenerator = IDGenerator.getInstance();
        this.hashGenerator = HashIdGenerator.getInstance();

        this.config = {
            healthCheckInterval: 30000, // 30 seconds
            maxConsecutiveFailures: 3,
            circuitBreakerTimeout: 60000, // 1 minute
            fallbackRetryDelay: 5000 // 5 seconds
        };

        this.status = {
            isCounterServiceHealthy: true,
            isHashServiceHealthy: true,
            currentMode: 'counter',
            lastHealthCheck: new Date(),
            consecutiveFailures: 0,
            circuitBreakerOpen: false
        };
    }

    /**
     * Get singleton instance of FallbackManager
     */
    public static getInstance(): FallbackManager {
        if (!FallbackManager.instance) {
            FallbackManager.instance = new FallbackManager();
        }
        return FallbackManager.instance;
    }

    /**
     * Initialize the fallback manager and start health monitoring
     */
    public async initialize(): Promise<void> {
        try {
            await this.performHealthCheck();
            this.startHealthMonitoring();

            logger.info('Fallback manager initialized successfully', {
                initialMode: this.status.currentMode,
                counterHealthy: this.status.isCounterServiceHealthy,
                hashHealthy: this.status.isHashServiceHealthy
            });
        } catch (error) {
            logger.error('Failed to initialize fallback manager', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Generate ID with automatic fallback handling
     * @param options - ID generation options
     * @returns Promise<any> - Generated ID result
     */
    public async generateIdWithFallback(options: any = {}): Promise<any> {
        // Check circuit breaker
        if (this.status.circuitBreakerOpen) {
            const timeSinceLastCheck = Date.now() - this.status.lastHealthCheck.getTime();
            if (timeSinceLastCheck < this.config.circuitBreakerTimeout) {
                // Circuit breaker is still open, use hash fallback
                return await this.generateHashId(options);
            } else {
                // Try to close circuit breaker
                await this.performHealthCheck();
            }
        }

        try {
            // Try counter-based generation first
            if (this.status.isCounterServiceHealthy && this.status.currentMode === 'counter') {
                const result = await this.idGenerator.generateID(options);

                // Reset failure count on success
                this.status.consecutiveFailures = 0;

                return result;
            }
        } catch (error) {
            logger.warn('Counter-based ID generation failed, falling back to hash', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Increment failure count
            this.status.consecutiveFailures++;

            // Open circuit breaker if too many failures
            if (this.status.consecutiveFailures >= this.config.maxConsecutiveFailures) {
                this.openCircuitBreaker();
            }
        }

        // Fall back to hash-based generation
        return await this.generateHashId(options);
    }

    /**
     * Generate hash-based ID with error handling
     * @param options - Generation options
     * @returns Promise<any> - Generated ID result
     * @private
     */
    private async generateHashId(options: any = {}): Promise<any> {
        try {
            if (!this.status.isHashServiceHealthy) {
                throw new Error('Hash service is not healthy');
            }

            const result = await this.idGenerator.generateHashBasedID(
                options.minLength || 7,
                options.maxRetries || 3
            );

            logger.debug('Successfully generated hash-based ID as fallback', {
                id: result.id,
                attempts: result.attempts
            });

            return result;
        } catch (error) {
            logger.error('Hash-based fallback also failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Mark hash service as unhealthy
            this.status.isHashServiceHealthy = false;
            this.status.currentMode = 'unavailable';

            throw new Error('All ID generation methods are unavailable');
        }
    }

    /**
     * Perform health check on both services
     */
    public async performHealthCheck(): Promise<void> {
        try {
            // Check counter service health
            const counterHealthy = await this.idGenerator.isCounterServiceAvailable();

            // Check hash service health
            const hashHealthy = await this.idGenerator.isHashFallbackAvailable();

            // Update status
            this.status.isCounterServiceHealthy = counterHealthy;
            this.status.isHashServiceHealthy = hashHealthy;
            this.status.lastHealthCheck = new Date();

            // Determine current mode
            if (counterHealthy) {
                this.status.currentMode = 'counter';
                this.status.circuitBreakerOpen = false;
                this.status.consecutiveFailures = 0;
            } else if (hashHealthy) {
                this.status.currentMode = 'hash';
            } else {
                this.status.currentMode = 'unavailable';
            }

            logger.debug('Health check completed', {
                counterHealthy,
                hashHealthy,
                currentMode: this.status.currentMode,
                circuitBreakerOpen: this.status.circuitBreakerOpen
            });

        } catch (error) {
            logger.error('Health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Mark services as unhealthy on health check failure
            this.status.isCounterServiceHealthy = false;
            this.status.isHashServiceHealthy = false;
            this.status.currentMode = 'unavailable';
        }
    }

    /**
     * Start periodic health monitoring
     * @private
     */
    private startHealthMonitoring(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        this.healthCheckTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);

        logger.info('Health monitoring started', {
            interval: this.config.healthCheckInterval
        });
    }

    /**
     * Stop health monitoring
     */
    public stopHealthMonitoring(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;

            logger.info('Health monitoring stopped');
        }
    }

    /**
     * Open circuit breaker to prevent further counter service calls
     * @private
     */
    private openCircuitBreaker(): void {
        this.status.circuitBreakerOpen = true;
        this.status.currentMode = 'hash';

        logger.warn('Circuit breaker opened due to consecutive failures', {
            consecutiveFailures: this.status.consecutiveFailures,
            timeout: this.config.circuitBreakerTimeout
        });
    }

    /**
     * Get current fallback status
     */
    public getStatus(): FallbackStatus {
        return { ...this.status };
    }

    /**
     * Update fallback configuration
     * @param newConfig - New configuration options
     */
    public updateConfig(newConfig: Partial<FallbackConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // Restart health monitoring with new interval if changed
        if (newConfig.healthCheckInterval) {
            this.startHealthMonitoring();
        }

        logger.info('Fallback configuration updated', {
            newConfig: this.config
        });
    }

    /**
     * Force fallback to hash-based generation
     * @param duration - Duration in milliseconds to force fallback (optional)
     */
    public forceFallback(duration?: number): void {
        this.status.circuitBreakerOpen = true;
        this.status.currentMode = 'hash';

        logger.info('Forced fallback to hash-based generation', { duration });

        if (duration) {
            setTimeout(() => {
                this.status.circuitBreakerOpen = false;
                this.performHealthCheck();
                logger.info('Forced fallback period ended, resuming normal operation');
            }, duration);
        }
    }

    /**
     * Reset fallback manager to initial state
     */
    public async reset(): Promise<void> {
        this.stopHealthMonitoring();

        this.status = {
            isCounterServiceHealthy: true,
            isHashServiceHealthy: true,
            currentMode: 'counter',
            lastHealthCheck: new Date(),
            consecutiveFailures: 0,
            circuitBreakerOpen: false
        };

        await this.performHealthCheck();
        this.startHealthMonitoring();

        logger.info('Fallback manager reset to initial state');
    }

    /**
     * Cleanup resources
     */
    public cleanup(): void {
        this.stopHealthMonitoring();
        logger.info('Fallback manager cleanup completed');
    }
}