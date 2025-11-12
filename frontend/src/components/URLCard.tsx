import React, { useState, useMemo, useCallback } from 'react';
import { useDeleteUrlMutation } from '../services/api';
import Button from './common/Button';
import Card from './common/Card';
import Modal from './common/Modal';
import type { URLMapping } from '../types/url.types';
import { useToast } from '../contexts/ToastContext';

interface URLCardProps {
    url: URLMapping;
    onAnalyticsClick?: (url: URLMapping) => void;
    onEditClick?: (url: URLMapping) => void;
    onShareClick?: (url: URLMapping) => void;
    isSelected?: boolean;
    onSelect?: (shortCode: string, selected: boolean) => void;
    showCheckbox?: boolean;
}

type BadgeVariant = 'purple' | 'red' | 'yellow' | 'green';

interface BadgeProps {
    variant: BadgeVariant;
    icon?: React.ReactNode;
    children: React.ReactNode;
}

interface ActionButtonProps {
    onClick: () => void;
    title: string;
    icon: React.ReactNode;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}

// Constants
const COPY_TIMEOUT = 2000;
const TOAST_DURATIONS = {
    COPY_SUCCESS: 2000,
    COPY_ERROR: 3000,
    DELETE_SUCCESS: 3000,
    DELETE_ERROR: 4000,
} as const;

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
};

// Icon Components
const CopyIcon = React.memo<{ copied?: boolean }>(({ copied }) =>
    copied ? (
        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ) : (
        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    )
);
CopyIcon.displayName = 'CopyIcon';

// Badge Component
const Badge = React.memo<BadgeProps>(({ variant, icon, children }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${BADGE_VARIANTS[variant]}`}>
        {icon}
        {children}
    </span>
));
Badge.displayName = 'Badge';

// Action Button Component
const ActionButton = React.memo<ActionButtonProps>(({ onClick, title, icon, variant = 'default', disabled = false }) => {
    const variantClasses = variant === 'danger'
        ? 'text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20';

    return (
        <button
            onClick={onClick}
            className={`group p-2 rounded-lg transition-all duration-200 cursor-pointer ${variantClasses} active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            title={title}
            aria-label={title}
            disabled={disabled}
        >
            {icon}
        </button>
    );
});
ActionButton.displayName = 'ActionButton';

// Utility function to calculate expiry info
const calculateExpiryInfo = (expiresAt: string | null | undefined) => {
    if (!expiresAt) {
        return { isExpired: false, daysUntilExpiry: null };
    }

    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const isExpired = expiryDate < now;
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return { isExpired, daysUntilExpiry };
};

