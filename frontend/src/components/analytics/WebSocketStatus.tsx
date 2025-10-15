import React, { useState, useEffect } from 'react';
import websocketService from '../../services/websocket';

interface WebSocketStatusProps {
    className?: string;
}

const WebSocketStatus: React.FC<WebSocketStatusProps> = ({ className = '' }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [, setConnectionAttempts] = useState(0);

    useEffect(() => {
        const checkConnection = () => {
            const connected = websocketService.isConnected();
            setIsConnected(connected);
        };

        // Check connection status every second
        const interval = setInterval(checkConnection, 1000);

        // Initial check
        checkConnection();

        // Try to connect if not connected
        if (!websocketService.isConnected()) {
            websocketService.connect();
            setConnectionAttempts(prev => prev + 1);
        }

        return () => clearInterval(interval);
    }, []);

    const handleReconnect = () => {
        setConnectionAttempts(prev => prev + 1);
        websocketService.disconnect();
        setTimeout(() => {
            websocketService.connect();
        }, 1000);
    };

    if (isConnected) {
        return (
            <div className={`flex items-center gap-2 text-sm ${className}`}>
                <div className="relative">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
                </div>
                <span className="text-green-600 font-medium">Real-time updates active</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 text-sm ${className}`}>
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-gray-500">Real-time updates offline</span>
            <button
                onClick={handleReconnect}
                className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
                Reconnect
            </button>
        </div>
    );
};

export default WebSocketStatus;