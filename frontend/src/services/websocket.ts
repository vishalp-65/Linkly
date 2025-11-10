import { io, Socket } from 'socket.io-client';

export interface ClickEvent {
    shortCode: string;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
    country?: string;
}

class WebSocketService {
    private socket: Socket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private activeSubscriptions: Map<string, Set<Function>> = new Map(); // Track active subscriptions

    connect(apiKey?: string): Socket {
        if (this.socket?.connected) {
            return this.socket;
        }

        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

        this.socket = io(wsUrl, {
            auth: apiKey ? { token: apiKey } : undefined,
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });

        this.setupEventHandlers();
        return this.socket;
    }

    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('WebSocket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect automatically
                return;
            }
            this.handleReconnect();
        });

        this.socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            this.handleReconnect();
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('WebSocket reconnected after', attemptNumber, 'attempts');
            this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('WebSocket reconnection error:', error);
        });
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            this.socket?.connect();
        }, delay);
    }

    subscribeToClicks(shortCode: string, callback: (event: ClickEvent) => void): void {
        if (!this.socket) {
            console.error('WebSocket not connected');
            return;
        }

        // Check if this callback is already subscribed
        const subscriptions = this.activeSubscriptions.get(shortCode);
        if (subscriptions?.has(callback)) {
            console.log(`Already subscribed to click events for ${shortCode}, skipping duplicate`);
            return;
        }

        console.log(`Subscribing to click events for ${shortCode}`);

        // Subscribe to click events for this specific short code (only if first subscriber)
        if (!subscriptions || subscriptions.size === 0) {
            this.socket.emit('subscribe', { shortCode });
        }

        // Create a wrapper that filters by shortCode to avoid cross-contamination
        const wrappedCallback = (event: ClickEvent) => {
            if (event.shortCode === shortCode) {
                console.log('WebSocket received click event for', shortCode, event);
                callback(event);
            }
        };

        // Store the wrapper so we can remove it later
        (callback as any).__wrapper = wrappedCallback;

        // Track this subscription
        if (!this.activeSubscriptions.has(shortCode)) {
            this.activeSubscriptions.set(shortCode, new Set());
        }
        this.activeSubscriptions.get(shortCode)!.add(callback);

        // Listen for click events
        this.socket.on('click', wrappedCallback);

        console.log(`Successfully subscribed to click events for ${shortCode} (total: ${this.activeSubscriptions.get(shortCode)!.size})`);
    }

    unsubscribeFromClicks(shortCode: string, callback?: (event: ClickEvent) => void): void {
        if (!this.socket) return;

        // Remove the specific callback wrapper
        if (callback) {
            const wrapper = (callback as any).__wrapper;
            if (wrapper) {
                this.socket.off('click', wrapper);
                delete (callback as any).__wrapper;
            } else {
                this.socket.off('click', callback);
            }

            // Remove from tracking
            const subscriptions = this.activeSubscriptions.get(shortCode);
            if (subscriptions) {
                subscriptions.delete(callback);

                // Only unsubscribe from server if no more callbacks for this shortCode
                if (subscriptions.size === 0) {
                    this.activeSubscriptions.delete(shortCode);
                    this.socket.emit('unsubscribe', { shortCode });
                    console.log(`Unsubscribed from click events for ${shortCode} (no more subscribers)`);
                } else {
                    console.log(`Removed callback for ${shortCode} (${subscriptions.size} remaining)`);
                }
            }
        } else {
            // Remove all callbacks for this shortCode
            this.socket.off('click');
            this.activeSubscriptions.delete(shortCode);
            this.socket.emit('unsubscribe', { shortCode });
            console.log(`Unsubscribed from all click events for ${shortCode}`);
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    getSocket(): Socket | null {
        return this.socket;
    }
}

// Export a singleton instance
export const websocketService = new WebSocketService();
export default websocketService;