// Main URLCard Component
const URLCard: React.FC<URLCardProps> = ({
    url,
    onAnalyticsClick,
    onShareClick,
    isSelected = false,
    onSelect,
    showCheckbox = false
}) => {
    const [copied, setCopied] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteUrl, { isLoading: isDeleting }] = useDeleteUrlMutation();
    const { showToast } = useToast();

    // Memoized values
    const shortUrl = useMemo(
        () => `${window.location.origin}/${url.short_code}`,
        [url.short_code]
    );

    const { isExpired, daysUntilExpiry } = useMemo(
        () => calculateExpiryInfo(url.expires_at),
        [url.expires_at]
    );

    const formattedCreatedDate = useMemo(
        () => new Date(url.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }),
        [url.created_at]
    );

    // Event handlers
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(shortUrl);
            setCopied(true);
            showToast({
                type: 'success',
                title: 'Copied!',
                message: 'Short URL copied to clipboard',
                duration: TOAST_DURATIONS.COPY_SUCCESS
            });
            setTimeout(() => setCopied(false), COPY_TIMEOUT);
        } catch (error) {
            console.error('Failed to copy:', error);
            showToast({
                type: 'error',
                title: 'Copy Failed',
                message: 'Failed to copy URL',
                duration: TOAST_DURATIONS.COPY_ERROR
            });
        }
    }, [shortUrl, showToast]);

    const handleDelete = useCallback(async () => {
        try {
            await deleteUrl(url.short_code).unwrap();
            setShowDeleteConfirm(false);
            showToast({
                type: 'success',
                title: 'URL Deleted',
                message: 'Short URL deleted successfully',
                duration: TOAST_DURATIONS.DELETE_SUCCESS
            });
        } catch (error) {
            console.error('Failed to delete:', error);
            showToast({
                type: 'error',
                title: 'Delete Failed',
                message: 'Failed to delete URL',
                duration: TOAST_DURATIONS.DELETE_ERROR
            });
        }
    }, [deleteUrl, url.short_code, showToast]);

    const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect?.(url.short_code, e.target.checked);
    }, [onSelect, url.short_code]);

    const handleOpenDeleteModal = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    const handleCloseDeleteModal = useCallback(() => {
        setShowDeleteConfirm(false);
    }, []);

    // Render badge based on URL status
    const renderStatusBadge = () => {
        if (isExpired) {
            return <Badge variant="red">Expired</Badge>;
        }

        if (url.expires_at && daysUntilExpiry !== null && daysUntilExpiry <= 7) {
            return <Badge variant="yellow">{daysUntilExpiry}d left</Badge>;
        }

        if (!url.expires_at) {
            return <Badge variant="green">Active</Badge>;
        }

        return null;
    };

    return (
        <>
            <Card
                padding="sm"
                className={`group hover:shadow-md dark:hover:shadow-gray-900/50 transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
                    }`}
            >
                <div className="p-2 sm:p-3">
                    <div className="flex flex-col gap-4">
                        {/* Header Section */}
                        <div className="flex sm:flex-row flex-col items-start justify-between gap-3">
                            {/* Checkbox */}
                            {showCheckbox && onSelect && (
                                <div className="flex items-start pt-1">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={handleCheckboxChange}
                                        className="w-4 h-4 sm:w-5 sm:h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                        aria-label={`Select ${url.short_code}`}
                                    />
                                </div>
                            )}

                            {/* Short URL and Badges */}
                            <div className="flex-1 min-w-0">
                                <a
                                    href={shortUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors group/link"
                                >
                                    <span className="truncate">{shortUrl}</span>
                                    <svg
                                        className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {url.is_custom_alias && (
                                        <Badge
                                            variant="purple"
                                            icon={
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                            }
                                        >
                                            Custom
                                        </Badge>
                                    )}
                                    {renderStatusBadge()}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <ActionButton
                                    onClick={handleCopy}
                                    title="Copy URL"
                                    icon={<CopyIcon copied={copied} />}
                                />
                                {onAnalyticsClick && (
                                    <ActionButton
                                        onClick={() => onAnalyticsClick(url)}
                                        title="View Analytics"
                                        icon={
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        }
                                    />
                                )}
                                {onShareClick && (
                                    <ActionButton
                                        onClick={() => onShareClick(url)}
                                        title="Share"
                                        icon={
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                            </svg>
                                        }
                                    />
                                )}
                                <ActionButton
                                    onClick={handleOpenDeleteModal}
                                    title="Delete"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    }
                                    variant="danger"
                                />
                            </div>
                        </div>

                        {/* Long URL Display */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate" title={url.long_url}>
                                {url.long_url}
                            </p>
                        </div>

                        {/* Statistics */}
                        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span className="font-semibold text-gray-900 dark:text-white">{url.access_count.toLocaleString()}</span> clicks
                            </span>
                            {url.unique_visitors !== undefined && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span className="font-semibold text-gray-900 dark:text-white">{url.unique_visitors.toLocaleString()}</span> unique
                                </span>
                            )}
                            <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formattedCreatedDate}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={handleCloseDeleteModal}
                title="Delete URL"
                size="md"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                Are you sure you want to delete this URL? This action cannot be undone and all analytics data will be permanently removed.
                            </p>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-all">
                            <strong className="font-semibold">Short URL:</strong>
                            <span className="text-gray-600 ml-2 dark:text-gray-300 bg-gray-200 dark:bg-gray-900/70 px-2 py-0.5 rounded font-mono text-xs sm:text-sm">
                                {shortUrl}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
                        <Button
                            variant="secondary"
                            onClick={handleCloseDeleteModal}
                            disabled={isDeleting}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            loading={isDeleting}
                            disabled={isDeleting}
                            className="w-full sm:w-auto"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete URL'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

URLCard.displayName = 'URLCard';

export default React.memo(URLCard);