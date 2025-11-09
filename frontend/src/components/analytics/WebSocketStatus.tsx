import React from 'react';

interface WebSocketStatusProps {
    className?: string;
    isLiveUpdateEnabled: boolean;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({
    className = '',
    isLiveUpdateEnabled
}) => {

    return (
        <div className={`flex items-center gap-2 text-sm ${className}`}>
            <div className="relative">
                <div className={`w-2 h-2 rounded-full ${isLiveUpdateEnabled ? 'bg-green-400 dark:bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                {isLiveUpdateEnabled && (
                    <div className="absolute inset-0 w-2 h-2 bg-green-400 dark:bg-green-500 rounded-full animate-ping opacity-75"></div>
                )}
            </div>
            <span className={`font-medium ${isLiveUpdateEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {isLiveUpdateEnabled ? 'Real-time updates active' : 'Real-time updates offline'}
            </span>

        </div>
    );
};

export default WebSocketStatus;