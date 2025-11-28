import React, { useState, useEffect, useCallback } from 'react';
import { useUpdateUrlMutation, useLazyCheckAliasAvailabilityQuery } from '../services/api';
import Modal from './common/Modal';
import Input from './common/Input';
import Button from './common/Button';
import { useToast } from '../contexts/ToastContext';
import type { URLMapping } from '../types/url.types';

interface URLEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: URLMapping;
}

const URLEditModal: React.FC<URLEditModalProps> = ({ isOpen, onClose, url }) => {
    const [longUrl, setLongUrl] = useState(url.long_url);
    const [customAlias, setCustomAlias] = useState(url.short_code);
    const [expiryDate, setExpiryDate] = useState<string>(
        url.expires_at ? new Date(url.expires_at).toISOString().split('T')[0] : ''
    );
    const [removeExpiry, setRemoveExpiry] = useState(false);
    const [aliasError, setAliasError] = useState<string>('');
    const [urlError, setUrlError] = useState<string>('');

    const [updateUrl, { isLoading: isUpdating }] = useUpdateUrlMutation();
    const [checkAlias, { isFetching: isCheckingAlias }] = useLazyCheckAliasAvailabilityQuery();
    const { showToast } = useToast();

    // Reset form when modal opens with new URL
    useEffect(() => {
        if (isOpen) {
            setLongUrl(url.long_url);
            setCustomAlias(url.short_code);
            setExpiryDate(url.expires_at ? new Date(url.expires_at).toISOString().split('T')[0] : '');
            setRemoveExpiry(false);
            setAliasError('');
            setUrlError('');
        }
    }, [isOpen, url]);

    // Validate URL format
    const validateUrl = (urlString: string): boolean => {
        try {
            const urlObj = new URL(urlString);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    // Check alias availability when it changes
    const handleAliasChange = useCallback(async (value: string) => {
        setCustomAlias(value);
        setAliasError('');

        if (!value || value === url.short_code) {
            return;
        }

        // Validate alias format
        const aliasPattern = /^[a-zA-Z0-9_-]{3,30}$/;
        if (!aliasPattern.test(value)) {
            setAliasError('Alias must be 3-30 characters (letters, numbers, hyphens, underscores)');
            return;
        }

        try {
            const result = await checkAlias(value).unwrap();
            if (!result.data.isAvailable) {
                setAliasError('This alias is already taken');
            }
        } catch (error) {
            console.error('Failed to check alias:', error);
        }
    }, [checkAlias, url.short_code]);

    // Handle URL change
    const handleUrlChange = (value: string) => {
        setLongUrl(value);
        setUrlError('');

        if (value && !validateUrl(value)) {
            setUrlError('Please enter a valid HTTP or HTTPS URL');
        }
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate inputs
        if (!longUrl.trim()) {
            setUrlError('Destination URL is required');
            return;
        }

        if (!validateUrl(longUrl)) {
            setUrlError('Please enter a valid HTTP or HTTPS URL');
            return;
        }

        if (!customAlias.trim()) {
            setAliasError('Short code is required');
            return;
        }

        if (aliasError) {
            return;
        }

        // Check if anything changed
        const hasChanges =
            longUrl !== url.long_url ||
            customAlias !== url.short_code ||
            (removeExpiry && url.expires_at) ||
            (!removeExpiry && expiryDate && expiryDate !== (url.expires_at ? new Date(url.expires_at).toISOString().split('T')[0] : ''));

        if (!hasChanges) {
            showToast({
                type: 'info',
                title: 'No Changes',
                message: 'No changes were made to the URL',
                duration: 2000
            });
            onClose();
            return;
        }

        try {
            const updateData: any = {
                shortCode: url.short_code
            };

            if (longUrl !== url.long_url) {
                updateData.longUrl = longUrl;
            }

            if (customAlias !== url.short_code) {
                updateData.customAlias = customAlias;
            }

            if (removeExpiry) {
                updateData.expiryDate = null;
            } else if (expiryDate) {
                updateData.expiryDate = new Date(expiryDate).toISOString();
            }

            await updateUrl(updateData).unwrap();

            showToast({
                type: 'success',
                title: 'URL Updated',
                message: 'Short URL updated successfully',
                duration: 3000
            });

            onClose();
        } catch (error: any) {
            console.error('Failed to update URL:', error);

            const errorMessage = error?.data?.message || 'Failed to update URL';
            const errorCode = error?.data?.error?.code;

            if (errorCode === 'ALIAS_TAKEN') {
                setAliasError('This alias is already taken');
            } else {
                showToast({
                    type: 'error',
                    title: 'Update Failed',
                    message: errorMessage,
                    duration: 4000
                });
            }
        }
    };

    const hasChanges =
        longUrl !== url.long_url ||
        customAlias !== url.short_code ||
        (removeExpiry && url.expires_at) ||
        (!removeExpiry && expiryDate && expiryDate !== (url.expires_at ? new Date(url.expires_at).toISOString().split('T')[0] : ''));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Short URL"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Destination URL */}
                <div>
                    <label htmlFor="longUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Destination URL
                    </label>
                    <Input
                        id="longUrl"
                        type="url"
                        value={longUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://example.com/your-long-url"
                        error={urlError}
                        disabled={isUpdating}
                        leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        }
                    />
                </div>

                {/* Custom Alias */}
                <div>
                    <label htmlFor="customAlias" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Short Code (Custom Alias)
                    </label>
                    <div className="relative">
                        <Input
                            id="customAlias"
                            type="text"
                            value={customAlias}
                            onChange={(e) => handleAliasChange(e.target.value)}
                            placeholder="my-custom-alias"
                            error={aliasError}
                            disabled={isUpdating || !url.is_custom_alias}
                            leftIcon={
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                            rightIcon={
                                isCheckingAlias ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                                ) : customAlias !== url.short_code && !aliasError && customAlias ? (
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : null
                            }
                        />
                    </div>
                    {!url.is_custom_alias && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Only custom aliases can be changed. Generated short codes cannot be modified.
                        </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {window.location.origin}/{customAlias}
                    </p>
                </div>

                {/* Expiry Date */}
                <div>
                    <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Expiry Date (Optional)
                    </label>
                    <Input
                        id="expiryDate"
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        disabled={isUpdating || removeExpiry}
                        leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        }
                    />
                    {url.expires_at && (
                        <div className="mt-2">
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={removeExpiry}
                                    onChange={(e) => setRemoveExpiry(e.target.checked)}
                                    disabled={isUpdating}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                Remove expiry date (make permanent)
                            </label>
                        </div>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex gap-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-blue-800 dark:text-blue-300">
                            <p className="font-medium mb-1">Important Notes:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>Changing the short code will update the URL immediately</li>
                                <li>The old short code will no longer work after the update</li>
                                <li>Cache will be cleared automatically for both old and new URLs</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        disabled={isUpdating}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        loading={isUpdating}
                        disabled={isUpdating || !!aliasError || !!urlError || !hasChanges}
                        className="w-full sm:w-auto"
                    >
                        {isUpdating ? 'Updating...' : 'Update URL'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default React.memo(URLEditModal);
