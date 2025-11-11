import React from 'react';

export interface SpinnerProps {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    color?: 'primary' | 'secondary' | 'white' | 'gray';
    className?: string;
    label?: string;
}

/**
 * Spinner Component
 * Loading indicator for actions and operations
 * Implements requirement 2.1 for loading states
 */
const Spinner: React.FC<SpinnerProps> = ({
    size = 'md',
    color = 'primary',
    className = '',
    label = 'Loading...',
}) => {
    const sizeClasses = {
        xs: 'h-3 w-3 border',
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-2',
        xl: 'h-12 w-12 border-4',
    };

    const colorClasses = {
        primary: 'border-blue-600 border-t-transparent',
        secondary: 'border-gray-600 border-t-transparent',
        white: 'border-white border-t-transparent',
        gray: 'border-gray-400 border-t-transparent',
    };

    return (
        <div className={`inline-flex items-center ${className}`} role="status" aria-live="polite">
            <div
                className={`animate-spin rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
                aria-hidden="true"
            />
            <span className="sr-only">{label}</span>
        </div>
    );
};

export default Spinner;
