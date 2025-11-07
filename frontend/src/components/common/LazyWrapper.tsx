import React, { Suspense, type ComponentType } from 'react';
import LoadingFallback from './LoadingFallback';

interface LazyWrapperProps {
    fallback?: React.ReactNode;
    errorFallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: React.ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Lazy component loading error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }

        return this.props.children;
    }
}

const withLazyLoading = <P extends object>(
    Component: ComponentType<P>,
    options: LazyWrapperProps = {}
) => {
    const LazyComponent = React.lazy(() => Promise.resolve({ default: Component }));

    return (props: P) => {
        const fallback = options.fallback || <LoadingFallback />;
        const errorFallback = options.errorFallback || (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                    <p className="text-red-600 mb-2">Failed to load component</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="text-blue-600 hover:text-blue-800 underline"
                    >
                        Reload page
                    </button>
                </div>
            </div>
        );

        return (
            <ErrorBoundary fallback={errorFallback}>
                <Suspense fallback={fallback}>
                    <LazyComponent {...props} />
                </Suspense>
            </ErrorBoundary>
        );
    };
};

export default withLazyLoading;