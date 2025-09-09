import { Pool, PoolClient } from 'pg';
import { logger } from '../config/logger';
import { config } from '../config/environment';

export interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

export class ConnectionManager {
    private pool: Pool;
    private retryOptions: RetryOptions;

    constructor(pool: Pool, retryOptions?: Partial<RetryOptions>) {
        this.pool = pool;
        this.retryOptions = {
            maxRetries: 3,
            baseDelay: 100,
            maxDelay: 5000,
            backoffMultiplier: 2,
            ...retryOptions,
        };
    }

    /**
     * Execute a query with retry logic
     */
    async executeWithRetry<T>(
        operation: (client?: PoolClient) => Promise<T>,
        useTransaction: boolean = false
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= this.retryOptions.maxRetries; attempt++) {
            try {
                if (useTransaction) {
                    return await this.executeInTransaction(operation);
                } else {
                    return await operation();
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Check if error is retryable
                if (!this.isRetryableError(lastError) || attempt === this.retryOptions.maxRetries) {
                    throw lastError;
                }

                const delay = this.calculateDelay(attempt);

                logger.warn('Database operation failed, retrying', {
                    attempt,
                    maxRetries: this.retryOptions.maxRetries,
                    delay,
                    error: lastError.message,
                });

                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    /**
     * Execute operation in a transaction with retry logic
     */
    private async executeInTransaction<T>(
        operation: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            const result = await operation(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Check if an error is retryable
     */
    private isRetryableError(error: Error): boolean {
        const retryableCodes = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ENETUNREACH',
            '53300', // too_many_connections
            '53400', // configuration_limit_exceeded
            '08000', // connection_exception
            '08003', // connection_does_not_exist
            '08006', // connection_failure
            '08001', // sqlclient_unable_to_establish_sqlconnection
            '08004', // sqlserver_rejected_establishment_of_sqlconnection
            '57P01', // admin_shutdown
            '57P02', // crash_shutdown
            '57P03', // cannot_connect_now
        ];

        // Check for PostgreSQL error codes
        if ('code' in error && typeof error.code === 'string') {
            return retryableCodes.includes(error.code);
        }

        // Check for Node.js error codes
        if ('code' in error && typeof error.code === 'string') {
            return retryableCodes.some(code => error.code === code);
        }

        // Check for connection-related errors in message
        const connectionErrors = [
            'connection terminated',
            'connection closed',
            'connection timeout',
            'server closed the connection',
            'connection refused',
            'network error',
        ];

        const errorMessage = error.message.toLowerCase();
        return connectionErrors.some(msg => errorMessage.includes(msg));
    }

    /**
     * Calculate delay for retry with exponential backoff
     */
    private calculateDelay(attempt: number): number {
        const delay = this.retryOptions.baseDelay *
            Math.pow(this.retryOptions.backoffMultiplier, attempt - 1);

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * delay;

        return Math.min(delay + jitter, this.retryOptions.maxDelay);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get connection pool statistics
     */
    getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }

    /**
     * Health check with retry
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.executeWithRetry(async () => {
                const result = await this.pool.query('SELECT 1 as health');
                return result.rows[0].health === 1;
            });
            return true;
        } catch (error) {
            logger.error('Connection manager health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        try {
            await this.pool.end();
            logger.info('Connection pool closed');
        } catch (error) {
            logger.error('Error closing connection pool', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }
}

// Create and export connection manager instance
export const connectionManager = new ConnectionManager(
    // This will be initialized when the database config is loaded
    {} as Pool,
    {
        maxRetries: config.database.pool.connectionTimeout ? 3 : 1,
        baseDelay: 100,
        maxDelay: 2000,
        backoffMultiplier: 2,
    }
);