import React, { useState, useEffect } from 'react';
import { Card, Button, Input, FormField, Toggle } from '../common';
import { useToast } from '../../contexts/ToastContext';
import {
    useGetNotificationSettingsQuery,
    useUpdateNotificationSettingsMutation,
    useTestWebhookMutation
} from '../../services/api';
import type { NotificationSettings } from '../../types/preferences.types';

const NotificationSettingsComponent: React.FC = () => {
    const { showToast } = useToast();
    const [hasChanges, setHasChanges] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState(false);

    const {
        data: notificationData,
        isLoading: isLoadingNotifications,
        error: notificationError
    } = useGetNotificationSettingsQuery();

    const [updateNotifications, { isLoading: isUpdating }] = useUpdateNotificationSettingsMutation();
    const [testWebhook] = useTestWebhookMutation();

    const [settings, setSettings] = useState<NotificationSettings>({
        emailNotifications: {
            urlExpiring: true,
            urlExpired: true,
            highTraffic: false,
            weeklyReport: true,
            monthlyReport: false,
        },
        webhooks: {
            enabled: false,
            url: '',
            secret: '',
            events: {
                urlCreated: false,
                urlClicked: false,
                urlExpired: true,
                urlDeleted: false,
            },
        },
    });

    useEffect(() => {
        if (notificationData?.data?.notifications) {
            setSettings(notificationData.data.notifications);
            setHasChanges(false);
        }
    }, [notificationData]);

    useEffect(() => {
        if (notificationError) {
            showToast({
                message: 'Failed to load notification settings',
                type: 'error'
            });
        }
    }, [notificationError, showToast]);

    const handleEmailNotificationChange = (key: keyof NotificationSettings['emailNotifications'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            emailNotifications: {
                ...prev.emailNotifications,
                [key]: value
            }
        }));
        setHasChanges(true);
    };

    const handleWebhookChange = (key: keyof NotificationSettings['webhooks'], value: any) => {
        setSettings(prev => ({
            ...prev,
            webhooks: {
                ...prev.webhooks,
                [key]: value
            }
        }));
        setHasChanges(true);
    };

    const handleWebhookEventChange = (key: keyof NotificationSettings['webhooks']['events'], value: boolean) => {
        setSettings(prev => ({
            ...prev,
            webhooks: {
                ...prev.webhooks,
                events: {
                    ...prev.webhooks.events,
                    [key]: value
                }
            }
        }));
        setHasChanges(true);
    };

    const handleSaveSettings = async () => {
        try {
            await updateNotifications(settings).unwrap();
            showToast({ message: 'Notification settings saved successfully', type: 'success' });
            setHasChanges(false);
        } catch (error: any) {
            showToast({
                message: error?.data?.message || 'Failed to save notification settings',
                type: 'error'
            });
        }
    };

    const handleTestWebhook = async () => {
        if (!settings.webhooks.url) {
            showToast({
                message: 'Please enter a webhook URL first',
                type: 'error'
            });
            return;
        }

        setIsTestingWebhook(true);
        try {
            const result = await testWebhook({
                url: settings.webhooks.url,
                secret: settings.webhooks.secret
            }).unwrap();

            if (result.data.success) {
                showToast({
                    message: `Webhook test successful! Response time: ${result.data.responseTime}ms`,
                    type: 'success'
                });
            } else {
                showToast({
                    message: `Webhook test failed: ${result.data.error || 'Unknown error'}`,
                    type: 'error'
                });
            }
        } catch (error: any) {
            showToast({
                message: error?.data?.message || 'Failed to test webhook',
                type: 'error'
            });
        } finally {
            setIsTestingWebhook(false);
        }
    };

    const validateWebhookUrl = (url: string): boolean => {
        if (!url) return true;
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
        } catch {
            return false;
        }
    };

    if (isLoadingNotifications) {
        return (
            <div className="space-y-6">
                <Card>
                    <div className="p-6">
                        <div className="animate-pulse">
                            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-6"></div>
                            <div className="space-y-4">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Email Notifications</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Choose which email notifications you'd like to receive about your URLs and account activity.
                    </p>

                    <div className="space-y-6">
                        <Toggle
                            checked={settings.emailNotifications.urlExpiring}
                            onChange={(checked) => handleEmailNotificationChange('urlExpiring', checked)}
                            label="URL Expiring Soon"
                            description="Get notified 24 hours before your URLs expire so you can extend them if needed."
                        />

                        <Toggle
                            checked={settings.emailNotifications.urlExpired}
                            onChange={(checked) => handleEmailNotificationChange('urlExpired', checked)}
                            label="URL Expired"
                            description="Receive notifications when your URLs have expired and are no longer accessible."
                        />

                        <Toggle
                            checked={settings.emailNotifications.highTraffic}
                            onChange={(checked) => handleEmailNotificationChange('highTraffic', checked)}
                            label="High Traffic Alerts"
                            description="Get notified when one of your URLs receives unusually high traffic (10x normal)."
                        />

                        <Toggle
                            checked={settings.emailNotifications.weeklyReport}
                            onChange={(checked) => handleEmailNotificationChange('weeklyReport', checked)}
                            label="Weekly Analytics Report"
                            description="Receive a weekly summary of your URL performance and click statistics."
                        />

                        <Toggle
                            checked={settings.emailNotifications.monthlyReport}
                            onChange={(checked) => handleEmailNotificationChange('monthlyReport', checked)}
                            label="Monthly Analytics Report"
                            description="Get a comprehensive monthly report with detailed analytics and insights."
                        />
                    </div>
                </div>
            </Card>

            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Webhook Configuration</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Configure webhooks to receive real-time notifications about URL events in your applications.
                    </p>

                    <div className="space-y-6">
                        <Toggle
                            checked={settings.webhooks.enabled}
                            onChange={(checked) => handleWebhookChange('enabled', checked)}
                            label="Enable Webhooks"
                            description="Turn on webhook notifications for real-time event delivery to your endpoint."
                        />

                        {settings.webhooks.enabled && (
                            <>
                                <div className="space-y-4">
                                    <FormField
                                        label="Webhook URL"
                                        helperText="HTTPS endpoint where webhook events will be sent"
                                        error={settings.webhooks.url && !validateWebhookUrl(settings.webhooks.url) ? 'Invalid URL format' : undefined}
                                    >
                                        <Input
                                            type="url"
                                            value={settings.webhooks.url}
                                            onChange={(e) => handleWebhookChange('url', e.target.value)}
                                            placeholder="https://your-app.com/webhooks/url-shortener"
                                        />
                                    </FormField>

                                    <FormField
                                        label="Webhook Secret (Optional)"
                                        helperText="Secret key for webhook signature verification (recommended for security)"
                                    >
                                        <Input
                                            type="password"
                                            value={settings.webhooks.secret || ''}
                                            onChange={(e) => handleWebhookChange('secret', e.target.value)}
                                            placeholder="Enter a secret key for webhook verification"
                                        />
                                    </FormField>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="secondary"
                                            onClick={handleTestWebhook}
                                            loading={isTestingWebhook}
                                            disabled={!settings.webhooks.url || !validateWebhookUrl(settings.webhooks.url)}
                                        >
                                            Test Webhook
                                        </Button>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Webhook Events</h3>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        Select which events should trigger webhook notifications.
                                    </p>

                                    <div className="space-y-4">
                                        <Toggle
                                            checked={settings.webhooks.events.urlCreated}
                                            onChange={(checked) => handleWebhookEventChange('urlCreated', checked)}
                                            label="URL Created"
                                            description="Triggered when a new short URL is created."
                                        />

                                        <Toggle
                                            checked={settings.webhooks.events.urlClicked}
                                            onChange={(checked) => handleWebhookEventChange('urlClicked', checked)}
                                            label="URL Clicked"
                                            description="Triggered every time someone clicks on your short URL (high volume)."
                                        />

                                        <Toggle
                                            checked={settings.webhooks.events.urlExpired}
                                            onChange={(checked) => handleWebhookEventChange('urlExpired', checked)}
                                            label="URL Expired"
                                            description="Triggered when a URL reaches its expiration date."
                                        />

                                        <Toggle
                                            checked={settings.webhooks.events.urlDeleted}
                                            onChange={(checked) => handleWebhookEventChange('urlDeleted', checked)}
                                            label="URL Deleted"
                                            description="Triggered when a URL is deleted from your account."
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {settings.webhooks.enabled && (
                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-blue-400 dark:text-blue-300" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">Webhook Format</h4>
                                    <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                                        <p>Webhooks are sent as POST requests with JSON payload:</p>
                                        <pre className="mt-2 text-xs bg-blue-100 dark:bg-blue-800/50 p-2 rounded overflow-x-auto">
                                            {`{
  "event": "url.created",
  "timestamp": "2024-11-07T10:30:00Z",
  "data": {
    "shortCode": "abc123",
    "longUrl": "https://example.com",
    "userId": "user123"
  }
}`}
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Save Changes</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                {hasChanges ? 'You have unsaved changes.' : 'All changes are saved.'}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <Button
                                onClick={handleSaveSettings}
                                loading={isUpdating}
                                disabled={!hasChanges}
                            >
                                Save Notification Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default NotificationSettingsComponent;