import React, { useState } from 'react';
import { Card, Button, Input, FormField, Toggle, Select } from '../common';
import { useToast } from '../../contexts/ToastContext';

interface URLPreferences {
    duplicateStrategy: 'generate_new' | 'reuse_existing';
    defaultExpiry: number | null; // null for permanent, number for days
    customDomain?: string;
    enableAnalytics: boolean;
    enableQRCode: boolean;
    enablePasswordProtection: boolean;
}

const URLPreferencesComponent: React.FC = () => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Mock preferences data - in real app, this would come from API
    const [preferences, setPreferences] = useState<URLPreferences>({
        duplicateStrategy: 'generate_new',
        defaultExpiry: null,
        customDomain: '',
        enableAnalytics: true,
        enableQRCode: true,
        enablePasswordProtection: false
    });

    const expiryOptions = [
        { value: null, label: 'Never expire' },
        { value: 1, label: '1 day' },
        { value: 7, label: '1 week' },
        { value: 30, label: '1 month' },
        { value: 90, label: '3 months' },
        { value: 365, label: '1 year' }
    ];

    const handlePreferenceChange = <K extends keyof URLPreferences>(
        key: K,
        value: URLPreferences[K]
    ) => {
        setPreferences(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    };

    const handleSavePreferences = async () => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            showToast({ message: 'Preferences saved successfully', type: 'success' });
            setHasChanges(false);
        } catch (error) {
            showToast({ message: 'Failed to save preferences', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPreferences = () => {
        setPreferences({
            duplicateStrategy: 'generate_new',
            defaultExpiry: null,
            customDomain: '',
            enableAnalytics: true,
            enableQRCode: true,
            enablePasswordProtection: false
        });
        setHasChanges(true);
    };

    const validateCustomDomain = (domain: string): boolean => {
        if (!domain) return true; // Empty is valid
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
        return domainRegex.test(domain);
    };

    return (
        <div className="space-y-6">
            {/* Duplicate URL Handling */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Duplicate URL Handling</h2>
                    <p className="text-gray-600 mb-6">
                        Choose how to handle when the same URL is shortened multiple times.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-start space-x-3">
                            <input
                                type="radio"
                                id="generate_new"
                                name="duplicateStrategy"
                                value="generate_new"
                                checked={preferences.duplicateStrategy === 'generate_new'}
                                onChange={(e) => handlePreferenceChange('duplicateStrategy', e.target.value as 'generate_new')}
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div className="flex-1">
                                <label htmlFor="generate_new" className="block text-sm font-medium text-gray-900">
                                    Always generate new short URLs
                                </label>
                                <p className="text-sm text-gray-500 mt-1">
                                    Each time you shorten a URL, a new short URL will be created. This allows for separate analytics tracking per campaign.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <input
                                type="radio"
                                id="reuse_existing"
                                name="duplicateStrategy"
                                value="reuse_existing"
                                checked={preferences.duplicateStrategy === 'reuse_existing'}
                                onChange={(e) => handlePreferenceChange('duplicateStrategy', e.target.value as 'reuse_existing')}
                                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div className="flex-1">
                                <label htmlFor="reuse_existing" className="block text-sm font-medium text-gray-900">
                                    Reuse existing short URLs
                                </label>
                                <p className="text-sm text-gray-500 mt-1">
                                    If a URL has been shortened before, return the existing short URL. This saves storage and provides consistent links.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Default Expiry Settings */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Default Expiry Settings</h2>
                    <p className="text-gray-600 mb-6">
                        Set the default expiration time for new short URLs.
                    </p>

                    <div className="max-w-md">
                        <FormField label="Default Expiry Time">
                            <Select
                                value={preferences.defaultExpiry?.toString() || 'null'}
                                onChange={(value) => {
                                    const parsedValue = value === 'null' ? null : parseInt(value);
                                    handlePreferenceChange('defaultExpiry', parsedValue);
                                }}
                                options={expiryOptions.map(option => ({
                                    value: option.value?.toString() || 'null',
                                    label: option.label
                                }))}
                            />
                        </FormField>
                    </div>

                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    You can always override the default expiry when creating individual short URLs.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Custom Domain Settings */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Custom Domain</h2>
                    <p className="text-gray-600 mb-6">
                        Use your own domain for short URLs (e.g., go.yourcompany.com/abc123).
                    </p>

                    <div className="max-w-md">
                        <FormField
                            label="Custom Domain"
                            helperText="Enter your custom domain without protocol (e.g., go.yourcompany.com)"
                            error={preferences.customDomain && !validateCustomDomain(preferences.customDomain) ? 'Invalid domain format' : undefined}
                        >
                            <Input
                                type="text"
                                value={preferences.customDomain || ''}
                                onChange={(e) => handlePreferenceChange('customDomain', e.target.value)}
                                placeholder="go.yourcompany.com"
                            />
                        </FormField>
                    </div>

                    <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-yellow-700">
                                    <strong>Note:</strong> Custom domains require DNS configuration and SSL certificate setup.
                                    Contact support for assistance with domain verification.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Feature Preferences */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Feature Preferences</h2>
                    <p className="text-gray-600 mb-6">
                        Configure default features for your short URLs.
                    </p>

                    <div className="space-y-6">
                        <Toggle
                            checked={preferences.enableAnalytics}
                            onChange={(checked) => handlePreferenceChange('enableAnalytics', checked)}
                            label="Enable Analytics by Default"
                            description="Automatically track clicks, geographic data, and referrer information for new short URLs."
                        />

                        <Toggle
                            checked={preferences.enableQRCode}
                            onChange={(checked) => handlePreferenceChange('enableQRCode', checked)}
                            label="Generate QR Codes"
                            description="Automatically generate QR codes for new short URLs for easy mobile sharing."
                        />

                        <Toggle
                            checked={preferences.enablePasswordProtection}
                            onChange={(checked) => handlePreferenceChange('enablePasswordProtection', checked)}
                            label="Password Protection Available"
                            description="Show password protection option when creating new short URLs."
                        />
                    </div>
                </div>
            </Card>

            {/* Save Actions */}
            <Card>
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Save Changes</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                {hasChanges ? 'You have unsaved changes.' : 'All changes are saved.'}
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <Button
                                variant="secondary"
                                onClick={handleResetPreferences}
                                disabled={isLoading}
                            >
                                Reset to Defaults
                            </Button>
                            <Button
                                onClick={handleSavePreferences}
                                loading={isLoading}
                                disabled={!hasChanges}
                            >
                                Save Preferences
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default URLPreferencesComponent;