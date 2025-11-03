/**
 * Hash-based ID generator as fallback mechanism
 * Implements MD5/SHA256 hashing with Base62 encoding and collision detection
 * Used when counter service is unavailable or for custom aliases
 */

import crypto from 'crypto';
import { encodeBase62WithMinLength, isValidBase62 } from '../utils/base62';
import { logger } from '../config/logger';
import { db } from '../config/database';

export interface HashGeneratorOptions {
    algorithm?: 'md5' | 'sha256';
    minLength?: number;
    maxRetries?: number;
    customSalt?: string;
}

export interface HashGenerationResult {
    id: string;
    algorithm: string;
    attempts: number;
    collisionDetected: boolean;
    originalInput: string;
}

export class HashIdGenerator {
    private static instance: HashIdGenerator;
    private readonly DEFAULT_ALGORITHM = 'md5';
    private readonly DEFAULT_MIN_LENGTH = 7;
    private readonly DEFAULT_MAX_RETRIES = 3;
    private readonly HASH_SUBSTRING_LENGTH = 10; // Use first 10 hex chars for better distribution

    private constructor() { }

    /**
     * Get singleton instance of HashIdGenerator
     */
    public static getInstance(): HashIdGenerator {
        if (!HashIdGenerator.instance) {
            HashIdGenerator.instance = new HashIdGenerator();
        }
        return HashIdGenerator.instance;
    }

