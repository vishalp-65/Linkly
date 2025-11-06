import React, { useState } from 'react';
import { useCreateShortUrlMutation } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import Button from './common/Button';
import Input from './common/Input';

const URLShortenerForm: React.FC = () => {
    const [url, setUrl] = useState('');
    const [customAlias, setCustomAlias] = useState('');
    const [expiryDays, setExpiryDays] = useState<number | undefined>();
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [createShortUrl, { isLoading }] = useCreateShortUrlMutation();
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url.trim()) {
            showToast({
                type: 'error',
                title: 'Invalid URL',
                message: 'Please enter a valid URL',
                duration: 3000
            });
            return;
        }

        try {
            await createShortUrl({
                originalUrl: url.trim(),
                customAlias: customAlias.trim() || undefined,
                expiryDays: expiryDays || undefined
            }).unwrap();

            showToast({
                type: 'success',
                title: 'URL Shortened!',
                message: 'Your short URL has been created successfully',
                duration: 4000
            });

            // Reset form
            setUrl('');
            setCustomAlias('');
            setExpiryDays(undefined);
            setShowAdvanced(false);

        } catch (error: any) {
            showToast({
                type: 'error',
                title: 'Failed to create URL',
                message: error?.data?.message || 'Something went wrong. Please try again.',
                duration: 4000
            });
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 mb-8 animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Create Short URL
                </h2>
                <p className="text-sm text-gray-600 mt-1">Transform your long URLs into short, shareable links</p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-4">
                    {/* Main URL Input */}
                    <div>
                        <Input
                            type="url"
                            placeholder="Enter your long URL here..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            leftIcon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            }
                        />
                    </div>

                    {/* Advanced Options Toggle */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
                        >
                            <svg
                                className={`w-4 h-4 mr-1 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            Advanced Options
                        </button>

                        <Button
                            type="submit"
                            loading={isLoading}
                            disabled={!url.trim()}
                            className="px-6"
                        >
                            Shorten URL
                        </Button>
                    </div>

                    {/* Advanced Options */}
                    {showAdvanced && (
                        <div className="space-y-4 pt-4 border-t border-gray-200 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    placeholder="Custom alias (optional)"
                                    value={customAlias}
                                    onChange={(e) => setCustomAlias(e.target.value)}
                                    helperText="Create a custom short code"
                                    leftIcon={
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    }
                                />

                                <div>
                                    <select
                                        value={expiryDays || ''}
                                        onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    >
                                        <option value="">Never expires</option>
                                        <option value="1">1 day</option>
                                        <option value="7">1 week</option>
                                        <option value="30">1 month</option>
                                        <option value="90">3 months</option>
                                        <option value="365">1 year</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Set expiration time</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export default URLShortenerForm;