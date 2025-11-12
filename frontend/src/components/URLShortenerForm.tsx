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

    useEffect(() => {
        if (preferences && !isGuest) {
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

    const handleSubmit = async () => {
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

            const shortUrl = `${API_REDIRECT_BASE_URL}/${result.data.short_code}`;

            setUrlResult({
                shortUrl: shortUrl,
                originalUrl: result.data.long_url,
                customAlias: result.data.is_custom_alias ? result.data.short_code : undefined,
                expiryDate: result.data.expires_at,
                createdAt: result.data.created_at,
            });
            setIsModalOpen(true);

            setUrl('');
            setCustomAlias('');
            setExpiryDays('');
            setUseCustomAlias(false);
            setUseExpiry(false);
            setSuggestions([]);

            showToast({ type: 'success', title: 'URL Created', message: 'Short URL created successfully' });

            if (onSuccess) {
                onSuccess(result.data.short_code);
            }
        } catch (err: unknown) {
            const apiErr = err as { data?: { error?: string; message?: string; details?: { suggestions?: string[] } } };

            if (apiErr.data?.error === 'ALIAS_TAKEN') {
                setError(apiErr.data.message || 'Custom alias is already taken');
                if (apiErr.data.details?.suggestions) {
                    setSuggestions(apiErr.data.details.suggestions);
                }
            } else {
                setError(apiErr.data?.message || 'Failed to create short URL. Please try again.');
            }

            showToast({ type: 'error', title: 'Failed', message: apiErr.data?.message || 'Failed to create short URL' });
        }
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

    return (
        <>
            <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50 shadow-lg hover:shadow-xl transition-shadow duration-300 mb-8">
                <div className="p-5 sm:p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <svg className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Shorten URL</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Create a short link for your long URL</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* URL Input */}
                        <Input
                            label={<span className="flex items-center gap-1.5">Long URL <span className="text-red-500 dark:text-red-400">*</span></span>}
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

                        {/* Custom Alias Section */}
                        {canUseCustomAlias && (
                            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useCustomAlias}
                                        onChange={(e) => {
                                            setUseCustomAlias(e.target.checked);
                                            if (!e.target.checked) {
                                                setCustomAlias('');
                                                setSuggestions([]);
                                                setError(null);
                                            }
                                        }}
                                        className="w-4 h-4 rounded text-purple-600 focus:ring-2 focus:ring-purple-500"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Use custom alias</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">(optional)</span>
                                    </div>
                                </label>
                            </div>
                        )}

                        {!canUseCustomAlias && !isGuest && (
                            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-xl p-4 border border-yellow-200 dark:border-yellow-900/30">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <p className="text-sm text-yellow-900 dark:text-yellow-200">Custom aliases are available for logged in users</p>
                                </div>
                            </div>
                        )}

                        {useCustomAlias && canUseCustomAlias && (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Custom Alias</label>
                                <AliasAvailabilityChecker
                                    value={customAlias}
                                    onChange={setCustomAlias}
                                    onAvailabilityChange={setIsAliasAvailable}
                                    onSuggestionsChange={setSuggestions}
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        {/* Suggestions */}
                        {suggestions.length > 0 && (
                            <div className="space-y-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-900/30">
                                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm font-semibold">Available alternatives:</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setCustomAlias(s); setSuggestions([]); setError(null); }}
                                            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 rounded-lg hover:shadow-md transform hover:scale-105 transition-all border border-blue-300 dark:border-blue-700"
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Expiry Section */}
                        {canSetExpiry && (
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl p-4 border border-green-100 dark:border-green-900/30">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useExpiry}
                                        onChange={(e) => { setUseExpiry(e.target.checked); if (!e.target.checked) setExpiryDays(''); }}
                                        className="w-4 h-4 rounded text-green-600 focus:ring-2 focus:ring-green-500"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Set expiration date</span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">(optional)</span>
                                    </div>
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
                                leftIcon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                helperText="Link will expire after specified days (1-3650)"
                            />
                        )}

                        {/* Error */}
                        {error && (
                            <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/10 dark:to-rose-900/10 rounded-xl p-4 border border-red-200 dark:border-red-900/30">
                                <div className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="text-sm text-red-900 dark:text-red-300 font-medium">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Button type="button" variant="secondary" onClick={handleReset} disabled={isLoading}>Reset</Button>
                            <Button type="button" variant="primary" loading={isLoading} onClick={handleSubmit} disabled={isLoading || (useCustomAlias && !isAliasAvailable)}>
                                {isLoading ? 'Creating...' : 'Shorten URL'}
                            </Button>
                        </div>
                    </div>

                    {/* Guest Info */}
                    {isGuest && (
                        <div className="mt-6 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/10 dark:via-yellow-900/10 dark:to-orange-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-900/30">
                            <div className="flex items-start gap-3">
                                <svg className="w-6 h-6 text-amber-600 dark:text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Guest Mode Limitations</p>
                                    <p className="text-sm text-amber-800 dark:text-amber-300">Sign up to unlock custom aliases, expiration dates, analytics, and more!</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="xl">
            </Modal> */}
            {urlResult &&
                <URLResult
                    result={urlResult}
                    onShowToast={(m, t) => showToast({ type: t, title: t === 'success' ? 'Success' : 'Error', message: m })}
                    modalProps={{
                        isOpen: isModalOpen,
                        onClose: () => setIsModalOpen(false),
                        closeOnEscape: true,
                        closeOnOverlayClick: true
                    }}
                />
            }
        </>
    );
};

export default URLShortenerForm;