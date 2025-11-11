import React from 'react';

export interface SkeletonProps {
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    className?: string;
    animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton Component
 * Loading placeholder for content
 * Implements requirement 2.1 for skeleton loaders
 */
const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'text',
    width,
    height,
    className = '',
    animation = 'pulse',
}) => {
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: '',
        rounded: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer',
        none: '',
    };

    const style: React.CSSProperties = {
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'text' ? '1em' : undefined),
    };

    return (
        <div
            className={`bg-gray-200 dark:bg-gray-700 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
            style={style}
            aria-hidden="true"
        />
    );
};

/**
 * Skeleton Text Component
 * Multiple lines of skeleton text
 */
export const SkeletonText: React.FC<{
    lines?: number;
    className?: string;
}> = ({ lines = 3, className = '' }) => {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, index) => (
                <Skeleton
                    key={index}
                    variant="text"
                    width={index === lines - 1 ? '80%' : '100%'}
                />
            ))}
        </div>
    );
};

/**
 * Skeleton Card Component
 * Card-shaped skeleton loader
 */
export const SkeletonCard: React.FC<{
    className?: string;
}> = ({ className = '' }) => {
    return (
        <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
            <div className="flex items-start space-x-4">
                <Skeleton variant="circular" width={48} height={48} />
                <div className="flex-1 space-y-3">
                    <Skeleton variant="text" width="60%" />
                    <SkeletonText lines={2} />
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton Table Component
 * Table-shaped skeleton loader
 */
export const SkeletonTable: React.FC<{
    rows?: number;
    columns?: number;
    className?: string;
}> = ({ rows = 5, columns = 4, className = '' }) => {
    return (
        <div className={`space-y-3 ${className}`}>
            {/* Header */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, index) => (
                    <Skeleton key={`header-${index}`} variant="text" height={20} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={`row-${rowIndex}`}
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton key={`cell-${rowIndex}-${colIndex}`} variant="text" height={16} />
                    ))}
                </div>
            ))}
        </div>
    );
};

/**
 * Skeleton List Component
 * List-shaped skeleton loader
 */
export const SkeletonList: React.FC<{
    items?: number;
    className?: string;
}> = ({ items = 5, className = '' }) => {
    return (
        <div className={`space-y-4 ${className}`}>
            {Array.from({ length: items }).map((_, index) => (
                <div key={index} className="flex items-center space-x-3">
                    <Skeleton variant="circular" width={40} height={40} />
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" width="70%" />
                        <Skeleton variant="text" width="40%" />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Skeleton;
