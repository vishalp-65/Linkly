import { logger } from '../config/logger';
import { PreferencesService } from './preferencesService';
import { UserRepository } from '../repositories/UserRepository';
import { URLRepository } from '../repositories/URLRepository';
import { AnalyticsRepository } from '../repositories/AnalyticsRepository';
import { User } from '../types/user.types';

export interface EmailNotification {
    to: string;
    subject: string;
    body: string;
    html?: string;
}

export interface URLExpiryNotification {
    userId: number;
    shortCode: string;
    longUrl: string;
    expiresAt: Date;
    hoursUntilExpiry: number;
}

export interface HighTrafficNotification {
    userId: number;
    shortCode: string;
    longUrl: string;
    currentClicks: number;
    averageClicks: number;
    multiplier: number;
}

export class NotificationService {
    private preferencesService: PreferencesService;
    private userRepository: UserRepository;
    private urlRepository: URLRepository;
    private analyticsRepository: AnalyticsRepository;

    constructor() {
        this.preferencesService = new PreferencesService();
        this.userRepository = new UserRepository();
        this.urlRepository = new URLRepository();
        this.analyticsRepository = new AnalyticsRepository();
    }

    /**
     * Send URL expiring soon notification
     */
    async sendUrlExpiringNotification(notification: URLExpiryNotification): Promise<void> {
        try {
            const user = await this.userRepository.findById(notification.userId);
            if (!user) {
                logger.warn('User not found for expiry notification', { userId: notification.userId });
                return;
            }

            const settings = await this.preferencesService.getNotificationSettings(notification.userId);

            if (!settings.emailNotifications.urlExpiring) {
                logger.debug('URL expiring notifications disabled for user', { userId: notification.userId });
                return;
            }

            const emailData: EmailNotification = {
                to: user.email,
                subject: `Your short URL will expire in ${notification.hoursUntilExpiry} hours`,
                body: this.generateExpiringEmailBody(notification),
                html: this.generateExpiringEmailHtml(notification)
            };

            await this.sendEmail(emailData);

            // Send webhook notification
            await this.preferencesService.sendWebhookNotification(notification.userId, 'url.expiring', {
                shortCode: notification.shortCode,
                longUrl: notification.longUrl,
                expiresAt: notification.expiresAt,
                hoursUntilExpiry: notification.hoursUntilExpiry
            });

            logger.info('URL expiring notification sent', {
                userId: notification.userId,
                shortCode: notification.shortCode
            });
        } catch (error) {
            logger.error('Failed to send URL expiring notification', {
                userId: notification.userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send URL expired notification
     */
    async sendUrlExpiredNotification(userId: number, shortCode: string, longUrl: string): Promise<void> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                logger.warn('User not found for expired notification', { userId });
                return;
            }

            const settings = await this.preferencesService.getNotificationSettings(userId);

            if (!settings.emailNotifications.urlExpired) {
                logger.debug('URL expired notifications disabled for user', { userId });
                return;
            }

            const emailData: EmailNotification = {
                to: user.email,
                subject: 'Your short URL has expired',
                body: this.generateExpiredEmailBody(shortCode, longUrl),
                html: this.generateExpiredEmailHtml(shortCode, longUrl)
            };

            await this.sendEmail(emailData);

            // Send webhook notification
            await this.preferencesService.sendWebhookNotification(userId, 'url.expired', {
                shortCode,
                longUrl,
                expiredAt: new Date().toISOString()
            });

            logger.info('URL expired notification sent', { userId, shortCode });
        } catch (error) {
            logger.error('Failed to send URL expired notification', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send high traffic alert
     */
    async sendHighTrafficAlert(notification: HighTrafficNotification): Promise<void> {
        try {
            const user = await this.userRepository.findById(notification.userId);
            if (!user) {
                logger.warn('User not found for high traffic alert', { userId: notification.userId });
                return;
            }

            const settings = await this.preferencesService.getNotificationSettings(notification.userId);

            if (!settings.emailNotifications.highTraffic) {
                logger.debug('High traffic alerts disabled for user', { userId: notification.userId });
                return;
            }

            const emailData: EmailNotification = {
                to: user.email,
                subject: `High traffic alert for your short URL`,
                body: this.generateHighTrafficEmailBody(notification),
                html: this.generateHighTrafficEmailHtml(notification)
            };

            await this.sendEmail(emailData);

            logger.info('High traffic alert sent', {
                userId: notification.userId,
                shortCode: notification.shortCode,
                multiplier: notification.multiplier
            });
        } catch (error) {
            logger.error('Failed to send high traffic alert', {
                userId: notification.userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send weekly analytics report
     */
    async sendWeeklyReport(userId: number): Promise<void> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                logger.warn('User not found for weekly report', { userId });
                return;
            }

            const settings = await this.preferencesService.getNotificationSettings(userId);

            if (!settings.emailNotifications.weeklyReport) {
                logger.debug('Weekly reports disabled for user', { userId });
                return;
            }

            // Get analytics data for the past week
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);

            const analytics = await this.getWeeklyAnalytics(userId, startDate, endDate);

            const emailData: EmailNotification = {
                to: user.email,
                subject: 'Your Weekly URL Analytics Report',
                body: this.generateWeeklyReportBody(analytics),
                html: this.generateWeeklyReportHtml(analytics)
            };

            await this.sendEmail(emailData);

            logger.info('Weekly report sent', { userId });
        } catch (error) {
            logger.error('Failed to send weekly report', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send monthly analytics report
     */
    async sendMonthlyReport(userId: number): Promise<void> {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                logger.warn('User not found for monthly report', { userId });
                return;
            }

            const settings = await this.preferencesService.getNotificationSettings(userId);

            if (!settings.emailNotifications.monthlyReport) {
                logger.debug('Monthly reports disabled for user', { userId });
                return;
            }

            // Get analytics data for the past month
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            const analytics = await this.getMonthlyAnalytics(userId, startDate, endDate);

            const emailData: EmailNotification = {
                to: user.email,
                subject: 'Your Monthly URL Analytics Report',
                body: this.generateMonthlyReportBody(analytics),
                html: this.generateMonthlyReportHtml(analytics)
            };

            await this.sendEmail(emailData);

            logger.info('Monthly report sent', { userId });
        } catch (error) {
            logger.error('Failed to send monthly report', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send email (placeholder - integrate with actual email service)
     */
    private async sendEmail(emailData: EmailNotification): Promise<void> {
        // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
        logger.info('Email notification queued', {
            to: emailData.to,
            subject: emailData.subject
        });

        // For now, just log the email content
        logger.debug('Email content', {
            to: emailData.to,
            subject: emailData.subject,
            body: emailData.body.substring(0, 100)
        });
    }

    /**
     * Generate email body for expiring URL
     */
    private generateExpiringEmailBody(notification: URLExpiryNotification): string {
        return `
Hello,

Your short URL is about to expire in ${notification.hoursUntilExpiry} hours.

Short Code: ${notification.shortCode}
Long URL: ${notification.longUrl}
Expires At: ${notification.expiresAt.toLocaleString()}

If you want to keep this URL active, please log in to your account and extend the expiration date.

Best regards,
URL Shortener Team
        `.trim();
    }

    /**
     * Generate HTML email for expiring URL
     */
    private generateExpiringEmailHtml(notification: URLExpiryNotification): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .url-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4F46E5; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>URL Expiring Soon</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your short URL is about to expire in <strong>${notification.hoursUntilExpiry} hours</strong>.</p>
            <div class="url-info">
                <p><strong>Short Code:</strong> ${notification.shortCode}</p>
                <p><strong>Long URL:</strong> ${notification.longUrl}</p>
                <p><strong>Expires At:</strong> ${notification.expiresAt.toLocaleString()}</p>
            </div>
            <p>If you want to keep this URL active, please log in to your account and extend the expiration date.</p>
        </div>
        <div class="footer">
            <p>URL Shortener Team</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Generate email body for expired URL
     */
    private generateExpiredEmailBody(shortCode: string, longUrl: string): string {
        return `
Hello,

Your short URL has expired and is no longer accessible.

Short Code: ${shortCode}
Long URL: ${longUrl}

You can create a new short URL for this destination if needed.

Best regards,
URL Shortener Team
        `.trim();
    }

    /**
     * Generate HTML email for expired URL
     */
    private generateExpiredEmailHtml(shortCode: string, longUrl: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .url-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #DC2626; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>URL Expired</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your short URL has expired and is no longer accessible.</p>
            <div class="url-info">
                <p><strong>Short Code:</strong> ${shortCode}</p>
                <p><strong>Long URL:</strong> ${longUrl}</p>
            </div>
            <p>You can create a new short URL for this destination if needed.</p>
        </div>
        <div class="footer">
            <p>URL Shortener Team</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Generate email body for high traffic alert
     */
    private generateHighTrafficEmailBody(notification: HighTrafficNotification): string {
        return `
Hello,

Your short URL is experiencing unusually high traffic!

Short Code: ${notification.shortCode}
Long URL: ${notification.longUrl}
Current Clicks: ${notification.currentClicks}
Average Clicks: ${notification.averageClicks}
Traffic Multiplier: ${notification.multiplier}x

This is ${notification.multiplier} times your normal traffic. You may want to check your analytics for more details.

Best regards,
URL Shortener Team
        `.trim();
    }

    /**
     * Generate HTML email for high traffic alert
     */
    private generateHighTrafficEmailHtml(notification: HighTrafficNotification): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .url-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #F59E0B; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #F59E0B; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 High Traffic Alert</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your short URL is experiencing unusually high traffic!</p>
            <div class="url-info">
                <p><strong>Short Code:</strong> ${notification.shortCode}</p>
                <p><strong>Long URL:</strong> ${notification.longUrl}</p>
            </div>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${notification.currentClicks}</div>
                    <div>Current Clicks</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${notification.averageClicks}</div>
                    <div>Average Clicks</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${notification.multiplier}x</div>
                    <div>Multiplier</div>
                </div>
            </div>
            <p>This is <strong>${notification.multiplier} times</strong> your normal traffic. You may want to check your analytics for more details.</p>
        </div>
        <div class="footer">
            <p>URL Shortener Team</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Generate weekly report body
     */
    private generateWeeklyReportBody(analytics: any): string {
        return `
Hello,

Here's your weekly URL analytics report:

Total URLs: ${analytics.totalUrls}
Total Clicks: ${analytics.totalClicks}
New URLs This Week: ${analytics.newUrls}
Top Performing URL: ${analytics.topUrl?.shortCode || 'N/A'}

Log in to your dashboard to see detailed analytics.

Best regards,
URL Shortener Team
        `.trim();
    }

    /**
     * Generate weekly report HTML
     */
    private generateWeeklyReportHtml(analytics: any): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .stat-card { background-color: white; padding: 15px; text-align: center; border-radius: 8px; }
        .stat-value { font-size: 32px; font-weight: bold; color: #10B981; }
        .stat-label { color: #6b7280; margin-top: 5px; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Weekly Analytics Report</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Here's your weekly URL analytics report:</p>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-value">${analytics.totalUrls}</div>
                    <div class="stat-label">Total URLs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.totalClicks}</div>
                    <div class="stat-label">Total Clicks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.newUrls}</div>
                    <div class="stat-label">New URLs This Week</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${analytics.topUrl?.clicks || 0}</div>
                    <div class="stat-label">Top URL Clicks</div>
                </div>
            </div>
            <p>Log in to your dashboard to see detailed analytics.</p>
        </div>
        <div class="footer">
            <p>URL Shortener Team</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }

    /**
     * Generate monthly report body
     */
    private generateMonthlyReportBody(analytics: any): string {
        return this.generateWeeklyReportBody(analytics).replace('weekly', 'monthly').replace('This Week', 'This Month');
    }

    /**
     * Generate monthly report HTML
     */
    private generateMonthlyReportHtml(analytics: any): string {
        return this.generateWeeklyReportHtml(analytics).replace('Weekly', 'Monthly').replace('This Week', 'This Month');
    }

    /**
     * Get weekly analytics
     */
    private async getWeeklyAnalytics(userId: number, startDate: Date, endDate: Date): Promise<any> {
        // TODO: Implement actual analytics aggregation
        return {
            totalUrls: 0,
            totalClicks: 0,
            newUrls: 0,
            topUrl: null
        };
    }

    /**
     * Get monthly analytics
     */
    private async getMonthlyAnalytics(userId: number, startDate: Date, endDate: Date): Promise<any> {
        // TODO: Implement actual analytics aggregation
        return {
            totalUrls: 0,
            totalClicks: 0,
            newUrls: 0,
            topUrl: null
        };
    }

    /**
     * Check for expiring URLs and send notifications
     */
    async checkExpiringUrls(): Promise<void> {
        try {
            const now = new Date();
            const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            // Get URLs expiring in the next 24 hours
            const expiringUrls = await this.urlRepository.findExpiringUrls(now, in24Hours);

            logger.info('Checking for expiring URLs', { count: expiringUrls.length });

            for (const url of expiringUrls) {
                if (url.user_id) {
                    const hoursUntilExpiry = Math.round(
                        (url.expires_at!.getTime() - now.getTime()) / (1000 * 60 * 60)
                    );

                    await this.sendUrlExpiringNotification({
                        userId: url.user_id,
                        shortCode: url.short_code,
                        longUrl: url.long_url,
                        expiresAt: url.expires_at!,
                        hoursUntilExpiry
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to check expiring URLs', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send all weekly reports
     */
    async sendAllWeeklyReports(): Promise<void> {
        try {
            // Get all users with weekly reports enabled
            const users = await this.userRepository.findAll();

            logger.info('Sending weekly reports', { userCount: users.length });

            for (const user of users) {
                try {
                    const settings = await this.preferencesService.getNotificationSettings(user.userId);
                    if (settings.emailNotifications.weeklyReport) {
                        await this.sendWeeklyReport(user.userId);
                    }
                } catch (error) {
                    logger.error('Failed to send weekly report for user', {
                        userId: user.userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to send weekly reports', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send all monthly reports
     */
    async sendAllMonthlyReports(): Promise<void> {
        try {
            // Get all users with monthly reports enabled
            const users = await this.userRepository.findAll();

            logger.info('Sending monthly reports', { userCount: users.length });

            for (const user of users) {
                try {
                    const settings = await this.preferencesService.getNotificationSettings(user.userId);
                    if (settings.emailNotifications.monthlyReport) {
                        await this.sendMonthlyReport(user.userId);
                    }
                } catch (error) {
                    logger.error('Failed to send monthly report for user', {
                        userId: user.userId,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to send monthly reports', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
