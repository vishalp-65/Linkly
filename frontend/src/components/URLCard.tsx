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
}

// Icon components for better reusability
const CopyIcon: React.FC<{ copied?: boolean }> = ({ copied }) =>
    copied ? (
        <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
            />
        </svg>
    ) : (
        <svg
            className="w-4 h-4 sm:w-5 sm:h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
        </svg>
    );

const ExternalLinkIcon: React.FC = () => (
    <svg
        className="w-3 h-3 sm:w-4 sm:h-4 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
    </svg>
);

const AnalyticsIcon: React.FC = () => (
    <svg
        className="w-4 h-4 sm:w-5 sm:h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
    </svg>
);

const ShareIcon: React.FC = () => (
    <svg
        className="w-4 h-4 sm:w-5 sm:h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
    </svg>
);

const DeleteIcon: React.FC = () => (
    <svg
        className="w-4 h-4 sm:w-5 sm:h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
    </svg>
);

// Badge component
const Badge: React.FC<{
    variant: 'purple' | 'red' | 'yellow';
    icon?: React.ReactNode;
    children: React.ReactNode;
}> = ({ variant, icon, children }) => {
    const variantClasses = {
        purple:
            'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        yellow:
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    };

    return (
        <span
            className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
        >
            {icon && <span className="mr-1">{icon}</span>}
            {children}
        </span>
    );
};

// Stat component
const Stat: React.FC<{ icon: React.ReactNode; label: string }> = ({
    icon,
    label,
}) => (
    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {icon}
        <span className="text-xs">{label}</span>
    </span>
);

