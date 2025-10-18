import React, { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useCreateShortUrlMutation } from '../services/api';
import AliasAvailabilityChecker from './AliasAvailabilityChecker';
import Input from './common/Input';
import Button from './common/Button';
import { useToast } from '../contexts/ToastContext';

interface URLShortenerFormProps {
    onSuccess?: (shortUrl: string) => void;
}

const URLShortenerForm: React.FC<URLShortenerFormProps> = ({ onSuccess }) => {
    const { permissions, isGuest } = useSelector((state: RootState) => state.auth);
    const [createShortUrl, { isLoading }] = useCreateShortUrlMutation();

    const [url, setUrl] = useState('');
    const [customAlias, setCustomAlias] = useState('');
    const [expiryDays, setExpiryDays] = useState<string>('');
    const [useCustomAlias, setUseCustomAlias] = useState(false);
    const [useExpiry, setUseExpiry] = useState(false);
    const [isAliasAvailable, setIsAliasAvailable] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const { showToast } = useToast();

    const canUseCustomAlias = permissions?.canCreateCustomAlias && !isGuest;
    const canSetExpiry = permissions?.canSetCustomExpiry && !isGuest;

    console.log({ permissions, isGuest })

    const validateUrl = useCallback((urlString: string): boolean => {
        try {
            const urlObj = new URL(urlString);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setSuggestions([]);

        // Validation
        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        if (!validateUrl(url)) {
            setError('Please enter a valid HTTP or HTTPS URL');
            return;
        }

        if (useCustomAlias && !customAlias.trim()) {
            setError('Please enter a custom alias or disable custom alias option');
            return;
        }

        if (useCustomAlias && !isAliasAvailable) {
            setError('The custom alias is not available. Please choose another one.');
            return;
        }

        if (useExpiry && expiryDays && (parseInt(expiryDays) < 1 || parseInt(expiryDays) > 3650)) {
            setError('Expiry days must be between 1 and 3650');
            return;
        }

        try {
            const result = await createShortUrl({
                url: url.trim(),
                ...(useCustomAlias && customAlias && { customAlias: customAlias.trim() }),
                ...(useExpiry && expiryDays && { expiryDays: parseInt(expiryDays) }),
            }).unwrap();

            // Success
            setSuccess(`Short URL created: ${result.data.short_code}`);
            setUrl('');
            setCustomAlias('');
            setExpiryDays('');
            setUseCustomAlias(false);
            setUseExpiry(false);

            if (onSuccess) {
                onSuccess(result.data.short_code);
                showToast({
                    type: 'success',
                    title: 'URL Deleted',
                    message: 'Short URL has been successfully deleted'
                });
            }
        } catch (err: any) {
            // Handle alias taken error with suggestions
            if (err?.data?.error === 'ALIAS_TAKEN') {
                setError(err.data.message || 'Custom alias is already taken');
                if (err.data.details?.suggestions) {
                    setSuggestions(err.data.details.suggestions);
                }
            } else {
                setError(err?.data?.message || 'Failed to create short URL. Please try again.');
            }
            showToast({
                type: 'error',
                title: 'URL creation Failed',
                message: 'Failed to create shortn URL'
            });
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setCustomAlias(suggestion);
        setSuggestions([]);
        setError(null);
    };

    const handleReset = () => {
        setUrl('');
        setCustomAlias('');
        setExpiryDays('');
        setUseCustomAlias(false);
        setUseExpiry(false);
        setError(null);
        setSuccess(null);
        setSuggestions([]);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8 animate-fade-in">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Shorten URL
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                    Create a short link for your long URL
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* URL Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Long URL *
                    </label>
                    <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/very-long-url"
                        required
                        leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        }
                    />
                </div>

                {/* Custom Alias Toggle */}
                {canUseCustomAlias && (
                    <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                        <input
                            type="checkbox"
                            id="useCustomAlias"
                            checked={useCustomAlias}
                            onChange={(e) => {
                                setUseCustomAlias(e.target.checked);
                                if (!e.target.checked) {
                                    setCustomAlias('');
                                    setSuggestions([]);
                                }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="useCustomAlias" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Use custom alias (optional)
                        </label>
                    </div>
                )}

                {!canUseCustomAlias && !isGuest && (
                    <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-yellow-800">
                            Custom aliases are available for logged in users
                        </p>
                    </div>
                )}

                {/* Custom Alias Input */}
                {useCustomAlias && canUseCustomAlias && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custom Alias
                        </label>
                        <AliasAvailabilityChecker
                            value={customAlias}
                            onChange={setCustomAlias}
                            onAvailabilityChange={setIsAliasAvailable}
                            disabled={isLoading}
                        />
                    </div>
                )}

                {/* Suggestions from API error */}
                {suggestions.length > 0 && (
                    <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
                        <p className="text-sm font-medium text-blue-900 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Available alternatives:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="px-3 py-1.5 text-sm bg-white text-blue-700 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all transform hover:scale-105 border border-blue-300"
                                    disabled={isLoading}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Expiry Toggle */}
                {canSetExpiry && (
                    <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                        <input
                            type="checkbox"
                            id="useExpiry"
                            checked={useExpiry}
                            onChange={(e) => {
                                setUseExpiry(e.target.checked);
                                if (!e.target.checked) {
                                    setExpiryDays('');
                                }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="useExpiry" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Set expiration date (optional)
                        </label>
                    </div>
                )}

                {/* Expiry Input */}
                {useExpiry && canSetExpiry && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Expires in (days)
                        </label>
                        <Input
                            type="number"
                            value={expiryDays}
                            onChange={(e) => setExpiryDays(e.target.value)}
                            placeholder="7"
                            min="1"
                            max="3650"
                            leftIcon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                            helperText="Link will expire after specified days (1-3650)"
                        />
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
                        <div className="flex">
                            <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {success && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
                        <div className="flex">
                            <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm text-green-800">{success}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={handleReset}
                        disabled={isLoading}
                    >
                        Reset
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={isLoading}
                        disabled={isLoading || (useCustomAlias && !isAliasAvailable)}
                    >
                        {isLoading ? 'Creating...' : 'Shorten URL'}
                    </Button>
                </div>
            </form>

            {/* Guest Mode Info */}
            {isGuest && (
                <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-yellow-900">Guest Mode Limitations</p>
                            <p className="text-xs text-yellow-800 mt-1">
                                Sign up to unlock custom aliases, expiration dates, analytics, and more!
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default URLShortenerForm;