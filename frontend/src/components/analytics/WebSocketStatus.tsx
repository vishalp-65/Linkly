import React, { useState, useEffect } from 'react';
import websocketService from '../../services/websocket';

interface WebSocketStatusProps {
    className?: string;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ className = '' }) => {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const checkConnection = () => {
            setIsConnected(websocketService.isConnected());
        };

        // Check connection status every second
        const interval = setInterval(checkConnection, 1000);

        // Initial check
        checkConnection();

        // Try to connect if not connected
        if (!websocketService.isConnected()) {
            websocketService.connect();
        }

        return () => clearInterval(interval);
    }, []);

    const handleReconnect = () => {
        websocketService.disconnect();
        setTimeout(() => {
            websocketService.connect();
        }, 1000);
    };

    return (
        <div className={`flex items-center gap-2 text-sm ${className}`}>
            <div className="relative">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 dark:bg-green-500' : 'bg-gray-400 dark:bg-gray-600'}`}></div>
                {isConnected && (
                    <div className="absolute inset-0 w-2 h-2 bg-green-400 dark:bg-green-500 rounded-full animate-ping opacity-75"></div>
                )}
            </div>
            <span className={`font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {isConnected ? 'Real-time updates active' : 'Real-time updates offline'}
            </span>
            {!isConnected && (
                <button
                    onClick={handleReconnect}
                    className="ml-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                    aria-label="Reconnect WebSocket"
                >
                    Reconnect
                </button>
            )}
        </div>
    );
};

export default WebSocketStatus;