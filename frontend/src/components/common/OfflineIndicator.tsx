import { useEffect, useState } from 'react';

interface OfflineIndicatorProps {
    className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className = '' }) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showIndicator, setShowIndicator] = useState(!navigator.onLine);
    const [syncStatus, setSyncStatus] = useState<{
        syncing: boolean;
        successCount?: number;
        totalCount?: number;
    }>({ syncing: false });

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Keep showing indicator briefly to show "back online" message
            setShowIndicator(true);
            setTimeout(() => setShowIndicator(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowIndicator(true);
        };

        // Listen for service worker messages
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            const { type, successCount, totalCount } = event.data;

            if (type === 'SYNC_COMPLETE') {
                setSyncStatus({ syncing: false, successCount, totalCount });
                // Show sync complete message briefly
                setTimeout(() => {
                    setSyncStatus({ syncing: false });
                }, 5000);
            } else if (type === 'SERVING_FROM_CACHE') {
                // Could show a subtle indicator that data is from cache
                console.log('Serving from cache:', event.data.url);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            }
        };
    }, []);

    if (!showIndicator && !syncStatus.syncing) {
        return null;
    }

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${className}`}
            role="alert"
            aria-live="polite"
        >
            {!isOnline && (
                <div className="bg-yellow-500 dark:bg-yellow-600 text-white px-4 py-3 shadow-lg">
                    <div className="container mx-auto flex items-center justify-center gap-3">
                        <svg
                            className="w-5 h-5 animate-pulse"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
                            />
                        </svg>
                        <span className="font-medium">
                            You are currently offline. Some features may be limited.
                        </span>
                    </div>
                </div>
            )}

            {isOnline && showIndicator && (
                <div className="bg-green-500 dark:bg-green-600 text-white px-4 py-3 shadow-lg">
                    <div className="container mx-auto flex items-center justify-center gap-3">
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span className="font-medium">
                            You are back online!
                        </span>
                    </div>
                </div>
            )}

            {syncStatus.syncing && (
                <div className="bg-blue-500 dark:bg-blue-600 text-white px-4 py-3 shadow-lg">
                    <div className="container mx-auto flex items-center justify-center gap-3">
                        <svg
                            className="w-5 h-5 animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        <span className="font-medium">
                            Syncing pending requests...
                        </span>
                    </div>
                </div>
            )}

            {!syncStatus.syncing && syncStatus.successCount !== undefined && (
                <div className="bg-green-500 dark:bg-green-600 text-white px-4 py-3 shadow-lg">
                    <div className="container mx-auto flex items-center justify-center gap-3">
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span className="font-medium">
                            Sync complete: {syncStatus.successCount} of {syncStatus.totalCount} requests succeeded
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};
