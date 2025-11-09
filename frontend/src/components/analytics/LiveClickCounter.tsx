import React, { useEffect, useRef } from 'react';
import websocketService from '../../services/websocket';

interface LiveClickCounterProps {
    clickCount: number;
    isLive: boolean;
    className?: string;
}

const LiveClickCounter: React.FC<LiveClickCounterProps> = ({
    clickCount,
    isLive,
    className = '',
}) => {
    const animationRef = useRef<HTMLDivElement>(null);
    const countRef = useRef<HTMLSpanElement>(null);
    const prevCountRef = useRef(clickCount);

    // Animate when count changes
    useEffect(() => {
        if (clickCount > prevCountRef.current) {
            if (countRef.current) {
                countRef.current.classList.add('animate-pulse');
                setTimeout(() => {
                    countRef.current?.classList.remove('animate-pulse');
                }, 600);
            }

            if (animationRef.current) {
                animationRef.current.classList.add('animate-bounce');
                setTimeout(() => {
                    animationRef.current?.classList.remove('animate-bounce');
                }, 600);
            }
        }
        prevCountRef.current = clickCount;
    }, [clickCount]);

    const formatCount = (count: number): string => {
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        }
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toLocaleString();
    };

    const getConnectionStatus = () => {
        const connected = websocketService.isConnected();
        return {
            connected,
            text: connected ? 'Live' : 'Offline',
            color: connected
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-500',
        };
    };

    const status = getConnectionStatus();

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Live indicator */}
            <div className="flex items-center gap-2">
                <div className="relative">
                    <div
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${isLive
                            ? 'bg-red-500'
                            : status.connected
                                ? 'bg-green-400 dark:bg-green-500'
                                : 'bg-gray-400 dark:bg-gray-600'
                            }`}
                    >
                        {isLive && (
                            <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                        )}
                    </div>
                </div>
                <span className={`text-xs font-medium ${status.color}`}>
                    {status.text}
                </span>
            </div>

            {/* Click counter */}
            <div className="flex items-center gap-2">
                <div ref={animationRef} className="flex items-center gap-1">
                    <svg
                        className="w-4 h-4 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                    </svg>
                    <span
                        ref={countRef}
                        className="font-bold text-gray-900 dark:text-white transition-all duration-300"
                    >
                        {formatCount(clickCount)}
                    </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">clicks</span>
            </div>


        </div>
    );
};

export default LiveClickCounter;
