import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string | React.ReactNode;
    showBackButton?: boolean;
    onBackClick?: () => void;
    className?: string;
    children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    showBackButton = false,
    onBackClick,
    className = '',
    children
}) => {
    const handleBackClick = () => {
        if (onBackClick) {
            onBackClick();
        } else {
            window.history.back();
        }
    };

    return (
        <div className={`mb-6 sm:mb-8 ${className}`}>
            <div className="flex flex-col gap-3 sm:gap-4">
                {/* Title Section */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        {showBackButton && (
                            <button
                                onClick={handleBackClick}
                                className="p-1.5 sm:p-2 text-gray-600 cursor-pointer dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                                aria-label="Go back"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                            {title}
                        </h1>
                    </div>

                    {subtitle && (
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-10">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Additional Content */}
                {children}
            </div>
        </div>
    );
};

export default PageHeader;