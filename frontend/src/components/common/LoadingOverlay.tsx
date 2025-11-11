import React from 'react';
import Spinner from './Spinner';

export interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
    blur?: boolean;
    fullScreen?: boolean;
    className?: string;
}

/**
 * Loading Overlay Component
 * Displays a loading indicator over content
 * Implements requirement 2.1 for loading states during data fetching
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    isLoading,
    message = 'Loading...',
    blur = true,
    fullScreen = false,
    className = '',
}) => {
    if (!isLoading) return null;

    const overlayClasses = fullScreen
        ? 'fixed inset-0 z-50'
        : 'absolute inset-0 z-10';

    return (
        <div
            className={`${overlayClasses} flex items-center justify-center bg-white/80 dark:bg-gray-900/80 ${blur ? 'backdrop-blur-sm' : ''
                } ${className}`}
            role="status"
            aria-live="polite"
            aria-label={message}
        >
            <div className="flex flex-col items-center space-y-3 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <Spinner size="lg" color="primary" />
                {message && (
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoadingOverlay;
