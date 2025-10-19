import React, { useState } from 'react';
import { Card, Button, Input, FormField, Toggle } from '../common';
import { useToast } from '../../contexts/ToastContext';

interface EmailNotificationSettings {
    urlExpiring: boolean;
    urlExpired: boolean;
    highTraffic: boolean;
    weeklyReport: boolean;
    monthlyReport: boolean;
    securityAlerts: boolean;
}

interface WebhookEndpoint {
    id: string;
    name: string;
    url: string;
    events: string[];
    isActive: boolean;
    createdAt: string;
    lastTriggered?: string;
    secret?: string;
}

const NotificationSettings: React.FC = () => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isTestingWebhook, setIsTestingWebhook] = useState<string | null>(null);

    // Mock notification settings - in real app, this would come from API
    const [emailSettings, setEmailSettings] = useState<EmailNotificationSettings>({
        urlExpiring: true,
        urlExpired: true,
        highTraffic: true,
        weeklyReport: false,
        monthlyReport: true,
        securityAlerts: true
    });

    const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
        {
            id: '1',
            name: 'Production Webhook',
            url: 'https://api.myapp.com/webhooks/url-shortener',
            events: ['url.clicked', 'url.expired'],
            isActive: true,
            createdAt: '2024-01-15T10:30:00Z',
            lastTriggered: '2024-11-02T14:22:00Z',
            secret: 'whsec_1234567890abcdef'
        }
    ]);

    const [newWebhook, setNewWebhook] = useState({
        name: '',
        url: '',
        events: [] as string[],
        secret: ''
    });

    const availableEvents = [
        { value: 'url.created', label: 'URL Created', description: 'Triggered when a new short URL is created' },
        { value: 'url.clicked', label: 'URL Clicked', description: 'Triggered when a short URL is accessed' },
        { value: 'url.expired', label: 'URL Expired', description: 'Triggered when a short URL expires' },
        { value: 'url.deleted', label: 'URL Deleted', description: 'Triggered when a short URL is deleted' },
        { value: 'analytics.daily', label: 'Daily Analytics', description: 'Daily analytics summary' },
        { value: 'security.alert', label: 'Security Alert', description: 'Security-related notifications' }
    ];

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleEmailSettingChange = (key: keyof EmailNotificationSettings, value: boolean) => {
        setEmailSettings(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    };

    const handleSaveEmailSettings = async () => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            showToast({ message: 'Email notification settings saved', type: 'success' });
            setHasChanges(false);
        } catch (error) {
            showToast({ message: 'Failed to save email settings', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateWebhook = async () => {
        if (!newWebhook.name.trim() || !newWebhook.url.trim()) {
            showToast({ message: 'Please fill in all required fields', type: 'error' });
            return;
        }

        if (!isValidUrl(newWebhook.url)) {
            showToast({ message: 'Please enter a valid URL', type: 'error' });
            return;
        }

        if (newWebhook.events.length === 0) {
            showToast({ message: 'Please select at least one event', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            const webhook: WebhookEndpoint = {
                id: Date.now().toString(),
                name: newWebhook.name,
                url: newWebhook.url,
                events: newWebhook.events,
                isActive: true,
                createdAt: new Date().toISOString(),
                secret: newWebhook.secret || `whsec_${Math.random().toString(36).substring(2, 34)}`
            };

            setWebhooks(prev => [...prev, webhook]);
            setNewWebhook({ name: '', url: '', events: [], secret: '' });
            showToast({ message: 'Webhook created successfully', type: 'success' });
        } catch (error) {
            showToast({ message: 'Failed to create webhook', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestWebhook = async (webhookId: string) => {
        setIsTestingWebhook(webhookId);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
            showToast({ message: 'Test webhook sent successfully', type: 'success' });

            // Update last triggered time
            setWebhooks(prev => prev.map(webhook =>
                webhook.id === webhookId
                    ? { ...webhook, lastTriggered: new Date().toISOString() }
                    : webhook
            ));
        } catch (error) {
            showToast({ message: 'Failed to send test webhook', type: 'error' });
        } finally {
            setIsTestingWebhook(null);
        }
    };

    const handleToggleWebhook = async (webhookId: string) => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

            setWebhooks(prev => prev.map(webhook =>
                webhook.id === webhookId
                    ? { ...webhook, isActive: !webhook.isActive }
                    : webhook
            ));

            showToast({ message: 'Webhook status updated', type: 'success' });
        } catch (error) {
            showToast({ message: 'Failed to update webhook status', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteWebhook = async (webhookId: string) => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

            setWebhooks(prev => prev.filter(webhook => webhook.id !== webhookId));
            showToast({ message: 'Webhook deleted successfully', type: 'success' });
        } catch (error) {
            showToast({ message: 'Failed to delete webhook', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({ message: `${label} copied to clipboard`, type: 'success' });
        } catch (error) {
            showToast({ message: `Failed to copy ${label}`, type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Email Notifications */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Notifications</h2>
                    <p className="text-gray-600 mb-6">
                        Choose which email notifications you'd like to receive.
                    </p>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">URL Management</h3>
                            <div className="space-y-4">
                                <Toggle
                                    checked={emailSettings.urlExpiring}
                                    onChange={(checked) => handleEmailSettingChange('urlExpiring', checked)}
                                    label="URL Expiring Soon"
                                    description="Get notified 24 hours before your URLs expire"
                                />

                                <Toggle
                                    checked={emailSettings.urlExpired}
                                    onChange={(checked) => handleEmailSettingChange('urlExpired', checked)}
                                    label="URL Expired"
                                    description="Get notified when your URLs have expired"
                                />

                                <Toggle
                                    checked={emailSettings.highTraffic}
                                    onChange={(checked) => handleEmailSettingChange('highTraffic', checked)}
                                    label="High Traffic Alerts"
                                    description="Get notified when a URL receives unusually high traffic"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Reports</h3>
                            <div className="space-y-4">
                                <Toggle
                                    checked={emailSettings.weeklyReport}
                                    onChange={(checked) => handleEmailSettingChange('weeklyReport', checked)}
                                    label="Weekly Analytics Report"
                                    description="Receive a summary of your URL performance every week"
                                />

                                <Toggle
                                    checked={emailSettings.monthlyReport}
                                    onChange={(checked) => handleEmailSettingChange('monthlyReport', checked)}
                                    label="Monthly Analytics Report"
                                    description="Receive a comprehensive monthly report of your URL analytics"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Security</h3>
                            <div className="space-y-4">
                                <Toggle
                                    checked={emailSettings.securityAlerts}
                                    onChange={(checked) => handleEmailSettingChange('securityAlerts', checked)}
                                    label="Security Alerts"
                                    description="Get notified about suspicious activity or security events"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex justify-end">
                            <Button
                                onClick={handleSaveEmailSettings}
                                loading={isLoading}
                                disabled={!hasChanges}
                            >
                                Save Email Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Webhook Configuration */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhook Endpoints</h2>
                    <p className="text-gray-600 mb-6">
                        Configure webhook endpoints to receive real-time notifications about URL events.
                    </p>

                    {/* Existing Webhooks */}
                    {webhooks.length > 0 && (
                        <div className="space-y-4 mb-8">
                            <h3 className="text-lg font-medium text-gray-900">Active Webhooks</h3>
                            {webhooks.map((webhook) => (
                                <div key={webhook.id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h4 className="font-medium text-gray-900">{webhook.name}</h4>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${webhook.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {webhook.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>

                                            <div className="text-sm text-gray-600 mb-2">
                                                <strong>URL:</strong> {webhook.url}
                                            </div>

                                            <div className="text-sm text-gray-600 mb-2">
                                                <strong>Events:</strong> {webhook.events.join(', ')}
                                            </div>

                                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                <span>Created: {formatDate(webhook.createdAt)}</span>
                                                {webhook.lastTriggered && (
                                                    <span>Last triggered: {formatDate(webhook.lastTriggered)}</span>
                                                )}
                                            </div>

                                            {webhook.secret && (
                                                <div className="mt-3 flex items-center space-x-2">
                                                    <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                                                        {webhook.secret.substring(0, 12)}...
                                                    </code>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => copyToClipboard(webhook.secret!, 'Webhook secret')}
                                                    >
                                                        Copy Secret
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex space-x-2 ml-4">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleTestWebhook(webhook.id)}
                                                loading={isTestingWebhook === webhook.id}
                                            >
                                                Test
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => handleToggleWebhook(webhook.id)}
                                                loading={isLoading}
                                            >
                                                {webhook.isActive ? 'Disable' : 'Enable'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDeleteWebhook(webhook.id)}
                                                loading={isLoading}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create New Webhook */}
                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Webhook</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField label="Webhook Name" required>
                                    <Input
                                        type="text"
                                        value={newWebhook.name}
                                        onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Production Webhook"
                                    />
                                </FormField>

                                <FormField label="Endpoint URL" required>
                                    <Input
                                        type="url"
                                        value={newWebhook.url}
                                        onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                                        placeholder="https://api.yourapp.com/webhooks"
                                        error={newWebhook.url && !isValidUrl(newWebhook.url) ? 'Invalid URL format' : undefined}
                                    />
                                </FormField>
                            </div>

                            <FormField
                                label="Webhook Secret (Optional)"
                                helperText="A secret key used to verify webhook authenticity"
                            >
                                <Input
                                    type="text"
                                    value={newWebhook.secret}
                                    onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
                                    placeholder="Leave empty to auto-generate"
                                />
                            </FormField>

                            <FormField label="Events to Subscribe" required>
                                <div className="space-y-3">
                                    {availableEvents.map((event) => (
                                        <div key={event.value} className="flex items-start space-x-3">
                                            <input
                                                type="checkbox"
                                                id={event.value}
                                                checked={newWebhook.events.includes(event.value)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setNewWebhook(prev => ({
                                                            ...prev,
                                                            events: [...prev.events, event.value]
                                                        }));
                                                    } else {
                                                        setNewWebhook(prev => ({
                                                            ...prev,
                                                            events: prev.events.filter(ev => ev !== event.value)
                                                        }));
                                                    }
                                                }}
                                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <div className="flex-1">
                                                <label htmlFor={event.value} className="block text-sm font-medium text-gray-900">
                                                    {event.label}
                                                </label>
                                                <p className="text-sm text-gray-500">{event.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </FormField>

                            <div className="flex justify-end">
                                <Button
                                    onClick={handleCreateWebhook}
                                    loading={isLoading}
                                >
                                    Create Webhook
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Webhook Documentation */}
                    <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-blue-800">
                                    Webhook Implementation Guide
                                </h3>
                                <div className="mt-2 text-sm text-blue-700">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Webhooks are sent as POST requests with JSON payload</li>
                                        <li>Include a webhook secret to verify request authenticity</li>
                                        <li>Your endpoint should respond with 2xx status code within 10 seconds</li>
                                        <li>Failed webhooks will be retried up to 3 times with exponential backoff</li>
                                        <li>Use the test function to verify your endpoint is working correctly</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default NotificationSettings;