import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { useNavigate } from 'react-router-dom';
import Button from './Button';

interface PageErrorBoundaryProps {
    children: React.ReactNode;
    pageName?: string;
}

/**
 * Page-level Error Boundary
 * Wraps entire pages to catch and handle errors gracefully
 * Implements requirement 2.3 for page-level error handling
 */
const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({
    children,
    pageName = 'this page',
}) => {
    const PageErrorFallback = () => {
        const navigate = useNavigate();

        return (
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                <div className="max-w-lg w-full text-center">
                    <div className="mb-6">
                        <svg
                            className="mx-auto h-16 w-16 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        Failed to load {pageName}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        We encountered an unexpected error while loading this page. This has been
                        reported to our team.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                            onClick={() => window.location.reload()}
                            variant="primary"
                            className="w-full sm:w-auto"
                        >
                            <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Reload Page
                        </Button>
                        <Button
                            onClick={() => navigate('/')}
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                />
                            </svg>
                            Go Home
                        </Button>
                    </div>
                    <div className="mt-8">
                        <button
                            onClick={() => navigate(-1)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                            ← Go back
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <ErrorBoundary level="page" fallback={<PageErrorFallback />}>
            {children}
        </ErrorBoundary>
    );
};

export default PageErrorBoundary;
