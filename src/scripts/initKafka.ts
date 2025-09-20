#!/usr/bin/env ts-node

import { kafka } from '../config/kafka';
import { logger } from '../config/logger';

async function initializeKafka(): Promise<void> {
    try {
        logger.info('Initializing Kafka infrastructure...');

        // Connect to Kafka
        await kafka.connect();
        logger.info('Connected to Kafka cluster');

        // Create required topics
        await kafka.createTopics();
        logger.info('Kafka topics created successfully');

        // Perform health check
        const isHealthy = await kafka.healthCheck();
        if (isHealthy) {
            logger.info('Kafka health check passed');
        } else {
            throw new Error('Kafka health check failed');
        }

        logger.info('Kafka initialization completed successfully');

    } catch (error) {
        logger.error('Failed to initialize Kafka', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
    } finally {
        // Disconnect from Kafka
        await kafka.disconnect();
        logger.info('Disconnected from Kafka');
        process.exit(0);
    }
}

// Handle process signals
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await kafka.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await kafka.disconnect();
    process.exit(0);
});

// Run initialization if this script is executed directly
if (require.main === module) {
    initializeKafka();
}

export { initializeKafka };