/**
 * Counter service for managing distributed ID generation
 * Handles pre-allocation of ID ranges to avoid database bottlenecks
 */

import { db } from '../config/database';
import { logger } from '../config/logger';

export interface CounterRange {
    start: number;
    end: number;
    current: number;
}

export class CounterService {
    private static instance: CounterService;
    private currentRange: CounterRange | null = null;
    private readonly RANGE_SIZE = 10000; // Pre-allocate 10,000 IDs per server
    private readonly LOCK_TIMEOUT = 5000; // 5 seconds timeout for database lock

    private constructor() { }

    /**
     * Get singleton instance of CounterService
     */
    public static getInstance(): CounterService {
        if (!CounterService.instance) {
            CounterService.instance = new CounterService();
        }
        return CounterService.instance;
    }

    /**
     * Get the next available ID from the current range
     * If range is exhausted, allocates a new range
     * @returns Promise<number> - Next available ID
     */
    public async getNextId(): Promise<number> {
        // Check if we need to allocate a new range
        if (!this.currentRange || this.currentRange.current >= this.currentRange.end) {
            await this.allocateNewRange();
        }

        if (!this.currentRange) {
            throw new Error('Failed to allocate ID range');
        }

        const nextId = this.currentRange.current;
        this.currentRange.current++;

        logger.debug('Generated new ID', {
            id: nextId,
            rangeStart: this.currentRange.start,
            rangeEnd: this.currentRange.end,
            remaining: this.currentRange.end - this.currentRange.current
        });

        return nextId;
    }

    /**
     * Pre-allocate a range of IDs from the central counter
     * Uses row-level locking to prevent race conditions
     * @returns Promise<void>
     */
    public async preAllocateRange(): Promise<void> {
        await this.allocateNewRange();
    }

    /**
     * Get information about the current allocated range
     * @returns CounterRange | null
     */
    public getCurrentRange(): CounterRange | null {
        return this.currentRange ? { ...this.currentRange } : null;
    }

    /**
     * Get the number of remaining IDs in current range
     * @returns number
     */
    public getRemainingIds(): number {
        if (!this.currentRange) {
            return 0;
        }
        return this.currentRange.end - this.currentRange.current;
    }

    /**
     * Allocate a new range of IDs from the database
     * Uses database transaction with row-level locking for consistency
     * @private
     */
    private async allocateNewRange(): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Lock the counter row to prevent concurrent access
            const lockQuery = `
        SELECT current_value 
        FROM id_counter 
        WHERE counter_id = 1 
        FOR UPDATE
      `;

            const lockResult = await client.query(lockQuery);

            if (lockResult.rows.length === 0) {
                // Initialize counter if it doesn't exist
                await client.query(`
          INSERT INTO id_counter (counter_id, current_value, last_updated)
          VALUES (1, 1000000, NOW())
          ON CONFLICT (counter_id) DO NOTHING
        `);

                // Try to lock again
                const retryResult = await client.query(lockQuery);
                if (retryResult.rows.length === 0) {
                    throw new Error('Failed to initialize or lock counter');
                }
            }

            const currentValue = parseInt(lockResult.rows[0].current_value);
            const rangeStart = currentValue;
            const rangeEnd = currentValue + this.RANGE_SIZE;

            // Update the counter with the new value
            const updateQuery = `
        UPDATE id_counter 
        SET current_value = $1, last_updated = NOW()
        WHERE counter_id = 1
      `;

            await client.query(updateQuery, [rangeEnd]);
            await client.query('COMMIT');

            // Set the new range
            this.currentRange = {
                start: rangeStart,
                end: rangeEnd,
                current: rangeStart
            };

            logger.info('Allocated new ID range', {
                rangeStart,
                rangeEnd,
                rangeSize: this.RANGE_SIZE
            });

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to allocate ID range', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            });
            throw new Error('Failed to allocate ID range from database');
        } finally {
            client.release();
        }
    }

    /**
     * Initialize the counter service
     * Creates the counter table if it doesn't exist
     */
    public async initialize(): Promise<void> {
        try {
            // Create the counter table if it doesn't exist
            const createTableQuery = `
        CREATE TABLE IF NOT EXISTS id_counter (
          counter_id INT PRIMARY KEY DEFAULT 1,
          current_value BIGINT NOT NULL DEFAULT 1000000,
          last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
          CONSTRAINT single_row CHECK (counter_id = 1)
        )
      `;

            await db.query(createTableQuery);

            // Insert initial row if table is empty
            const initQuery = `
        INSERT INTO id_counter (counter_id, current_value, last_updated)
        VALUES (1, 1000000, NOW())
        ON CONFLICT (counter_id) DO NOTHING
      `;

            await db.query(initQuery);

            logger.info('Counter service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize counter service', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Reset the counter service (for testing purposes)
     * @param startValue - Starting value for the counter
     */
    public async reset(startValue: number = 1000000): Promise<void> {
        try {
            await db.query(
                'UPDATE id_counter SET current_value = $1, last_updated = NOW() WHERE counter_id = 1',
                [startValue]
            );

            this.currentRange = null;

            logger.info('Counter service reset', { startValue });
        } catch (error) {
            logger.error('Failed to reset counter service', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}