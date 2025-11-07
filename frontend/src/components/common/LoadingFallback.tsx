import React from 'react';

interface LoadingFallbackProps {
    message?: string;
    className?: string;
}

const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    message = 'Loading...',
    className = ''
}) => {
    return (
        <div className={`flex items-center justify-center min-h-[200px] ${className}`}>
            <div className="flex flex-col items-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 text-sm">{message}</p>
            </div>
        </div>
    );
};

export default LoadingFallback;