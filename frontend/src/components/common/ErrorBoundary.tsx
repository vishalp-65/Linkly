import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import Button from './Button';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
    level?: 'global' | 'page' | 'component';
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 * Implements requirement 2.3 for error handling
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Log error to console in development
        if (import.meta.env.DEV) {
            console.error('Error caught by boundary:', error);
            console.error('Error info:', errorInfo);
        }

        // Report to monitoring service (e.g., Sentry)
        this.reportError(error, errorInfo);

        // Call custom error handler if provided
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }

        this.setState({
            errorInfo,
        });
    }

    reportError(error: Error, errorInfo: ErrorInfo): void {
        // Report to monitoring service
        // In production, this would send to Sentry, LogRocket, etc.
        try {
            const errorReport = {
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                level: this.props.level || 'component',
            };

            // Send to monitoring endpoint
            if (import.meta.env.VITE_MONITORING_ENDPOINT) {
                fetch(import.meta.env.VITE_MONITORING_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(errorReport),
                }).catch((err) => {
                    console.error('Failed to report error:', err);
                });
            }

            // Log to console in development
            if (import.meta.env.DEV) {
                console.log('Error report:', errorReport);
            }
        } catch (reportError) {
            console.error('Error reporting failed:', reportError);
        }
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI based on error level
            return this.renderDefaultFallback();
        }

        return this.props.children;
    }

    renderDefaultFallback(): ReactNode {
        const { level = 'component' } = this.props;
        const { error } = this.state;

        // Global level - full page error
        if (level === 'global') {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
                    <div className="max-w-md w-full text-center">
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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            We're sorry, but something unexpected happened. Please try reloading the page.
                        </p>
                        {import.meta.env.DEV && error && (
                            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left">
                                <p className="text-sm font-mono text-red-800 dark:text-red-300 break-all">
                                    {error.message}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Button onClick={this.handleReload} variant="primary">
                                Reload Page
                            </Button>
                            <Button onClick={this.handleReset} variant="secondary">
                                Try Again
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        // Page level - section error
        if (level === 'page') {
            return (
                <div className="flex items-center justify-center min-h-[400px] px-4">
                    <div className="max-w-md w-full text-center">
                        <div className="mb-4">
                            <svg
                                className="mx-auto h-12 w-12 text-red-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            Unable to load this page
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            An error occurred while loading this page. Please try again.
                        </p>
                        {import.meta.env.DEV && error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded text-left">
                                <p className="text-xs font-mono text-red-800 dark:text-red-300 break-all">
                                    {error.message}
                                </p>
                            </div>
                        )}
                        <div className="flex gap-2 justify-center">
                            <Button onClick={this.handleReset} variant="primary" size="sm">
                                Try Again
                            </Button>
                            <Button
                                onClick={() => (window.location.href = '/')}
                                variant="secondary"
                                size="sm"
                            >
                                Go Home
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        // Component level - inline error
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <svg
                            className="h-5 w-5 text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <div className="ml-3 flex-1">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                            Component Error
                        </h3>
                        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                            This component failed to load. Please try again.
                        </p>
                        {import.meta.env.DEV && error && (
                            <p className="mt-2 text-xs font-mono text-red-600 dark:text-red-400 break-all">
                                {error.message}
                            </p>
                        )}
                    </div>
                    <div className="ml-3">
                        <button
                            onClick={this.handleReset}
                            className="text-sm text-red-800 dark:text-red-300 hover:text-red-900 dark:hover:text-red-200 font-medium"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
