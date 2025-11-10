import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    showFocusRing?: boolean; // 👈 New prop
    children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled,
    showFocusRing = true, // 👈 Default: show focus ring
    ...props
}) => {
    const baseClasses = `
        inline-flex items-center justify-center font-medium rounded-md transition-all duration-200 cursor-pointer
        ${showFocusRing ? 'focus:outline-none focus:ring-2 focus:ring-offset-2' : 'focus:outline-none focus:ring-0 focus:ring-offset-0'}
    `;

    const variantClasses = {
        primary: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 shadow-md hover:shadow-lg dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
        danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 focus:ring-red-500 shadow-md hover:shadow-lg dark:from-red-500 dark:to-red-600 dark:hover:from-red-600 dark:hover:to-red-700',
        ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:ring-gray-500 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
    };

    const isDisabled = disabled || loading;

    return (
        <button
            className={`
                ${baseClasses}
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            {...props}
        >
            {loading ? (
                <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" aria-hidden="true" />
                    <span className="sr-only">Loading...</span>
                </>
            ) : leftIcon ? (
                <span className="mr-2" aria-hidden="true">{leftIcon}</span>
            ) : null}

            {children}

            {rightIcon && !loading && (
                <span className="ml-2" aria-hidden="true">{rightIcon}</span>
            )}
        </button>
    );
};

export default Button;
