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

        // Subscribe to click events for this specific short code
        this.socket.emit('subscribe', { shortCode });

        // Listen for click events
        this.socket.on('click', callback);

        console.log(`Subscribed to click events for ${shortCode}`);
    }

    unsubscribeFromClicks(shortCode: string, callback?: (event: ClickEvent) => void): void {
        if (!this.socket) return;

        // Unsubscribe from click events for this short code
        this.socket.emit('unsubscribe', { shortCode });

        // Remove the specific callback or all click listeners
        if (callback) {
            this.socket.off('click', callback);
        } else {
            this.socket.off('click');
        }

        console.log(`Unsubscribed from click events for ${shortCode}`);
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