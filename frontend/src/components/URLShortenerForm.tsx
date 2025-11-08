import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { useCreateShortUrlMutation } from '../services/api';
import AliasAvailabilityChecker from './AliasAvailabilityChecker';
import Input from './common/Input';
import Button from './common/Button';
import Card from './common/Card';
import Modal from './common/Modal';
import URLResult, { type URLResultData } from './URLResult';
import { useToast } from '../contexts/ToastContext';
import { API_REDIRECT_BASE_URL } from '../utils/constant';

interface URLShortenerFormProps {
    onSuccess?: (shortUrl: string) => void;
}

const URLShortenerForm: React.FC<URLShortenerFormProps> = ({ onSuccess }) => {
    const { permissions, isGuest } = useSelector((state: RootState) => state.auth);
    const { preferences } = useSelector((state: RootState) => state.user);
    const [createShortUrl, { isLoading }] = useCreateShortUrlMutation();
    const { showToast } = useToast();

    const [url, setUrl] = useState('');
    const [customAlias, setCustomAlias] = useState('');
    const [expiryDays, setExpiryDays] = useState<string>('');
    const [useCustomAlias, setUseCustomAlias] = useState(false);
    const [useExpiry, setUseExpiry] = useState(false);
    const [isAliasAvailable, setIsAliasAvailable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [urlResult, setUrlResult] = useState<URLResultData | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const canUseCustomAlias = permissions?.canCreateCustomAlias && !isGuest;
    const canSetExpiry = permissions?.canSetCustomExpiry && !isGuest;

    // Apply user preferences on component mount
    useEffect(() => {
        if (preferences && !isGuest) {
            // Set default expiry from user preferences
            if (preferences.defaultExpiry && canSetExpiry) {
                setExpiryDays(preferences.defaultExpiry.toString());
                setUseExpiry(true);
            }
        }
    }, [preferences, isGuest, canSetExpiry]);

    const validateUrl = useCallback((urlString: string): boolean => {
        try {
            const urlObj = new URL(urlString);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }, []);

    const handleAliasAvailabilityChange = useCallback((available: boolean) => {
        setIsAliasAvailable(available);
    }, []);

    const handleSuggestionsChange = useCallback((newSuggestions: string[]) => {
        setSuggestions(newSuggestions);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

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
            setError('The custom alias is not available. Please choose another one or select from suggestions.');
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

            const shortUrl = `${API_REDIRECT_BASE_URL}/${result.data.short_code}`;

            // Set URL result data and open modal
            setUrlResult({
                shortUrl: shortUrl,
                originalUrl: result.data.long_url,
                customAlias: result.data.is_custom_alias ? result.data.short_code : undefined,
                expiryDate: result.data.expires_at,
                createdAt: result.data.created_at,
            });
            setIsModalOpen(true);

            // Clear form
            setUrl('');
            setCustomAlias('');
            setExpiryDays('');
            setUseCustomAlias(false);
            setUseExpiry(false);
            setSuggestions([]);

            showToast({
                type: 'success',
                title: 'URL Created',
                message: 'Short URL has been successfully created',
            });

            if (onSuccess) {
                onSuccess(result.data.short_code);
            }
        } catch (err: unknown) {
            const apiErr = (err as {
                data?: {
                    error?: string;
                    message?: string;
                    details?: { suggestions?: string[] };
                };
            }) ?? {};

            if (apiErr.data?.error === 'ALIAS_TAKEN') {
                setError(apiErr.data.message || 'Custom alias is already taken');
                if (apiErr.data.details?.suggestions) {
                    setSuggestions(apiErr.data.details.suggestions);
                }
            } else {
                setError(apiErr.data?.message || 'Failed to create short URL. Please try again.');
            }

            showToast({
                type: 'error',
                title: 'URL Creation Failed',
                message: apiErr.data?.message || 'Failed to create short URL',
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
        setSuggestions([]);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    const handleShowToast = (message: string, type: 'success' | 'error') => {
        showToast({
            type,
            title: type === 'success' ? 'Success' : 'Error',
            message,
        });
    };

    return (
        <>
            <Card padding="md" className="dark:bg-gray-800 dark:border-gray-700 animate-fade-in mb-8">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                        <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Shorten URL
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Create a short link for your long URL
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label={<>Long URL <span className="text-red-500 dark:text-red-400">*</span></>}
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

                    {canUseCustomAlias && (
                        <div className="flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                            <input
                                type="checkbox"
                                id="useCustomAlias"
                                checked={useCustomAlias}
                                onChange={(e) => {
                                    setUseCustomAlias(e.target.checked);
                                    if (!e.target.checked) {
                                        setCustomAlias('');
                                        setSuggestions([]);
                                        setError(null);
                                    }
                                }}
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <label htmlFor="useCustomAlias" className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300">
                                Use custom alias (optional)
                            </label>
                        </div>
                    )}

                    {!canUseCustomAlias && !isGuest && (
                        <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                Custom aliases are available for logged in users
                            </p>
                        </div>
                    )}

                    {useCustomAlias && canUseCustomAlias && (
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                                Custom Alias
                            </label>
                            <AliasAvailabilityChecker
                                value={customAlias}
                                onChange={setCustomAlias}
                                onAvailabilityChange={handleAliasAvailabilityChange}
                                onSuggestionsChange={handleSuggestionsChange}
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg animate-fade-in">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-300 flex items-center">
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
                                        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all transform hover:scale-105 border border-blue-300 dark:border-blue-700"
                                        disabled={isLoading}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {canSetExpiry && (
                        <div className="flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
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
                                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <label htmlFor="useExpiry" className="text-sm font-medium cursor-pointer text-gray-700 dark:text-gray-300">
                                Set expiration date (optional)
                            </label>
                        </div>
                    )}

                    {useExpiry && canSetExpiry && (
                        <Input
                            label="Expires in (days)"
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
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg animate-fade-in">
                            <div className="flex">
                                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                            </div>
                        </div>
                    )}

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

                {isGuest && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-start">
                            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                                    Guest Mode Limitations
                                </p>
                                <p className="text-xs text-yellow-800 dark:text-yellow-300 mt-1">
                                    Sign up to unlock custom aliases, expiration dates, analytics, and more!
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* Display URL Result in Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title="URL Shortened Successfully!"
                size="xl"
                closeOnOverlayClick={true}
                closeOnEscape={true}
            >
                {urlResult && (
                    <URLResult result={urlResult} onShowToast={handleShowToast} />
                )}
            </Modal>
        </>
    );
};

export default URLShortenerForm;