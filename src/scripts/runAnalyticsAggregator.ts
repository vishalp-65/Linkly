#!/usr/bin/env ts-node

import { analyticsAggregator } from '../services/analyticsAggregator';
import { logger } from '../config/logger';

async function runAnalyticsAggregator(): Promise<void> {
    try {
        logger.info('Starting analytics aggregator service...');

        // Start the aggregator
        await analyticsAggregator.start();

        // Log stats periodically
        const statsInterval = setInterval(() => {
            const stats = analyticsAggregator.getStats();
            logger.info('Analytics aggregator stats', stats);
        }, 60000); // Every minute

        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down analytics aggregator...');
            clearInterval(statsInterval);
            await analyticsAggregator.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down analytics aggregator...');
            clearInterval(statsInterval);
            await analyticsAggregator.stop();
            process.exit(0);
        });

        logger.info('Analytics aggregator service started successfully');

    } catch (error) {
        logger.error('Failed to start analytics aggregator service', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    }
}

// Run the aggregator if this script is executed directly
if (require.main === module) {
    runAnalyticsAggregator();
}

export { runAnalyticsAggregator };