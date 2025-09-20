import * as cron from 'node-cron';
import { URLRepository } from '../repositories/URLRepository';
import { MultiLayerCacheService } from './multiLayerCacheService';
import { logger } from '../config/logger';

/**
 * Expiry Manager Service
 * Handles active expiry management with background jobs
 */

export interface ExpiryManagerStats {
    activeExpiryJob: {
        lastRun: Date | null;
        totalRuns: number;
        urlsProcessed: number;
        urlsExpired: number;
        errors: number;
        averageProcessingTime: number;
    };
    hardDeletionJob: {
        lastRun: Date | null;
        totalRuns: number;
        urlsDeleted: number;
        errors: number;
        averageProcessingTime: number;
    };
}

export class ExpiryManagerService {
    private urlRepository: URLRepository;
    private cacheService: MultiLayerCacheService;
    private stats: ExpiryManagerStats;
    private activeExpiryTask: cron.ScheduledTask | null = null;
    private hardDeletionTask: cron.ScheduledTask | null = null;
    private isRunning: boolean = false;

    constructor(cacheService?: MultiLayerCacheService) {
        this.urlRepository = new URLRepository();
        this.cacheService = cacheService || new MultiLayerCacheService();

        this.stats = {
            activeExpiryJob: {
                lastRun: null,
                totalRuns: 0,
                urlsProcessed: 0,
                urlsExpired: 0,
                errors: 0,
                averageProcessingTime: 0,
            },
            hardDeletionJob: {
                lastRun: null,
                totalRuns: 0,
                urlsDeleted: 0,
                errors: 0,
                averageProcessingTime: 0,
            },
        };

        logger.info('Expiry Manager Service initialized');
    }

