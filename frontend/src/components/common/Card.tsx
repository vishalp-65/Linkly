import React from 'react';

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'outlined' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
    children,
    className = '',
    variant = 'default',
    padding = 'md',
    hover = false,
    onClick,
}) => {
    const baseClasses = 'rounded-lg transition-all duration-200';

    const variantClasses = {
        default: 'bg-white border border-gray-200',
        outlined: 'bg-white border-2 border-gray-300',
        elevated: 'bg-white shadow-lg border border-gray-100'
    };

    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6'
    };

    const hoverClasses = hover
        ? 'hover:shadow-md hover:border-gray-300 cursor-pointer'
        : '';

    const clickableClasses = onClick
        ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        : '';

    const classes = `${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${clickableClasses} ${className}`;

    const Component = onClick ? 'button' : 'div';

    return (
        <Component
            className={classes}
            onClick={onClick}
            {...(onClick && { type: 'button' })}
        >
            {children}
        </Component>
    );
};

// Card sub-components for better composition
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`border-b border-gray-200 pb-3 mb-4 ${className}`}>
        {children}
    </div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
        {children}
    </h3>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`text-gray-700 ${className}`}>
        {children}
    </div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = ''
}) => (
    <div className={`border-t border-gray-200 pt-3 mt-4 ${className}`}>
        {children}
    </div>
);

export default Card;