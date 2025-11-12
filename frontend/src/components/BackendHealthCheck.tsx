import React, { useEffect, useState, useRef } from 'react';

interface BackendHealthCheckProps {
    children: React.ReactNode;
}

interface LogEntry {
    id: number;
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

const BackendHealthCheck: React.FC<BackendHealthCheckProps> = ({ children }) => {
    const skipHealthCheck = import.meta.env.VITE_SKIP_HEALTH_CHECK === 'true';

    const [isBackendReady, setIsBackendReady] = useState(skipHealthCheck);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [checkAttempts, setCheckAttempts] = useState(0);
    const [showRetryButton, setShowRetryButton] = useState(false);

    const logsEndRef = useRef<HTMLDivElement>(null);
    const healthCheckIntervalRef = useRef<any>(null);
    const logTimeoutsRef = useRef<any[]>([]);

    const getHealthEndpoint = () => {
        const baseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:3000/api/v1';
        const rootUrl = baseUrl.replace(/\/api\/v1$/, '');
        return `${rootUrl}/health`;
    };

    const HEALTH_ENDPOINT = getHealthEndpoint();
    const MAX_ATTEMPTS = 30;
    const HEALTH_CHECK_INTERVAL = 3000;
    const INITIAL_DELAY = 2000;

    const logMessages = [
        { message: 'INCOMING HTTP REQUEST DETECTED ...', type: 'info' as const, delay: 0 },
        { message: 'SERVICE WAKING UP ...', type: 'info' as const, delay: 1500 },
        { message: 'ALLOCATING COMPUTE RESOURCES ...', type: 'info' as const, delay: 3500 },
        { message: 'PREPARING INSTANCE FOR INITIALIZATION ...', type: 'info' as const, delay: 6000 },
        { message: 'STARTING THE INSTANCE ...', type: 'info' as const, delay: 9000 },
        { message: 'ENVIRONMENT VARIABLES INJECTED ...', type: 'info' as const, delay: 12500 },
        { message: 'CONNECTING TO DATABASE ...', type: 'info' as const, delay: 16000 },
        { message: 'FINALIZING STARTUP ...', type: 'info' as const, delay: 20000 },
        { message: 'OPTIMIZING DEPLOYMENT ...', type: 'info' as const, delay: 24000 },
        { message: 'CHECKING BACKEND STATUS ...', type: 'info' as const, delay: 28000 },
        { message: 'STEADY HANDS. CLEAN LOGS. YOUR APP IS ALMOST LIVE ...', type: 'warning' as const, delay: 32000 },
    ];

    const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const timestamp = new Date().toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            timestamp,
            message,
            type
        }]);
    };

    // Auto-scroll to bottom when new logs appear
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Display logs progressively with proper cleanup
    useEffect(() => {
        if (skipHealthCheck || isBackendReady) return;

        logMessages.forEach((log) => {
            const timeout = setTimeout(() => {
                if (!isBackendReady) {
                    addLog(log.message, log.type);
                }
            }, log.delay);
            logTimeoutsRef.current.push(timeout);
        });

        return () => {
            logTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
            logTimeoutsRef.current = [];
        };
    }, [skipHealthCheck, isBackendReady]);

    // Check backend health
    const checkBackendHealth = async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(HEALTH_ENDPOINT, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                addLog('✅ BACKEND IS READY. LAUNCHING APPLICATION ...', 'success');
                setTimeout(() => setIsBackendReady(true), 1000);
                return true;
            }
            return false;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Health check timed out, retrying...');
            }
            return false;
        }
    };

    // Health check polling with proper cleanup
    useEffect(() => {
        if (skipHealthCheck || isBackendReady) return;

        const startHealthChecks = async () => {
            // Initial check
            const isHealthy = await checkBackendHealth();
            if (isHealthy) return;

            setCheckAttempts(1);

            // Set up polling
            healthCheckIntervalRef.current = setInterval(async () => {
                if (isBackendReady) {
                    if (healthCheckIntervalRef.current) {
                        clearInterval(healthCheckIntervalRef.current);
                    }
                    return;
                }

                setCheckAttempts(prev => {
                    const newAttempts = prev + 1;

                    if (newAttempts >= MAX_ATTEMPTS) {
                        if (healthCheckIntervalRef.current) {
                            clearInterval(healthCheckIntervalRef.current);
                        }
                        addLog('⚠️  BACKEND TAKING LONGER THAN EXPECTED.', 'error');
                        addLog('💡 TIP: The service might be cold starting. This can take up to 2 minutes.', 'warning');
                        setShowRetryButton(true);
                        return newAttempts;
                    }

                    return newAttempts;
                });

                await checkBackendHealth();
            }, HEALTH_CHECK_INTERVAL);
        };

        const initialTimeout = setTimeout(startHealthChecks, INITIAL_DELAY);

        return () => {
            clearTimeout(initialTimeout);
            if (healthCheckIntervalRef.current) {
                clearInterval(healthCheckIntervalRef.current);
            }
        };
    }, [skipHealthCheck, isBackendReady]);

    const handleRetry = () => {
        setLogs([]);
        setCheckAttempts(0);
        setShowRetryButton(false);
        addLog('🔄 RETRYING CONNECTION ...', 'info');
    };

    if (isBackendReady) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-black text-gray-300 font-mono flex flex-col items-center justify-center p-4 overflow-hidden">
            {/* ASCII Art Logo */}
            <div className="mb-8 text-center">
                <pre className="text-gray-500 text-xs sm:text-sm md:text-base leading-tight select-none">
                    {`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗  ║
║   ██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║  ║
║   ██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║  ║
║   ██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║  ║
║   ╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║  ║
║    ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝  ║
║                                                           ║
║                        TO LINKLY                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`}
                </pre>
            </div>

            {/* Logs Container */}
            <div className="w-full max-w-4xl bg-gray-900 rounded-lg border border-gray-800 shadow-2xl overflow-hidden">
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-gray-400 text-sm ml-2">Backend Initialization</span>
                </div>

                <div className="p-6 h-96 overflow-y-auto custom-scrollbar">
                    {logs.length === 0 && (
                        <div className="text-gray-500 text-center py-8">
                            <p>Initializing backend connection...</p>
                        </div>
                    )}

                    {logs.map((log) => (
                        <div
                            key={log.id}
                            className={`mb-2 animate-fade-in ${log.type === 'success' ? 'text-green-400' :
                                log.type === 'error' ? 'text-red-400' :
                                    log.type === 'warning' ? 'text-yellow-400' :
                                        'text-gray-300'
                                }`}
                        >
                            <span className="text-gray-500">{log.timestamp}</span>
                            <span className="ml-3">{log.message}</span>
                        </div>
                    ))}

                    <div ref={logsEndRef} />

                    {/* Blinking cursor */}
                    {!isBackendReady && !showRetryButton && (
                        <div className="inline-block w-2 h-4 bg-gray-400 animate-blink ml-1"></div>
                    )}
                </div>
            </div>

            {/* Progress indicator or Retry button */}
            <div className="mt-6 text-center">
                {showRetryButton ? (
                    <button
                        onClick={handleRetry}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors duration-200 shadow-lg"
                    >
                        🔄 Retry Connection
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-2 justify-center mb-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                        <p className="text-gray-500 text-sm">
                            {checkAttempts < MAX_ATTEMPTS
                                ? `Waiting for backend to wake up... (${checkAttempts}/${MAX_ATTEMPTS})`
                                : 'Backend connection timeout'}
                        </p>
                        {checkAttempts > 10 && checkAttempts < MAX_ATTEMPTS && (
                            <p className="text-gray-600 text-xs mt-2">
                                Cold start detected. This may take 1-2 minutes on first request.
                            </p>
                        )}
                    </>
                )}
            </div>

            <style>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes blink {
                    0%, 50% {
                        opacity: 1;
                    }
                    51%, 100% {
                        opacity: 0;
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }

                .animate-blink {
                    animation: blink 1s infinite;
                }

                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }

                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #1f2937;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #4b5563;
                    border-radius: 4px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                }
            `}</style>
        </div>
    );
};

export default BackendHealthCheck;