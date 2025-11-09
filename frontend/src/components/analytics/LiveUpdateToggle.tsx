import React from 'react';

interface LiveUpdateToggleProps {
    isEnabled: boolean;
    isConnected: boolean;
    onToggle: () => void;
    className?: string;
}

const LiveUpdateToggle: React.FC<LiveUpdateToggleProps> = ({
    isEnabled,
    isConnected,
    onToggle,
    className = '',
}) => {
    return (
        <button
            onClick={onToggle}
            className={`
                relative inline-flex items-center gap-2 px-4 py-2 rounded-lg
                transition-all duration-200 font-medium text-sm cursor-pointer
                ${isEnabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
                ${className}
            `}
            title={isEnabled ? 'Disable live updates' : 'Enable live updates'}
        >
            {/* Status indicator */}
            <div className="relative">
                <div
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${isEnabled && isConnected
                        ? 'bg-green-500'
                        : isEnabled
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                        }`}
                >
                    {isEnabled && isConnected && (
                        <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                    )}
                </div>
            </div>

            {/* Icon */}
            {isEnabled ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                </svg>
            )}

            {/* Text */}
            <span>
                {isEnabled
                    ? isConnected
                        ? 'Live'
                        : 'Connecting...'
                    : 'Live Off'
                }
            </span>
        </button>
    );
};

export default LiveUpdateToggle;
