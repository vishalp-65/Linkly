import React, { useState, useEffect } from 'react';
import { useDeleteUrlMutation } from '../services/api';
import type { URLItem } from '../services/api';
import Button from './common/Button';
import Card from './common/Card';
import Modal from './common/Modal';
import { useToast } from '../contexts/ToastContext';

interface URLCardProps {
    url: URLItem;
    onAnalyticsClick?: (url: URLItem) => void;
    onEditClick?: (url: URLItem) => void;
    onShareClick?: (url: URLItem) => void;
}

const URLCard: React.FC<URLCardProps> = ({
    url,
    onAnalyticsClick,
    onEditClick,
    onShareClick
}) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [deleteUrl, { isLoading: isDeleting }] = useDeleteUrlMutation();
    const { showToast } = useToast();


    // Calculate time left until expiry
    useEffect(() => {
        if (!url.expiryDate || url.isExpired) return;

        const updateTimeLeft = () => {
            const now = new Date().getTime();
            const expiry = new Date(url.expiryDate!).getTime();
            const difference = expiry - now;

            if (difference <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h`);
            } else if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m`);
            } else {
                setTimeLeft(`${minutes}m`);
            }
        };

        updateTimeLeft();
        const interval = setInterval(updateTimeLeft, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [url.expiryDate, url.isExpired]);

    const handleCopyUrl = async () => {
        try {
            await navigator.clipboard.writeText(url.shortUrl);
            showToast({
                type: 'success',
                title: 'Copied!',
                message: 'Short URL copied to clipboard',
                duration: 2000
            });
        } catch (err) {
            console.error('Failed to copy URL:', err);
            showToast({
                type: 'error',
                title: 'Copy Failed',
                message: 'Failed to copy URL to clipboard',
                duration: 3000
            });
        }
    };

    const handleDelete = async () => {
        try {
            await deleteUrl(url.shortCode).unwrap();
            setShowDeleteModal(false);
            showToast({
                type: 'success',
                title: 'URL Deleted',
                message: 'Short URL has been successfully deleted',
                duration: 3000
            });
            // URL will be removed from list via RTK Query cache invalidation
        } catch (err) {
            console.error('Failed to delete URL:', err);
            showToast({
                type: 'error',
                title: 'Delete Failed',
                message: 'Failed to delete URL. Please try again.',
                duration: 4000
            });
        }
    };

    const truncateUrl = (url: string, maxLength: number = 60) => {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'expired':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <>
            <Card hover className="relative">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        {/* Short URL with copy button */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-medium text-blue-600 truncate">
                                    {url.shortUrl}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleCopyUrl}
                                    className="flex-shrink-0"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </Button>
                            </div>

                            {/* Status indicator */}
                            <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${getStatusColor(url.status)}`}>
                                {url.status}
                            </span>
                        </div>

                        {/* Long URL with tooltip */}
                        <div className="mb-3">
                            <p
                                className="text-gray-600 text-sm truncate cursor-help"
                                title={url.originalUrl}
                            >
                                {truncateUrl(url.originalUrl)}
                            </p>
                        </div>

                        {/* Metrics and info */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                            {/* Click count badge */}
                            <div className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span className="font-medium">{url.clickCount.toLocaleString()}</span>
                                <span>clicks</span>
                            </div>

                            <span>•</span>
                            <span>Created {new Date(url.createdAt).toLocaleDateString()}</span>

                            {/* Expiry countdown timer */}
                            {url.expiryDate && (
                                <>
                                    <span>•</span>
                                    <span className={timeLeft === 'Expired' ? 'text-red-500 font-medium' : ''}>
                                        {timeLeft === 'Expired' ? 'Expired' : `Expires in ${timeLeft}`}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Quick actions menu */}
                    <div className="relative ml-4">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowActionsMenu(!showActionsMenu)}
                            className="flex-shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </Button>

                        {/* Actions dropdown */}
                        {showActionsMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                <div className="py-1">
                                    {onEditClick && (
                                        <button
                                            onClick={() => {
                                                onEditClick(url);
                                                setShowActionsMenu(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </button>
                                    )}

                                    {onAnalyticsClick && (
                                        <button
                                            onClick={() => {
                                                onAnalyticsClick(url);
                                                setShowActionsMenu(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Analytics
                                        </button>
                                    )}

                                    {onShareClick && (
                                        <button
                                            onClick={() => {
                                                onShareClick(url);
                                                setShowActionsMenu(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                            </svg>
                                            Share
                                        </button>
                                    )}

                                    <div className="border-t border-gray-100 my-1"></div>

                                    <button
                                        onClick={() => {
                                            setShowDeleteModal(true);
                                            setShowActionsMenu(false);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {/* Delete confirmation modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete URL"
            >
                <div className="space-y-4">
                    <p className="text-gray-600">
                        Are you sure you want to delete this short URL? This action cannot be undone.
                    </p>

                    <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-sm font-medium text-gray-900">{url.shortUrl}</p>
                        <p className="text-sm text-gray-600 truncate">{url.originalUrl}</p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDelete}
                            loading={isDeleting}
                        >
                            Delete URL
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Click outside to close actions menu */}
            {showActionsMenu && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setShowActionsMenu(false)}
                />
            )}
        </>
    );
};

export default URLCard;