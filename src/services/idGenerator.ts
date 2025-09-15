/**
 * ID Generator service for creating unique short URL identifiers
 * Implements counter-based generation with Base62 encoding as primary strategy
 * Falls back to hash-based generation when counter service is unavailable
 */

import { CounterService } from './counterService';
import { HashIdGenerator } from './hashIdGenerator';
import { encodeBase62WithMinLength } from '../utils/base62';
import { logger } from '../config/logger';
import { db } from '../config/database';

export interface IDGeneratorOptions {
    minLength?: number;
    maxRetries?: number;
}

export interface GeneratedID {
    id: string;
    method: 'counter' | 'hash';
    attempts: number;
}

export class IDGenerator {
    private static instance: IDGenerator;
    private counterService: CounterService;
    private hashGenerator: HashIdGenerator;
    private readonly DEFAULT_MIN_LENGTH = 7;
    private readonly DEFAULT_MAX_RETRIES = 3;

    private constructor() {
        this.counterService = CounterService.getInstance();
        this.hashGenerator = HashIdGenerator.getInstance();
    }

    /**
     * Get singleton instance of IDGenerator
     */
    public static getInstance(): IDGenerator {
        if (!IDGenerator.instance) {
            IDGenerator.instance = new IDGenerator();
        }
        return IDGenerator.instance;
    }

    /**
     * Generate a unique ID using counter-based approach (primary method)
     * @param options - Generation options
     * @returns Promise<GeneratedID> - Generated ID with metadata
     */
    public async generateID(options: IDGeneratorOptions = {}): Promise<GeneratedID> {
        const minLength = options.minLength || this.DEFAULT_MIN_LENGTH;
        const maxRetries = options.maxRetries || this.DEFAULT_MAX_RETRIES;

        // Try counter-based generation first
        try {
            const counterId = await this.counterService.getNextId();
            const encodedId = encodeBase62WithMinLength(counterId, minLength);

            logger.debug('Generated counter-based ID', {
                counterId,
                encodedId,
                length: encodedId.length
            });

            return {
                id: encodedId,
                method: 'counter',
                attempts: 1
            };
        } catch (error) {
            logger.warn('Counter-based ID generation failed, falling back to hash-based', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Fall back to hash-based generation
            return await this.generateHashBasedID(minLength, maxRetries);
        }
    }

    /**
     * Generate ID for a specific URL using hash-based approach
     * Used for custom aliases or when counter service is unavailable
     * @param longUrl - The long URL to generate hash for
     * @param options - Generation options
     * @returns Promise<GeneratedID> - Generated ID with metadata
     */
    public async generateHashBasedID(
        longUrlOrLength: string | number,
        maxRetries: number = this.DEFAULT_MAX_RETRIES
    ): Promise<GeneratedID> {
        const isLengthOnly = typeof longUrlOrLength === 'number';
        const minLength = isLengthOnly ? longUrlOrLength : this.DEFAULT_MIN_LENGTH;

        try {
            let result;

            if (isLengthOnly) {
                // Generate random hash-based ID
                result = await this.hashGenerator.generateRandomHashId({
                    minLength,
                    maxRetries
                });
            } else {
                // Generate hash-based ID for specific URL
                result = await this.hashGenerator.generateHashId(longUrlOrLength, {
                    minLength,
                    maxRetries
                });
            }

            logger.debug('Generated hash-based ID via HashIdGenerator', {
                id: result.id,
                attempts: result.attempts,
                algorithm: result.algorithm,
                collisionDetected: result.collisionDetected
            });

            return {
                id: result.id,
                method: 'hash',
                attempts: result.attempts
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Hash-based ID generation failed', {
                error: errorMessage,
                isLengthOnly,
                minLength,
                maxRetries
            });
            throw error;
        }
    }

    /**
     * Pre-allocate a range of IDs for better performance
     * @param count - Number of IDs to pre-allocate (defaults to 10,000)
     */
    public async preAllocateRange(count: number = 10000): Promise<void> {
        try {
            await this.counterService.preAllocateRange();
            logger.info('Pre-allocated ID range', { count });
        } catch (error) {
            logger.error('Failed to pre-allocate ID range', {
                error: error instanceof Error ? error.message : 'Unknown error',
                count
            });
            throw error;
        }
    }

    /**
     * Check if counter service is available
     * @returns Promise<boolean> - true if counter service is available
     */
    public async isCounterServiceAvailable(): Promise<boolean> {
        try {
            // Try to get current range info
            const range = this.counterService.getCurrentRange();
            if (range && this.counterService.getRemainingIds() > 0) {
                return true;
            }

            // Try to allocate a new range
            await this.counterService.preAllocateRange();
            return true;
        } catch (error) {
            logger.warn('Counter service availability check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Check if hash-based fallback is available
     * @returns Promise<boolean> - true if hash fallback is available
     */
    public async isHashFallbackAvailable(): Promise<boolean> {
        return await this.hashGenerator.isAvailable();
    }

    /**
     * Get information about current ID generation capacity
     */
    public async getStatus(): Promise<{
        remainingIds: number;
        currentRange: any;
        method: 'counter' | 'hash-fallback' | 'both-available' | 'unavailable';
        counterAvailable: boolean;
        hashAvailable: boolean;
    }> {
        const remainingIds = this.counterService.getRemainingIds();
        const currentRange = this.counterService.getCurrentRange();
        const counterAvailable = await this.isCounterServiceAvailable();
        const hashAvailable = await this.isHashFallbackAvailable();

        let method: 'counter' | 'hash-fallback' | 'both-available' | 'unavailable';

        if (counterAvailable && hashAvailable) {
            method = 'both-available';
        } else if (counterAvailable) {
            method = 'counter';
        } else if (hashAvailable) {
            method = 'hash-fallback';
        } else {
            method = 'unavailable';
        }

        return {
            remainingIds,
            currentRange,
            method,
            counterAvailable,
            hashAvailable
        };
    }

    /**
     * Initialize the ID generator service
     */
    public async initialize(): Promise<void> {
        try {
            await this.counterService.initialize();
            logger.info('ID Generator service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize ID Generator service', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Check if a generated ID is unique in the database
     * @param id - ID to check for uniqueness
     * @returns Promise<boolean> - true if unique, false if collision detected
     * @private
     */
    private async checkUniqueness(id: string): Promise<boolean> {
        try {
            const result = await db.query(
                'SELECT 1 FROM url_mappings WHERE short_code = $1 LIMIT 1',
                [id]
            );

            return result.rows.length === 0;
        } catch (error) {
            logger.error('Failed to check ID uniqueness', {
                id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // In case of database error, assume collision to be safe
            return false;
        }
    }

    /**
     * Validate that an ID meets the minimum requirements
     * @param id - ID to validate
     * @param minLength - Minimum required length
     * @returns boolean - true if valid
     */
    public validateID(id: string, minLength: number = this.DEFAULT_MIN_LENGTH): boolean {
        if (!id || typeof id !== 'string') {
            return false;
        }

        if (id.length < minLength) {
            return false;
        }

        // Check if it's valid Base62
        const base62Chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        return id.split('').every(char => base62Chars.includes(char));
    }
}