import React from 'react';
import Spinner from './Spinner';

interface LoadingFallbackProps {
    message?: string;
    className?: string;
    fullScreen?: boolean;
}

/**
 * Loading Fallback Component
 * Used as fallback for Suspense boundaries
 * Implements requirement 2.1 for loading states during data fetching
 */
const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message = 'Loading...',
    className = '',
    fullScreen = false
}) => {
    const containerClasses = fullScreen
        ? 'min-h-screen'
        : 'min-h-[200px]';

    return (
        <div
            className={`flex items-center justify-center ${containerClasses} ${className}`}
            role="status"
            aria-live="polite"
        >
            <div className="flex flex-col items-center space-y-4">
                <Spinner size="lg" color="primary" label={message} />
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                    {message}
                </p>
            </div>
        </div>
    );
};

export default LoadingFallback;