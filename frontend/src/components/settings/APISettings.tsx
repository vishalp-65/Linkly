import React, { useState } from 'react';
import { Card, Button, Input, FormField, Modal } from '../common';
import { useToast } from '../../contexts/ToastContext';

interface APIKey {
    id: string;
    name: string;
    key: string;
    createdAt: string;
    lastUsed?: string;
    isActive: boolean;
}

interface RateLimitTier {
    name: string;
    requestsPerMinute: number;
    requestsPerDay: number;
    features: string[];
}

interface APIUsageStats {
    currentPeriodRequests: number;
    dailyLimit: number;
    monthlyRequests: number;
    totalRequests: number;
    lastRequestAt?: string;
}

const APISettings: React.FC = () => {
    const { showToast } = useToast();
    const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
    const [isCreateKeyModalOpen, setIsCreateKeyModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');

    // Mock data - in real app, this would come from API
    const [apiKeys, setApiKeys] = useState<APIKey[]>([
        {
            id: '1',
            name: 'Production API Key',
            key: 'sk_live_1234567890abcdef1234567890abcdef',
            createdAt: '2024-01-15T10:30:00Z',
            lastUsed: '2024-11-02T14:22:00Z',
            isActive: true
        },
        {
            id: '2',
            name: 'Development API Key',
            key: 'sk_test_abcdef1234567890abcdef1234567890',
            createdAt: '2024-02-01T09:15:00Z',
            lastUsed: '2024-10-28T11:45:00Z',
            isActive: true
        }
    ]);

    const rateLimitTier: RateLimitTier = {
        name: 'Professional',
        requestsPerMinute: 1000,
        requestsPerDay: 100000,
        features: [
            'Custom aliases',
            'Analytics API',
            'Bulk operations',
            'Webhook notifications',
            'Priority support'
        ]
    };

    const usageStats: APIUsageStats = {
        currentPeriodRequests: 15847,
        dailyLimit: 100000,
        monthlyRequests: 456789,
        totalRequests: 2847563,
        lastRequestAt: '2024-11-02T14:22:00Z'
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const maskApiKey = (key: string) => {
        if (key.length <= 8) return key;
        return key.substring(0, 8) + '...' + key.substring(key.length - 4);
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast({ message: `${label} copied to clipboard`, type: 'success' });
        } catch (error) {
            showToast({ message: `Failed to copy ${label}`, type: 'error' });
        }
    };

    const handleRegenerateKey = async (keyId: string) => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            // Update the key in the list
            setApiKeys(prev => prev.map(key =>
                key.id === keyId
                    ? { ...key, key: 'sk_live_' + Math.random().toString(36).substring(2, 34), createdAt: new Date().toISOString() }
                    : key
            ));

            showToast({ message: 'API key regenerated successfully', type: 'success' });
            setIsRegenerateModalOpen(false);
        } catch (error) {
            showToast({ message: 'Failed to regenerate API key', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName.trim()) {
            showToast({ message: 'Please enter a name for the API key', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            const newKey: APIKey = {
                id: Date.now().toString(),
                name: newKeyName,
                key: 'sk_live_' + Math.random().toString(36).substring(2, 34),
                createdAt: new Date().toISOString(),
                isActive: true
            };

            setApiKeys(prev => [...prev, newKey]);
            showToast({ message: 'API key created successfully', type: 'success' });
            setIsCreateKeyModalOpen(false);
            setNewKeyName('');
        } catch (error) {
            showToast({ message: 'Failed to create API key', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRevokeKey = async (keyId: string) => {
        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call

            setApiKeys(prev => prev.map(key =>
                key.id === keyId
                    ? { ...key, isActive: false }
                    : key
            ));

            showToast({ message: 'API key revoked successfully', type: 'success' });
        } catch (error) {
            showToast({ message: 'Failed to revoke API key', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const usagePercentage = (usageStats.currentPeriodRequests / usageStats.dailyLimit) * 100;

    return (
        <div className="space-y-6">
            {/* Rate Limit Information */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Rate Limit Tier</h2>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-blue-900">{rateLimitTier.name} Plan</h3>
                                <p className="text-blue-700">Your current API tier</p>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-blue-900">
                                    {rateLimitTier.requestsPerMinute.toLocaleString()}
                                </div>
                                <div className="text-sm text-blue-700">requests/minute</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-white rounded-lg p-4 border border-blue-100">
                                <div className="text-sm text-gray-600">Daily Limit</div>
                                <div className="text-xl font-semibold text-gray-900">
                                    {rateLimitTier.requestsPerDay.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white rounded-lg p-4 border border-blue-100">
                                <div className="text-sm text-gray-600">Features Included</div>
                                <div className="text-xl font-semibold text-gray-900">
                                    {rateLimitTier.features.length} features
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-medium text-blue-900">Included Features:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {rateLimitTier.features.map((feature, index) => (
                                    <div key={index} className="flex items-center text-sm text-blue-800">
                                        <svg className="h-4 w-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        {feature}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* API Usage Statistics */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">API Usage Statistics</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-3xl font-bold text-blue-600">
                                {usageStats.currentPeriodRequests.toLocaleString()}
                            </div>
                            <div className="text-sm text-blue-800 mt-1">Requests Today</div>
                        </div>

                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-3xl font-bold text-green-600">
                                {usageStats.monthlyRequests.toLocaleString()}
                            </div>
                            <div className="text-sm text-green-800 mt-1">Requests This Month</div>
                        </div>

                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-3xl font-bold text-purple-600">
                                {usageStats.totalRequests.toLocaleString()}
                            </div>
                            <div className="text-sm text-purple-800 mt-1">Total Requests</div>
                        </div>
                    </div>

                    {/* Usage Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Daily Usage</span>
                            <span>{usagePercentage.toFixed(1)}% of limit</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className={`h-2 rounded-full transition-all duration-300 ${usagePercentage > 90 ? 'bg-red-500' :
                                    usagePercentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0</span>
                            <span>{usageStats.dailyLimit.toLocaleString()} requests</span>
                        </div>
                    </div>

                    {usageStats.lastRequestAt && (
                        <p className="text-sm text-gray-600">
                            Last API request: {formatDate(usageStats.lastRequestAt)}
                        </p>
                    )}
                </div>
            </Card>

            {/* API Keys Management */}
            <Card>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
                            <p className="text-gray-600 mt-1">
                                Manage your API keys for accessing the URL shortener API
                            </p>
                        </div>
                        <Button onClick={() => setIsCreateKeyModalOpen(true)}>
                            Create New Key
                        </Button>
                    </div>

                    <div className="space-y-4">
                        {apiKeys.map((apiKey) => (
                            <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            <h3 className="font-medium text-gray-900">{apiKey.name}</h3>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${apiKey.isActive
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                                }`}>
                                                {apiKey.isActive ? 'Active' : 'Revoked'}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                                            <span>Created: {formatDate(apiKey.createdAt)}</span>
                                            {apiKey.lastUsed && (
                                                <span>Last used: {formatDate(apiKey.lastUsed)}</span>
                                            )}
                                        </div>

                                        <div className="mt-3 flex items-center space-x-2">
                                            <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                                                {maskApiKey(apiKey.key)}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => copyToClipboard(apiKey.key, 'API key')}
                                            >
                                                Copy
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flex space-x-2 ml-4">
                                        {apiKey.isActive && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => setIsRegenerateModalOpen(true)}
                                                >
                                                    Regenerate
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() => handleRevokeKey(apiKey.id)}
                                                    loading={isLoading}
                                                >
                                                    Revoke
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    Keep your API keys secure
                                </h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>Never share your API keys in public repositories</li>
                                        <li>Use environment variables to store keys in your applications</li>
                                        <li>Regenerate keys if you suspect they have been compromised</li>
                                        <li>Revoke unused keys to maintain security</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Create API Key Modal */}
            <Modal
                isOpen={isCreateKeyModalOpen}
                onClose={() => setIsCreateKeyModalOpen(false)}
                title="Create New API Key"
                size="md"
            >
                <div className="space-y-4">
                    <FormField label="API Key Name" required>
                        <Input
                            type="text"
                            value={newKeyName}
                            onChange={(e) => setNewKeyName(e.target.value)}
                            placeholder="e.g., Production API Key"
                            required
                        />
                    </FormField>

                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-blue-700">
                                    The API key will be generated with the same permissions as your current tier.
                                    Make sure to copy it immediately after creation as it won't be shown again.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsCreateKeyModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateKey}
                            loading={isLoading}
                        >
                            Create API Key
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Regenerate API Key Modal */}
            <Modal
                isOpen={isRegenerateModalOpen}
                onClose={() => setIsRegenerateModalOpen(false)}
                title="Regenerate API Key"
                size="md"
            >
                <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-yellow-800">
                                    This action cannot be undone
                                </h3>
                                <div className="mt-2 text-sm text-yellow-700">
                                    <p>
                                        Regenerating this API key will immediately invalidate the current key.
                                        Any applications using the current key will stop working until updated with the new key.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsRegenerateModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={() => handleRegenerateKey('1')}
                            loading={isLoading}
                        >
                            Regenerate Key
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default APISettings;