const URLCard: React.FC<URLCardProps> = React.memo(
    ({ url, onAnalyticsClick, onShareClick }) => {
        const [copied, setCopied] = useState(false);
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
        const [deleteUrl, { isLoading: isDeleting }] = useDeleteUrlMutation();
        const { showToast } = useToast();

        const shortUrl = useMemo(
            () => `${window.location.origin}/${url.short_code}`,
            [url.short_code]
        );

        const { isExpired, daysUntilExpiry } = useMemo(() => {
            if (!url.expires_at) return { isExpired: false, daysUntilExpiry: null };

            const expiryDate = new Date(url.expires_at);
            const now = new Date();
            const expired = expiryDate < now;
            const days = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            return { isExpired: expired, daysUntilExpiry: days };
        }, [url.expires_at]);

        const handleCopy = useCallback(async () => {
            try {
                await navigator.clipboard.writeText(shortUrl);
                setCopied(true);
                showToast({
                    type: 'success',
                    title: 'Copied!',
                    message: 'Short URL copied to clipboard',
                    duration: 2000,
                });
                setTimeout(() => setCopied(false), 2000);
            } catch (error) {
                console.error('Failed to copy:', error);
                showToast({
                    type: 'error',
                    title: 'Copy Failed',
                    message: 'Failed to copy URL to clipboard',
                    duration: 3000,
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
                    message: 'Short URL has been successfully deleted',
                    duration: 3000,
                });
            } catch (error) {
                console.error('Failed to delete:', error);
                showToast({
                    type: 'error',
                    title: 'Delete Failed',
                    message: 'Failed to delete URL. Please try again.',
                    duration: 4000,
                });
            }
        }, [deleteUrl, url.short_code, showToast]);

        const handleAnalyticsClick = useCallback(() => {
            onAnalyticsClick?.(url);
        }, [onAnalyticsClick, url]);

        const handleShareClick = useCallback(() => {
            onShareClick?.(url);
        }, [onShareClick, url]);

        const toggleDeleteModal = useCallback((show: boolean) => {
            setShowDeleteConfirm(show);
        }, []);

        return (
            <Card padding="sm" hover className="dark:bg-gray-900/20 px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                    {/* URL Info */}
                    <div className="flex-1 min-w-0">
                        {/* Short URL */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <a
                                href={shortUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm sm:text-base text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium truncate flex items-center gap-1 group max-w-full"
                            >
                                <span className="truncate">{shortUrl}</span>
                                <ExternalLinkIcon />
                            </a>

                            {url.is_custom_alias && (
                                <Badge
                                    variant="purple"
                                    icon={
                                        <svg
                                            className="w-3 h-3"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                            />
                                        </svg>
                                    }
                                >
                                    Custom
                                </Badge>
                            )}

                            {isExpired ? (
                                <Badge variant="red">Expired</Badge>
                            ) : (
                                url.expires_at &&
                                daysUntilExpiry !== null &&
                                daysUntilExpiry <= 7 && (
                                    <Badge variant="yellow">
                                        <span className="hidden sm:inline">Expires in </span>
                                        {daysUntilExpiry}d
                                    </Badge>
                                )
                            )}
                        </div>

                        {/* Long URL */}
                        <p
                            className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate mb-3"
                            title={url.long_url}
                        >
                            {url.long_url}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center gap-3 sm:gap-4 text-xs flex-wrap">
                            <Stat
                                icon={
                                    <svg
                                        className="w-3 h-3 sm:w-4 sm:h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        />
                                    </svg>
                                }
                                label={`${url.access_count} ${url.access_count === 1 ? 'click' : 'clicks'}`}
                            />

                            {url.unique_visitors !== undefined && (
                                <Stat
                                    icon={<AnalyticsIcon />}
                                    label={`${url.unique_visitors} unique`}
                                />
                            )}

                            <Stat
                                icon={
                                    <svg
                                        className="w-3 h-3 sm:w-4 sm:h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                        />
                                    </svg>
                                }
                                label={new Date(url.created_at).toLocaleDateString()}
                            />

                            {url.last_accessed_at && (
                                <Stat
                                    icon={
                                        <svg
                                            className="w-3 h-3 sm:w-4 sm:h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                    }
                                    label={`Last: ${new Date(url.last_accessed_at).toLocaleDateString()}`}
                                />
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 justify-end sm:justify-start">
                        <button
                            onClick={handleCopy}
                            className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors cursor-pointer"
                            title="Copy to clipboard"
                            aria-label="Copy short URL"
                        >
                            <CopyIcon copied={copied} />
                        </button>

                        {onAnalyticsClick && (
                            <button
                                onClick={handleAnalyticsClick}
                                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors cursor-pointer"
                                title="View analytics"
                                aria-label="View analytics"
                            >
                                <AnalyticsIcon />
                            </button>
                        )}

                        {onShareClick && (
                            <button
                                onClick={handleShareClick}
                                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors cursor-pointer"
                                title="Share"
                                aria-label="Share URL"
                            >
                                <ShareIcon />
                            </button>
                        )}

                        <button
                            onClick={() => toggleDeleteModal(true)}
                            disabled={isDeleting}
                            className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            title="Delete"
                            aria-label="Delete URL"
                        >
                            <DeleteIcon />
                        </button>
                    </div>
                </div>

                {/* Delete Modal */}
                <Modal
                    isOpen={showDeleteConfirm}
                    onClose={() => toggleDeleteModal(false)}
                    title="Delete URL"
                    size="md"
                >
                    <div className="flex items-center gap-3 sm:gap-5 mb-4">
                        <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <svg
                                className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
                            Are you sure you want to delete this URL? All analytics data will
                            also be removed.
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 mb-4 border border-gray-200 dark:border-gray-700">
                        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
                            <strong>Short URL:</strong> {shortUrl}
                        </p>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-4">
                        <Button
                            variant="secondary"
                            onClick={() => toggleDeleteModal(false)}
                            disabled={isDeleting}
                            className="w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            loading={isDeleting}
                            className="w-full sm:w-auto"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete URL'}
                        </Button>
                    </div>
                </Modal>
            </Card>
        );
    }
);

URLCard.displayName = 'URLCard';

export default URLCard;