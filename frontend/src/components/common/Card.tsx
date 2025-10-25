import React from 'react';

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    description?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
    children,
    className = '',
    title,
    description,
    padding = 'md',
    hover = false,
    style = { animationDelay: '0s' },
}) => {
    const paddingClasses = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={`
                bg-white dark:bg-gray-800 
                text-gray-900 dark:text-gray-100 
                rounded-lg shadow-md border border-gray-200 dark:border-gray-700 
                ${hover ? 'hover:shadow-lg transition-shadow duration-200' : ''} 
                ${className}
            `}
            style={style}
        >
            {(title || description) && (
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    {title && (
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {title}
                        </h3>
                    )}
                    {description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {description}
                        </p>
                    )}
                </div>
            )}
            <div className={paddingClasses[padding]}>
                {children}
            </div>
        </div>
    );
};

export default Card;
