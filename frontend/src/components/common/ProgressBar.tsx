import React from 'react';

export interface ProgressBarProps {
    value: number;
    max?: number;
    size?: 'sm' | 'md' | 'lg';
    color?: 'primary' | 'success' | 'warning' | 'danger';
    showLabel?: boolean;
    label?: string;
    className?: string;
    indeterminate?: boolean;
}

/**
 * Progress Bar Component
 * Visual indicator for long-running operations
 * Implements requirement 2.1 for progress indicators
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    max = 100,
    size = 'md',
    color = 'primary',
    showLabel = false,
    label,
    className = '',
    indeterminate = false,
}) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3',
    };

    const colorClasses = {
        primary: 'bg-blue-600',
        success: 'bg-green-600',
        warning: 'bg-yellow-600',
        danger: 'bg-red-600',
    };

    return (
        <div className={className}>
            {(showLabel || label) && (
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {label || 'Progress'}
                    </span>
                    {showLabel && !indeterminate && (
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {Math.round(percentage)}%
                        </span>
                    )}
                </div>
            )}
            <div
                className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizeClasses[size]}`}
                role="progressbar"
                aria-valuenow={indeterminate ? undefined : value}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={label || 'Progress'}
            >
                {indeterminate ? (
                    <div
                        className={`h-full ${colorClasses[color]} animate-progress-indeterminate`}
                        style={{ width: '30%' }}
                    />
                ) : (
                    <div
                        className={`h-full ${colorClasses[color]} transition-all duration-300 ease-out`}
                        style={{ width: `${percentage}%` }}
                    />
                )}
            </div>
        </div>
    );
};

/**
 * Circular Progress Component
 * Circular progress indicator
 */
export const CircularProgress: React.FC<{
    value?: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    color?: 'primary' | 'success' | 'warning' | 'danger';
    showLabel?: boolean;
    className?: string;
    indeterminate?: boolean;
}> = ({
    value = 0,
    max = 100,
    size = 48,
    strokeWidth = 4,
    color = 'primary',
    showLabel = false,
    className = '',
    indeterminate = false,
}) => {
        const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        const colorClasses = {
            primary: 'stroke-blue-600',
            success: 'stroke-green-600',
            warning: 'stroke-yellow-600',
            danger: 'stroke-red-600',
        };

        return (
            <div className={`inline-flex items-center justify-center ${className}`}>
                <svg
                    width={size}
                    height={size}
                    className={indeterminate ? 'animate-spin' : ''}
                    role="progressbar"
                    aria-valuenow={indeterminate ? undefined : value}
                    aria-valuemin={0}
                    aria-valuemax={max}
                >
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-gray-200 dark:text-gray-700"
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        className={colorClasses[color]}
                        style={{
                            strokeDasharray: circumference,
                            strokeDashoffset: indeterminate ? circumference * 0.75 : offset,
                            transform: 'rotate(-90deg)',
                            transformOrigin: '50% 50%',
                            transition: 'stroke-dashoffset 0.3s ease',
                        }}
                    />
                    {showLabel && !indeterminate && (
                        <text
                            x="50%"
                            y="50%"
                            textAnchor="middle"
                            dy=".3em"
                            className="text-xs font-semibold fill-current text-gray-700 dark:text-gray-300"
                        >
                            {Math.round(percentage)}%
                        </text>
                    )}
                </svg>
            </div>
        );
    };

export default ProgressBar;
