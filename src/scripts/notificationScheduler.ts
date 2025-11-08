import cron from 'node-cron';
import { logger } from '../config/logger';
import { NotificationService } from '../services/notificationService';

const notificationService = new NotificationService();

/**
 * Schedule notification tasks
 */
export function scheduleNotifications() {
    logger.info('Initializing notification scheduler');

    // Check for expiring URLs every hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Running expiring URLs check');
        try {
            await notificationService.checkExpiringUrls();
        } catch (error) {
            logger.error('Failed to check expiring URLs', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Send weekly reports every Monday at 9 AM
    cron.schedule('0 9 * * 1', async () => {
        logger.info('Sending weekly reports');
        try {
            await notificationService.sendAllWeeklyReports();
        } catch (error) {
            logger.error('Failed to send weekly reports', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Send monthly reports on the 1st of each month at 9 AM
    cron.schedule('0 9 1 * *', async () => {
        logger.info('Sending monthly reports');
        try {
            await notificationService.sendAllMonthlyReports();
        } catch (error) {
            logger.error('Failed to send monthly reports', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    logger.info('Notification scheduler initialized successfully');
}

// Run scheduler if this file is executed directly
if (require.main === module) {
    scheduleNotifications();
    logger.info('Notification scheduler is running. Press Ctrl+C to exit.');
}
