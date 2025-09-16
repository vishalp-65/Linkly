import { URLRepository } from '../repositories/URLRepository';
import { logger } from '../config/logger';

/**
 * Custom Alias Availability Checker
 * Handles checking if custom aliases are available and suggests alternatives
 */

export interface AliasAvailabilityResult {
    isAvailable: boolean;
    suggestions?: string[];
    error?: string;
}

export class AliasChecker {
    private urlRepository: URLRepository;

    constructor(urlRepository: URLRepository) {
        this.urlRepository = urlRepository;
    }

    /**
     * Check if a custom alias is available
     */
    async checkAvailability(alias: string): Promise<AliasAvailabilityResult> {
        try {
            const exists = await this.urlRepository.exists(alias);

            if (!exists) {
                logger.debug('Custom alias is available', { alias });
                return {
                    isAvailable: true,
                };
            }

            // Generate suggestions if alias is taken
            const suggestions = await this.generateSuggestions(alias);

            logger.debug('Custom alias is taken, generated suggestions', {
                alias,
                suggestionsCount: suggestions.length,
            });

            return {
                isAvailable: false,
                suggestions,
            };
        } catch (error) {
            logger.error('Failed to check alias availability', {
                alias,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                isAvailable: false,
                error: 'Failed to check alias availability',
            };
        }
    }

    /**
     * Generate alternative suggestions for taken aliases
     */
    private async generateSuggestions(baseAlias: string, maxSuggestions: number = 5): Promise<string[]> {
        const suggestions: string[] = [];
        const strategies = [
            // Add numbers
            (alias: string) => [`${alias}1`, `${alias}2`, `${alias}3`, `${alias}123`],
            // Add year
            (alias: string) => [`${alias}2024`, `${alias}24`],
            // Add prefixes
            (alias: string) => [`my${alias}`, `get${alias}`, `go${alias}`],
            // Add suffixes
            (alias: string) => [`${alias}url`, `${alias}link`, `${alias}now`],
            // Variations with underscores and hyphens
            (alias: string) => [`${alias}_1`, `${alias}-1`, `${alias}_url`, `${alias}-link`],
        ];

        for (const strategy of strategies) {
            if (suggestions.length >= maxSuggestions) break;

            const candidates = strategy(baseAlias);

            for (const candidate of candidates) {
                if (suggestions.length >= maxSuggestions) break;

                // Check if candidate is valid length and format
                if (candidate.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(candidate)) {
                    try {
                        const exists = await this.urlRepository.exists(candidate);
                        if (!exists) {
                            suggestions.push(candidate);
                        }
                    } catch (error) {
                        // Skip this suggestion if check fails
                        logger.debug('Failed to check suggestion availability', {
                            candidate,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
            }
        }

        return suggestions;
    }

    /**
     * Batch check multiple aliases
     */
    async batchCheckAvailability(aliases: string[]): Promise<Map<string, boolean>> {
        const results = new Map<string, boolean>();

        try {
            // Use Promise.allSettled to handle individual failures gracefully
            const checks = aliases.map(async (alias) => {
                try {
                    const exists = await this.urlRepository.exists(alias);
                    return { alias, available: !exists };
                } catch (error) {
                    logger.warn('Failed to check alias in batch', {
                        alias,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                    return { alias, available: false }; // Assume unavailable on error
                }
            });

            const settled = await Promise.allSettled(checks);

            settled.forEach((result) => {
                if (result.status === 'fulfilled') {
                    results.set(result.value.alias, result.value.available);
                }
            });

            logger.debug('Batch alias availability check completed', {
                totalChecked: aliases.length,
                resultsCount: results.size,
            });

        } catch (error) {
            logger.error('Batch alias availability check failed', {
                aliasCount: aliases.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        return results;
    }

    /**
     * Find the next available alias with a numeric suffix
     */
    async findNextAvailable(baseAlias: string, maxAttempts: number = 100): Promise<string | null> {
        try {
            // First check if base alias is available
            const baseExists = await this.urlRepository.exists(baseAlias);
            if (!baseExists) {
                return baseAlias;
            }

            // Try with numeric suffixes
            for (let i = 1; i <= maxAttempts; i++) {
                const candidate = `${baseAlias}${i}`;
                const exists = await this.urlRepository.exists(candidate);

                if (!exists) {
                    logger.debug('Found next available alias', {
                        baseAlias,
                        availableAlias: candidate,
                        attempts: i,
                    });
                    return candidate;
                }
            }

            logger.warn('Could not find available alias after max attempts', {
                baseAlias,
                maxAttempts,
            });

            return null;
        } catch (error) {
            logger.error('Failed to find next available alias', {
                baseAlias,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return null;
        }
    }
}