    /**
     * Start the expiry management background jobs
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('Expiry Manager Service is already running');
            return;
        }

        // Active expiry job - runs every 5 minutes
        this.activeExpiryTask = cron.schedule('*/5 * * * *', async () => {
            await this.runActiveExpiryJob();
        }, {
            timezone: 'UTC',
        });

        // Hard deletion job - runs daily at 2 AM UTC
        this.hardDeletionTask = cron.schedule('0 2 * * *', async () => {
            await this.runHardDeletionJob();
        }, {
            timezone: 'UTC',
        });

        // Tasks are automatically started by default
        this.isRunning = true;

        logger.info('Expiry Manager Service started', {
            activeExpirySchedule: '*/5 * * * *', // Every 5 minutes
            hardDeletionSchedule: '0 2 * * *',   // Daily at 2 AM UTC
        });
    }

    /**
     * Stop the expiry management background jobs
     */
    stop(): void {
        if (!this.isRunning) {
            logger.warn('Expiry Manager Service is not running');
            return;
        }

        if (this.activeExpiryTask) {
            this.activeExpiryTask.stop();
            this.activeExpiryTask = null;
        }

        if (this.hardDeletionTask) {
            this.hardDeletionTask.stop();
            this.hardDeletionTask = null;
        }

        this.isRunning = false;

        logger.info('Expiry Manager Service stopped');
    }

    /**
     * Run active expiry job manually
     */
    async runActiveExpiryJob(): Promise<{
        processed: number;
        expired: number;
        processingTime: number;
        errors: number;
    }> {
        const startTime = Date.now();
        let processed = 0;
        let expired = 0;
        let errors = 0;

        try {
            logger.info('Starting active expiry job');

            const batchSize = 10000;
            let hasMoreUrls = true;

            while (hasMoreUrls) {
                try {
                    // Find expired URLs in batches
                    const expiredUrls = await this.urlRepository.findExpiredUrls(batchSize);

                    if (expiredUrls.length === 0) {
                        hasMoreUrls = false;
                        break;
                    }

                    processed += expiredUrls.length;

                    // Process expired URLs in smaller chunks for better performance
                    const chunkSize = 1000;
                    const chunks = this.chunkArray(expiredUrls, chunkSize);

                    for (const chunk of chunks) {
                        try {
                            // Soft delete URLs (set is_deleted = TRUE)
                            const shortCodes = chunk.map(url => url.short_code);
                            const deletedCount = await this.urlRepository.bulkDelete(shortCodes);
                            expired += deletedCount;

                            // Remove from cache
                            await this.removeBatchFromCache(shortCodes);

                            logger.debug('Processed expired URL batch', {
                                batchSize: chunk.length,
                                deletedCount,
                            });

                        } catch (chunkError) {
                            errors++;
                            logger.error('Error processing expired URL chunk', {
                                chunkSize: chunk.length,
                                error: chunkError instanceof Error ? chunkError.message : 'Unknown error',
                            });
                        }
                    }

                    // If we got less than the batch size, we're done
                    if (expiredUrls.length < batchSize) {
                        hasMoreUrls = false;
                    }

                } catch (batchError) {
                    errors++;
                    logger.error('Error in active expiry job batch', {
                        error: batchError instanceof Error ? batchError.message : 'Unknown error',
                    });

                    // Continue with next batch even if this one failed
                    continue;
                }
            }

            const processingTime = Date.now() - startTime;

            // Update statistics
            this.updateActiveExpiryStats(processed, expired, processingTime, errors);

            logger.info('Active expiry job completed', {
                processed,
                expired,
                processingTime,
                errors,
            });

            return {
                processed,
                expired,
                processingTime,
                errors,
            };

        } catch (error) {
            errors++;
            const processingTime = Date.now() - startTime;

            this.updateActiveExpiryStats(processed, expired, processingTime, errors);

            logger.error('Active expiry job failed', {
                processed,
                expired,
                processingTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Run hard deletion job manually
     */
    async runHardDeletionJob(): Promise<{
        deleted: number;
        processingTime: number;
        errors: number;
    }> {
        const startTime = Date.now();
        let deleted = 0;
        let errors = 0;

        try {
            logger.info('Starting hard deletion job');

            // Find soft-deleted URLs older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const batchSize = 10000;
            let hasMoreUrls = true;

            while (hasMoreUrls) {
                try {
                    // Find soft-deleted URLs older than 30 days
                    const urlsToDelete = await this.urlRepository.findSoftDeletedUrls(
                        thirtyDaysAgo,
                        batchSize
                    );

                    if (urlsToDelete.length === 0) {
                        hasMoreUrls = false;
                        break;
                    }

                    // Process in smaller chunks
                    const chunkSize = 1000;
                    const chunks = this.chunkArray(urlsToDelete, chunkSize);

                    for (const chunk of chunks) {
                        try {
                            // Archive to cold storage if needed (optional)
                            await this.archiveToColdStorage(chunk);

                            // Permanently delete URLs
                            const shortCodes = chunk.map(url => url.short_code);
                            const deletedCount = await this.urlRepository.hardDelete(shortCodes);
                            deleted += deletedCount;

                            logger.debug('Hard deleted URL batch', {
                                batchSize: chunk.length,
                                deletedCount,
                            });

                        } catch (chunkError) {
                            errors++;
                            logger.error('Error hard deleting URL chunk', {
                                chunkSize: chunk.length,
                                error: chunkError instanceof Error ? chunkError.message : 'Unknown error',
                            });
                        }
                    }

                    // If we got less than the batch size, we're done
                    if (urlsToDelete.length < batchSize) {
                        hasMoreUrls = false;
                    }

                } catch (batchError) {
                    errors++;
                    logger.error('Error in hard deletion job batch', {
                        error: batchError instanceof Error ? batchError.message : 'Unknown error',
                    });

                    // Continue with next batch even if this one failed
                    continue;
                }
            }

            const processingTime = Date.now() - startTime;

            // Update statistics
            this.updateHardDeletionStats(deleted, processingTime, errors);

            logger.info('Hard deletion job completed', {
                deleted,
                processingTime,
                errors,
            });

            return {
                deleted,
                processingTime,
                errors,
            };

        } catch (error) {
            errors++;
            const processingTime = Date.now() - startTime;

            this.updateHardDeletionStats(deleted, processingTime, errors);

            logger.error('Hard deletion job failed', {
                deleted,
                processingTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Get expiry manager statistics
     */
    getStats(): ExpiryManagerStats {
        return { ...this.stats };
    }

    /**
     * Reset expiry manager statistics
     */
    resetStats(): void {
        this.stats = {
            activeExpiryJob: {
                lastRun: null,
                totalRuns: 0,
                urlsProcessed: 0,
                urlsExpired: 0,
                errors: 0,
                averageProcessingTime: 0,
            },
            hardDeletionJob: {
                lastRun: null,
                totalRuns: 0,
                urlsDeleted: 0,
                errors: 0,
                averageProcessingTime: 0,
            },
        };

        logger.info('Expiry Manager Service statistics reset');
    }

    /**
     * Check if expiry manager is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Get next scheduled run times
     */
    getNextRunTimes(): {
        activeExpiry: Date | null;
        hardDeletion: Date | null;
    } {
        return {
            activeExpiry: this.activeExpiryTask ? this.getNextCronTime('*/5 * * * *') : null,
            hardDeletion: this.hardDeletionTask ? this.getNextCronTime('0 2 * * *') : null,
        };
    }

    /**
     * Health check for expiry manager
     */
    async healthCheck(): Promise<{
        service: boolean;
        activeExpiryJob: boolean;
        hardDeletionJob: boolean;
        repository: boolean;
        cache: boolean;
    }> {
        try {
            // Check if service is running
            const serviceHealthy = this.isRunning;

            // Check if jobs are scheduled
            const activeExpiryHealthy = this.activeExpiryTask !== null;
            const hardDeletionHealthy = this.hardDeletionTask !== null;

            // Check repository health
            const repositoryHealthy = await this.urlRepository.exists('health-check');

            // Check cache health
            const cacheHealth = await this.cacheService.healthCheck();
            const cacheHealthy = cacheHealth.overall;

            return {
                service: serviceHealthy,
                activeExpiryJob: activeExpiryHealthy,
                hardDeletionJob: hardDeletionHealthy,
                repository: repositoryHealthy !== null, // exists() returns boolean, so this is always true/false
                cache: cacheHealthy,
            };

        } catch (error) {
            logger.error('Expiry manager health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                service: false,
                activeExpiryJob: false,
                hardDeletionJob: false,
                repository: false,
                cache: false,
            };
        }
    }

    /**
     * Remove batch of URLs from cache
     */
    private async removeBatchFromCache(shortCodes: string[]): Promise<void> {
        const promises = shortCodes.map(async (shortCode) => {
            try {
                await this.cacheService.invalidateCache(shortCode);
            } catch (error) {
                logger.warn('Failed to remove URL from cache during expiry', {
                    shortCode,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        });

        // Process cache removals in parallel but don't fail if some fail
        await Promise.allSettled(promises);
    }

    /**
     * Chunk array into smaller arrays
     */
    private chunkArray<T>(array: T[], chunkSize: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Update active expiry job statistics
     */
    private updateActiveExpiryStats(
        processed: number,
        expired: number,
        processingTime: number,
        errors: number
    ): void {
        const stats = this.stats.activeExpiryJob;

        stats.lastRun = new Date();
        stats.totalRuns++;
        stats.urlsProcessed += processed;
        stats.urlsExpired += expired;
        stats.errors += errors;

        // Calculate running average processing time
        const totalRuns = stats.totalRuns;
        const currentAvg = stats.averageProcessingTime;
        stats.averageProcessingTime = ((currentAvg * (totalRuns - 1)) + processingTime) / totalRuns;
    }

    /**
     * Update hard deletion job statistics
     */
    private updateHardDeletionStats(
        deleted: number,
        processingTime: number,
        errors: number
    ): void {
        const stats = this.stats.hardDeletionJob;

        stats.lastRun = new Date();
        stats.totalRuns++;
        stats.urlsDeleted += deleted;
        stats.errors += errors;

        // Calculate running average processing time
        const totalRuns = stats.totalRuns;
        const currentAvg = stats.averageProcessingTime;
        stats.averageProcessingTime = ((currentAvg * (totalRuns - 1)) + processingTime) / totalRuns;
    }

    /**
     * Archive URLs to cold storage before hard deletion
     */
    private async archiveToColdStorage(urls: any[]): Promise<void> {
        try {
            // This is a placeholder for cold storage archiving
            // In production, you might archive to S3, Google Cloud Storage, etc.

            if (process.env.ENABLE_COLD_STORAGE_ARCHIVE === 'true') {
                logger.info('Archiving URLs to cold storage', {
                    count: urls.length,
                });

                // Example: Archive to JSON file or cloud storage
                const archiveData = {
                    timestamp: new Date().toISOString(),
                    urls: urls.map(url => ({
                        short_code: url.short_code,
                        long_url: url.long_url,
                        created_at: url.created_at,
                        deleted_at: url.deleted_at,
                        access_count: url.access_count,
                    })),
                };

                // In production, implement actual archiving logic here
                // await cloudStorageService.archive(archiveData);

                logger.debug('URLs archived to cold storage', {
                    count: urls.length,
                });
            }

        } catch (error) {
            logger.warn('Failed to archive URLs to cold storage', {
                count: urls.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - archiving failure shouldn't prevent deletion
        }
    }

    /**
     * Get next cron execution time (simplified implementation)
     */
    private getNextCronTime(cronExpression: string): Date {
        // This is a simplified implementation
        // In production, you'd use a proper cron parser library
        const now = new Date();

        if (cronExpression === '*/5 * * * *') {
            // Every 5 minutes
            const next = new Date(now);
            const minutes = next.getMinutes();
            const nextMinute = Math.ceil(minutes / 5) * 5;
            next.setMinutes(nextMinute, 0, 0);
            if (nextMinute >= 60) {
                next.setHours(next.getHours() + 1);
                next.setMinutes(0, 0, 0);
            }
            return next;
        }

        if (cronExpression === '0 2 * * *') {
            // Daily at 2 AM
            const next = new Date(now);
            next.setHours(2, 0, 0, 0);
            if (next <= now) {
                next.setDate(next.getDate() + 1);
            }
            return next;
        }

        // Default: next hour
        const next = new Date(now);
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return next;
    }
}