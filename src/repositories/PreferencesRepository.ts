import { db } from '../config/database';
import { logger } from '../config/logger';
import {
    UserPreferences,
    NotificationSettings,
    UpdatePreferencesRequest,
    UpdateNotificationSettingsRequest
} from '../types/preferences.types';

export class PreferencesRepository {
    /**
     * Get user preferences
     */
    async getUserPreferences(userId: number): Promise<UserPreferences | null> {
        const query = `
            SELECT 
                id,
                user_id as "userId",
                duplicate_strategy as "duplicateStrategy",
                default_expiry as "defaultExpiry",
                custom_domain as "customDomain",
                enable_analytics as "enableAnalytics",
                enable_qr_code as "enableQRCode",
                enable_password_protection as "enablePasswordProtection",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM user_preferences
            WHERE user_id = $1
        `;

        try {
            const result = await db.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting user preferences', { error, userId });
            throw error;
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(
        userId: number,
        data: UpdatePreferencesRequest
    ): Promise<UserPreferences> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.duplicateStrategy !== undefined) {
            fields.push(`duplicate_strategy = $${paramCount++}`);
            values.push(data.duplicateStrategy);
        }

        if (data.defaultExpiry !== undefined) {
            fields.push(`default_expiry = $${paramCount++}`);
            values.push(data.defaultExpiry);
        }

        if (data.customDomain !== undefined) {
            fields.push(`custom_domain = $${paramCount++}`);
            values.push(data.customDomain || null);
        }

        if (data.enableAnalytics !== undefined) {
            fields.push(`enable_analytics = $${paramCount++}`);
            values.push(data.enableAnalytics);
        }

        if (data.enableQRCode !== undefined) {
            fields.push(`enable_qr_code = $${paramCount++}`);
            values.push(data.enableQRCode);
        }

        if (data.enablePasswordProtection !== undefined) {
            fields.push(`enable_password_protection = $${paramCount++}`);
            values.push(data.enablePasswordProtection);
        }

        if (fields.length === 0) {
            const existing = await this.getUserPreferences(userId);
            if (!existing) throw new Error('User preferences not found');
            return existing;
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `
            UPDATE user_preferences
            SET ${fields.join(', ')}
            WHERE user_id = $${paramCount}
            RETURNING 
                id,
                user_id as "userId",
                duplicate_strategy as "duplicateStrategy",
                default_expiry as "defaultExpiry",
                custom_domain as "customDomain",
                enable_analytics as "enableAnalytics",
                enable_qr_code as "enableQRCode",
                enable_password_protection as "enablePasswordProtection",
                created_at as "createdAt",
                updated_at as "updatedAt"
        `;

        try {
            const result = await db.query(query, values);
            if (!result.rows[0]) {
                throw new Error('Failed to update user preferences');
            }
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating user preferences', { error, userId, data });
            throw error;
        }
    }

    /**
     * Get notification settings
     */
    async getNotificationSettings(userId: number): Promise<NotificationSettings | null> {
        const query = `
            SELECT 
                id,
                user_id as "userId",
                email_url_expiring as "emailUrlExpiring",
                email_url_expired as "emailUrlExpired",
                email_high_traffic as "emailHighTraffic",
                email_weekly_report as "emailWeeklyReport",
                email_monthly_report as "emailMonthlyReport",
                webhook_enabled as "webhookEnabled",
                webhook_url as "webhookUrl",
                webhook_secret as "webhookSecret",
                webhook_event_url_created as "webhookEventUrlCreated",
                webhook_event_url_clicked as "webhookEventUrlClicked",
                webhook_event_url_expired as "webhookEventUrlExpired",
                webhook_event_url_deleted as "webhookEventUrlDeleted",
                created_at as "createdAt",
                updated_at as "updatedAt"
            FROM notification_settings
            WHERE user_id = $1
        `;

        try {
            const result = await db.query(query, [userId]);
            if (!result.rows[0]) return null;

            const row = result.rows[0];
            return {
                id: row.id,
                userId: row.userId,
                emailNotifications: {
                    urlExpiring: row.emailUrlExpiring,
                    urlExpired: row.emailUrlExpired,
                    highTraffic: row.emailHighTraffic,
                    weeklyReport: row.emailWeeklyReport,
                    monthlyReport: row.emailMonthlyReport,
                },
                webhooks: {
                    enabled: row.webhookEnabled,
                    url: row.webhookUrl,
                    secret: row.webhookSecret,
                    events: {
                        urlCreated: row.webhookEventUrlCreated,
                        urlClicked: row.webhookEventUrlClicked,
                        urlExpired: row.webhookEventUrlExpired,
                        urlDeleted: row.webhookEventUrlDeleted,
                    },
                },
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        } catch (error) {
            logger.error('Error getting notification settings', { error, userId });
            throw error;
        }
    }

    /**
     * Update notification settings
     */
    async updateNotificationSettings(
        userId: number,
        data: UpdateNotificationSettingsRequest
    ): Promise<NotificationSettings> {
        const fields: string[] = [];
        const values: any[] = [];
        let paramCount = 1;

        if (data.emailNotifications) {
            if (data.emailNotifications.urlExpiring !== undefined) {
                fields.push(`email_url_expiring = $${paramCount++}`);
                values.push(data.emailNotifications.urlExpiring);
            }
            if (data.emailNotifications.urlExpired !== undefined) {
                fields.push(`email_url_expired = $${paramCount++}`);
                values.push(data.emailNotifications.urlExpired);
            }
            if (data.emailNotifications.highTraffic !== undefined) {
                fields.push(`email_high_traffic = $${paramCount++}`);
                values.push(data.emailNotifications.highTraffic);
            }
            if (data.emailNotifications.weeklyReport !== undefined) {
                fields.push(`email_weekly_report = $${paramCount++}`);
                values.push(data.emailNotifications.weeklyReport);
            }
            if (data.emailNotifications.monthlyReport !== undefined) {
                fields.push(`email_monthly_report = $${paramCount++}`);
                values.push(data.emailNotifications.monthlyReport);
            }
        }

        if (data.webhooks) {
            if (data.webhooks.enabled !== undefined) {
                fields.push(`webhook_enabled = $${paramCount++}`);
                values.push(data.webhooks.enabled);
            }
            if (data.webhooks.url !== undefined) {
                fields.push(`webhook_url = $${paramCount++}`);
                values.push(data.webhooks.url || null);
            }
            if (data.webhooks.secret !== undefined) {
                fields.push(`webhook_secret = $${paramCount++}`);
                values.push(data.webhooks.secret || null);
            }
            if (data.webhooks.events) {
                if (data.webhooks.events.urlCreated !== undefined) {
                    fields.push(`webhook_event_url_created = $${paramCount++}`);
                    values.push(data.webhooks.events.urlCreated);
                }
                if (data.webhooks.events.urlClicked !== undefined) {
                    fields.push(`webhook_event_url_clicked = $${paramCount++}`);
                    values.push(data.webhooks.events.urlClicked);
                }
                if (data.webhooks.events.urlExpired !== undefined) {
                    fields.push(`webhook_event_url_expired = $${paramCount++}`);
                    values.push(data.webhooks.events.urlExpired);
                }
                if (data.webhooks.events.urlDeleted !== undefined) {
                    fields.push(`webhook_event_url_deleted = $${paramCount++}`);
                    values.push(data.webhooks.events.urlDeleted);
                }
            }
        }

        if (fields.length === 0) {
            const existing = await this.getNotificationSettings(userId);
            if (!existing) throw new Error('Notification settings not found');
            return existing;
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `
            UPDATE notification_settings
            SET ${fields.join(', ')}
            WHERE user_id = $${paramCount}
            RETURNING 
                id,
                user_id as "userId",
                email_url_expiring as "emailUrlExpiring",
                email_url_expired as "emailUrlExpired",
                email_high_traffic as "emailHighTraffic",
                email_weekly_report as "emailWeeklyReport",
                email_monthly_report as "emailMonthlyReport",
                webhook_enabled as "webhookEnabled",
                webhook_url as "webhookUrl",
                webhook_secret as "webhookSecret",
                webhook_event_url_created as "webhookEventUrlCreated",
                webhook_event_url_clicked as "webhookEventUrlClicked",
                webhook_event_url_expired as "webhookEventUrlExpired",
                webhook_event_url_deleted as "webhookEventUrlDeleted",
                created_at as "createdAt",
                updated_at as "updatedAt"
        `;

        try {
            const result = await db.query(query, values);
            if (!result.rows[0]) {
                throw new Error('Failed to update notification settings');
            }

            const row = result.rows[0];
            return {
                id: row.id,
                userId: row.userId,
                emailNotifications: {
                    urlExpiring: row.emailUrlExpiring,
                    urlExpired: row.emailUrlExpired,
                    highTraffic: row.emailHighTraffic,
                    weeklyReport: row.emailWeeklyReport,
                    monthlyReport: row.emailMonthlyReport,
                },
                webhooks: {
                    enabled: row.webhookEnabled,
                    url: row.webhookUrl,
                    secret: row.webhookSecret,
                    events: {
                        urlCreated: row.webhookEventUrlCreated,
                        urlClicked: row.webhookEventUrlClicked,
                        urlExpired: row.webhookEventUrlExpired,
                        urlDeleted: row.webhookEventUrlDeleted,
                    },
                },
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            };
        } catch (error) {
            logger.error('Error updating notification settings', { error, userId, data });
            throw error;
        }
    }

    /**
     * Health check for repository
     */
    async healthCheck(): Promise<boolean> {
        try {
            await db.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Repository health check failed', {
                repository: this.constructor.name,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
}
