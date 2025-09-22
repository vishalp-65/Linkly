#!/usr/bin/env ts-node

import { batchAnalyticsProcessor } from '../services/batchAnalyticsProcessor';
import { logger } from '../config/logger';

async function runBatchAnalytics(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'start':
                logger.info('Starting batch analytics processor service...');
                batchAnalyticsProcessor.start();

                // Keep the process running
                process.on('SIGINT', () => {
                    logger.info('Received SIGINT, stopping batch analytics processor...');
                    batchAnalyticsProcessor.stop();
                    process.exit(0);
                });

                process.on('SIGTERM', () => {
                    logger.info('Received SIGTERM, stopping batch analytics processor...');
                    batchAnalyticsProcessor.stop();
                    process.exit(0);
                });

                logger.info('Batch analytics processor service started - scheduled to run daily at 2 AM');
                break;

            case 'run':
                const dateArg = args[1];
                let targetDate: Date;

                if (dateArg) {
                    targetDate = new Date(dateArg);
                    if (isNaN(targetDate.getTime())) {
                        throw new Error(`Invalid date format: ${dateArg}. Use YYYY-MM-DD format.`);
                    }
                } else {
                    // Default to yesterday
                    targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                }

                logger.info('Running manual batch analytics processing', {
                    date: targetDate.toISOString().split('T')[0]
                });

                await batchAnalyticsProcessor.runManualProcessing(targetDate);

                logger.info('Manual batch analytics processing completed');
                process.exit(0);
                break;

            case 'status':
                const isRunning = batchAnalyticsProcessor.isProcessorRunning();
                logger.info('Batch analytics processor status', { isRunning });
                process.exit(0);
                break;

            default:
                console.log(`
Usage: npm run analytics:batch <command> [options]

Commands:
  start                    Start the batch analytics processor service (runs as daemon)
  run [YYYY-MM-DD]        Run batch processing for a specific date (default: yesterday)
  status                  Check if the processor is running

Examples:
  npm run analytics:batch start
  npm run analytics:batch run 2024-11-02
  npm run analytics:batch run
  npm run analytics:batch status
                `);
                process.exit(1);
        }

    } catch (error) {
        logger.error('Batch analytics processor error', {
            command,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}

// Run if this script is executed directly
if (require.main === module) {
    runBatchAnalytics();
}

export { runBatchAnalytics };