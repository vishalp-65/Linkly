import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { PreferencesRepository } from '../repositories/PreferencesRepository';
import {
    UserPreferences,
    NotificationSettings,
    UpdatePreferencesRequest,
    UpdateNotificationSettingsRequest,
    WebhookTestRequest,
    WebhookTestResponse
} from '../types/preferences.types';
import { ApiError } from '../utils/ApiError';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

export class PreferencesService {
    private preferencesRepository: PreferencesRepository;
    private readonly CACHE_TTL = 3600; // 1 hour
    private readonly CACHE_PREFIX_PREFERENCES = 'user:preferences:';
    private readonly CACHE_PREFIX_NOTIFICATIONS = 'user:notifications:';

    constructor() {
        this.preferencesRepository = new PreferencesRepository();
    }

    /**
     * Get user preferences with caching
     */
    async getUserPreferences(userId: number): Promise<UserPreferences> {
        const cacheKey = `${this.CACHE_PREFIX_PREFERENCES}${userId}`;

        try {
            // Try to get from cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.debug('User preferences retrieved from cache', { userId });
                return JSON.parse(cached);
            }

            // Get from database
            const preferences = await this.preferencesRepository.getUserPreferences(userId);
            if (!preferences) {
                throw ApiError.notFound('User preferences not found', 'PREFERENCES_NOT_FOUND');
            }

            // Cache the result
            await redis.set(cacheKey, JSON.stringify(preferences), this.CACHE_TTL);

            logger.info('User preferences retrieved from database', { userId });
            return preferences;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            logger.error('Error getting user preferences', { error, userId });
            throw ApiError.internal('Failed to retrieve user preferences');
        }
    }

    /**
     * Update user preferences
     */
    async updateUserPreferences(
        userId: number,
        data: UpdatePreferencesRequest
    ): Promise<UserPreferences> {
        try {
            console.log("DATA IS", data);
            // Validate custom domain if provided
            if (data.customDomain !== undefined && data.customDomain) {
                this.validateCustomDomain(data.customDomain);
            }

            // Validate default expiry if provided
            if (data.defaultExpiry !== undefined && data.defaultExpiry !== null) {
                if (data.defaultExpiry < 1 || data.defaultExpiry > 3650) {
                    throw ApiError.badRequest(
                        'Default expiry must be between 1 and 3650 days',
                        'INVALID_EXPIRY'
                    );
                }
            }

            // Update in database
            const preferences = await this.preferencesRepository.updateUserPreferences(userId, data);

            // Invalidate cache
            const cacheKey = `${this.CACHE_PREFIX_PREFERENCES}${userId}`;
            await redis.del(cacheKey);

            logger.info('User preferences updated', { userId, data });
            return preferences;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            logger.error('Error updating user preferences', { error, userId, data });
            throw ApiError.internal('Failed to update user preferences');
        }
    }

    /**
     * Get notification settings with caching
     */
    async getNotificationSettings(userId: number): Promise<NotificationSettings> {
        const cacheKey = `${this.CACHE_PREFIX_NOTIFICATIONS}${userId}`;

        try {
            // Try to get from cache
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.debug('Notification settings retrieved from cache', { userId });
                return JSON.parse(cached);
            }

            // Get from database
            const settings = await this.preferencesRepository.getNotificationSettings(userId);
            if (!settings) {
                throw ApiError.notFound('Notification settings not found', 'SETTINGS_NOT_FOUND');
            }

            // Cache the result
            await redis.set(cacheKey, JSON.stringify(settings), this.CACHE_TTL);

            logger.info('Notification settings retrieved from database', { userId });
            return settings;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            logger.error('Error getting notification settings', { error, userId });
            throw ApiError.internal('Failed to retrieve notification settings');
        }
    }

    /**
     * Update notification settings
     */
    async updateNotificationSettings(
        userId: number,
        data: UpdateNotificationSettingsRequest
    ): Promise<NotificationSettings> {
        try {
            // Validate webhook URL if provided
            if (data.webhooks?.url) {
                this.validateWebhookUrl(data.webhooks.url);
            }

            // Update in database
            const settings = await this.preferencesRepository.updateNotificationSettings(userId, data);

            // Invalidate cache
            const cacheKey = `${this.CACHE_PREFIX_NOTIFICATIONS}${userId}`;
            await redis.del(cacheKey);

            logger.info('Notification settings updated', { userId });
            return settings;
        } catch (error) {
            if (error instanceof ApiError) throw error;
            logger.error('Error updating notification settings', { error, userId, data });
            throw ApiError.internal('Failed to update notification settings');
        }
    }

    /**
     * Test webhook endpoint
     */
    async testWebhook(data: WebhookTestRequest): Promise<WebhookTestResponse> {
        try {
            this.validateWebhookUrl(data.url);

            const testPayload = {
                event: 'webhook.test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'This is a test webhook from URL Shortener',
                    testId: crypto.randomBytes(8).toString('hex'),
                },
            };

            const payloadString = JSON.stringify(testPayload);
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'URLShortener-Webhook/1.0',
                'Content-Length': Buffer.byteLength(payloadString).toString(),
            };

            // Add signature if secret is provided
            if (data.secret) {
                const signature = this.generateWebhookSignature(testPayload, data.secret);
                headers['X-Webhook-Signature'] = signature;
            }

            const startTime = Date.now();
            const result = await this.sendHttpRequest(data.url, payloadString, headers);
            const responseTime = Date.now() - startTime;

            const success = result.statusCode >= 200 && result.statusCode < 300;

            logger.info('Webhook test completed', {
                url: data.url,
                statusCode: result.statusCode,
                responseTime,
                success,
            });

            return {
                success,
                statusCode: result.statusCode,
                responseTime,
                error: success ? undefined : `HTTP ${result.statusCode}: ${result.statusMessage}`,
            };
        } catch (error: any) {
            logger.error('Webhook test failed', { error, url: data.url });

            return {
                success: false,
                error: error.message || 'Failed to connect to webhook endpoint',
            };
        }
    }

    /**
     * Send webhook notification
     */
    async sendWebhookNotification(
        userId: number,
        event: string,
        payload: any
    ): Promise<void> {
        try {
            const settings = await this.getNotificationSettings(userId);

            if (!settings.webhooks.enabled || !settings.webhooks.url) {
                return;
            }

            // Check if this event is enabled
            const eventKey = event.replace('url.', '') as keyof typeof settings.webhooks.events;
            if (eventKey in settings.webhooks.events && !settings.webhooks.events[eventKey as keyof typeof settings.webhooks.events]) {
                return;
            }

            const webhookPayload = {
                event,
                timestamp: new Date().toISOString(),
                data: payload,
            };

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'URLShortener-Webhook/1.0',
            };

            if (settings.webhooks.secret) {
                const signature = this.generateWebhookSignature(webhookPayload, settings.webhooks.secret);
                headers['X-Webhook-Signature'] = signature;
            }

            // Send webhook asynchronously (don't wait for response)
            const payloadString = JSON.stringify(webhookPayload);
            headers['Content-Length'] = Buffer.byteLength(payloadString).toString();

            this.sendHttpRequest(settings.webhooks.url, payloadString, headers).catch((error) => {
                logger.error('Failed to send webhook notification', {
                    userId,
                    event,
                    error: error.message,
                });
            });

            logger.info('Webhook notification sent', { userId, event });
        } catch (error) {
            logger.error('Error sending webhook notification', { error, userId, event });
        }
    }

    /**
     * Validate custom domain format
     */
    private validateCustomDomain(domain: string): void {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
        if (!domainRegex.test(domain)) {
            throw ApiError.badRequest('Invalid custom domain format', 'INVALID_DOMAIN');
        }
    }

    /**
     * Validate webhook URL
     */
    private validateWebhookUrl(url: string): void {
        try {
            const parsedUrl = new URL(url);
            if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
                throw new Error('Invalid protocol');
            }
        } catch {
            throw ApiError.badRequest('Invalid webhook URL format', 'INVALID_WEBHOOK_URL');
        }
    }

    /**
     * Generate webhook signature
     */
    private generateWebhookSignature(payload: any, secret: string): string {
        const payloadString = JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
    }

    /**
     * Send HTTP request for webhook
     */
    private sendHttpRequest(
        url: string,
        payload: string,
        headers: Record<string, string>
    ): Promise<{ statusCode: number; statusMessage: string }> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers,
                timeout: 10000,
            };

            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode || 0,
                        statusMessage: res.statusMessage || 'Unknown',
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(payload);
            req.end();
        });
    }

    /**
     * Clear user preferences cache
     */
    async clearUserCache(userId: number): Promise<void> {
        try {
            await Promise.all([
                redis.del(`${this.CACHE_PREFIX_PREFERENCES}${userId}`),
                redis.del(`${this.CACHE_PREFIX_NOTIFICATIONS}${userId}`),
            ]);
            logger.info('User preferences cache cleared', { userId });
        } catch (error) {
            logger.error('Error clearing user preferences cache', { error, userId });
        }
    }
}