    /**
     * Generate hash-based ID for a given input (typically a long URL)
     * @param input - Input string to hash (usually the long URL)
     * @param options - Generation options
     * @returns Promise<HashGenerationResult> - Generated ID with metadata
     */
    public async generateHashId(
        input: string,
        options: HashGeneratorOptions = {}
    ): Promise<HashGenerationResult> {
        const algorithm = options.algorithm || this.DEFAULT_ALGORITHM;
        const minLength = options.minLength || this.DEFAULT_MIN_LENGTH;
        const maxRetries = options.maxRetries || this.DEFAULT_MAX_RETRIES;
        const customSalt = options.customSalt || '';

        if (!input || typeof input !== 'string') {
            throw new Error('Input must be a non-empty string');
        }

        let attempts = 0;
        let collisionDetected = false;
        let lastGeneratedId = '';

        while (attempts < maxRetries) {
            attempts++;

            try {
                // Create unique input for each attempt to avoid same hash
                const hashInput = this.createHashInput(input, attempts, customSalt);

                // Generate hash using specified algorithm
                const hash = this.createHash(hashInput, algorithm);

                // Convert hash to Base62 ID
                const generatedId = this.hashToBase62(hash, minLength);
                lastGeneratedId = generatedId;

                // Validate the generated ID
                if (!this.validateGeneratedId(generatedId, minLength)) {
                    throw new Error(`Generated ID '${generatedId}' failed validation`);
                }

                // Check for collision in database
                const isUnique = await this.checkUniqueness(generatedId);

                if (isUnique) {
                    logger.debug('Successfully generated hash-based ID', {
                        id: generatedId,
                        algorithm,
                        attempts,
                        inputLength: input.length,
                        collisionDetected
                    });

                    return {
                        id: generatedId,
                        algorithm,
                        attempts,
                        collisionDetected,
                        originalInput: input.substring(0, 100) // Truncate for logging
                    };
                }

                // Collision detected
                collisionDetected = true;
                logger.debug('Hash collision detected', {
                    id: generatedId,
                    attempt: attempts,
                    algorithm
                });

            } catch (error) {
                logger.warn('Hash generation attempt failed', {
                    attempt: attempts,
                    algorithm,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // All attempts failed
        const errorMessage = `Failed to generate unique hash-based ID after ${maxRetries} attempts`;
        logger.error(errorMessage, {
            algorithm,
            maxRetries,
            lastGeneratedId,
            collisionDetected,
            inputLength: input.length
        });

        throw new Error(errorMessage);
    }

    /**
     * Generate random hash-based ID when no specific input is provided
     * @param options - Generation options
     * @returns Promise<HashGenerationResult> - Generated ID with metadata
     */
    public async generateRandomHashId(
        options: HashGeneratorOptions = {}
    ): Promise<HashGenerationResult> {
        // Create random input using timestamp and random values
        const randomInput = this.createRandomInput();

        return await this.generateHashId(randomInput, options);
    }

    /**
     * Batch generate multiple hash-based IDs
     * @param inputs - Array of input strings
     * @param options - Generation options
     * @returns Promise<HashGenerationResult[]> - Array of generated IDs
     */
    public async batchGenerateHashIds(
        inputs: string[],
        options: HashGeneratorOptions = {}
    ): Promise<HashGenerationResult[]> {
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new Error('Inputs must be a non-empty array');
        }

        const results: HashGenerationResult[] = [];
        const errors: { input: string; error: string }[] = [];

        for (const input of inputs) {
            try {
                const result = await this.generateHashId(input, options);
                results.push(result);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ input: input.substring(0, 50), error: errorMessage });
                logger.error('Batch hash generation failed for input', {
                    input: input.substring(0, 50),
                    error: errorMessage
                });
            }
        }

        if (errors.length > 0) {
            logger.warn('Some batch hash generations failed', {
                totalInputs: inputs.length,
                successCount: results.length,
                errorCount: errors.length,
                errors: errors.slice(0, 5) // Log first 5 errors
            });
        }

        return results;
    }

    /**
     * Check if hash-based generation is available
     * @returns Promise<boolean> - true if service is available
     */
    public async isAvailable(): Promise<boolean> {
        try {
            // Test with a simple hash generation
            const testInput = 'availability_test_' + Date.now();
            await this.generateHashId(testInput, { maxRetries: 1 });
            return true;
        } catch (error) {
            logger.warn('Hash-based ID generator availability check failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }

    /**
     * Create hash input with attempt number and salt for uniqueness
     * @param input - Original input string
     * @param attempt - Current attempt number
     * @param salt - Optional salt string
     * @returns string - Modified input for hashing
     * @private
     */
    private createHashInput(input: string, attempt: number, salt: string = ''): string {
        const timestamp = Date.now();
        const attemptSuffix = attempt > 1 ? `_attempt_${attempt}` : '';
        const saltSuffix = salt ? `_salt_${salt}` : '';

        return `${input}${attemptSuffix}${saltSuffix}_${timestamp}`;
    }

    /**
     * Create hash using specified algorithm
     * @param input - Input string to hash
     * @param algorithm - Hash algorithm to use
     * @returns string - Hex hash string
     * @private
     */
    private createHash(input: string, algorithm: 'md5' | 'sha256'): string {
        try {
            return crypto.createHash(algorithm).update(input).digest('hex');
        } catch (error) {
            logger.error('Hash creation failed', {
                algorithm,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw new Error(`Failed to create ${algorithm} hash`);
        }
    }

    /**
     * Convert hex hash to Base62 ID
     * @param hash - Hex hash string
     * @param minLength - Minimum length for the ID
     * @returns string - Base62 encoded ID
     * @private
     */
    private hashToBase62(hash: string, minLength: number): string {
        // Take a substring of the hash for better distribution
        const hashSubstring = hash.substring(0, this.HASH_SUBSTRING_LENGTH);

        // Convert hex to number
        const hashNumber = parseInt(hashSubstring, 16);

        if (isNaN(hashNumber)) {
            throw new Error('Failed to convert hash to number');
        }

        // Encode to Base62 with minimum length
        return encodeBase62WithMinLength(hashNumber, minLength);
    }

    /**
     * Create random input for random ID generation
     * @returns string - Random input string
     * @private
     */
    private createRandomInput(): string {
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const processId = process.pid;

        return `random_${timestamp}_${randomBytes}_${processId}`;
    }

    /**
     * Validate that the generated ID meets requirements
     * @param id - Generated ID to validate
     * @param minLength - Minimum required length
     * @returns boolean - true if valid
     * @private
     */
    private validateGeneratedId(id: string, minLength: number): boolean {
        if (!id || typeof id !== 'string') {
            return false;
        }

        if (id.length < minLength) {
            return false;
        }

        return isValidBase62(id);
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
            logger.error('Failed to check ID uniqueness in hash generator', {
                id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // In case of database error, assume collision to be safe
            return false;
        }
    }

    /**
     * Get statistics about hash generation performance
     * @returns object - Performance statistics
     */
    public getStatistics(): {
        algorithmsSupported: string[];
        defaultAlgorithm: string;
        defaultMinLength: number;
        maxRetries: number;
    } {
        return {
            algorithmsSupported: ['md5', 'sha256'],
            defaultAlgorithm: this.DEFAULT_ALGORITHM,
            defaultMinLength: this.DEFAULT_MIN_LENGTH,
            maxRetries: this.DEFAULT_MAX_RETRIES
        };
    }
}