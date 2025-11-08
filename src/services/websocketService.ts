import { Server as HTTPServer } from "http"
import { Server as SocketIOServer, Socket } from "socket.io"
import { logger } from "../config/logger"
import { config } from "../config/environment"
import jwt from "jsonwebtoken"

export interface AnalyticsClickEvent {
    shortCode: string
    timestamp: string
    country?: string
    device?: string
    browser?: string
    referrer?: string
    ipAddress?: string
}

class WebSocketService {
    private io: SocketIOServer | null = null
    private connectedClients: Map<string, Set<string>> = new Map() // shortCode -> Set of socketIds

    /**
     * Initialize WebSocket server
     */
    public initialize(httpServer: HTTPServer): void {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: config.isDevelopment
                    ? "*"
                    : process.env.ALLOWED_ORIGINS?.split(",") || "*",
                credentials: true,
                methods: ["GET", "POST"]
            },
            transports: ["websocket", "polling"],
            pingTimeout: 60000,
            pingInterval: 25000
        })

        this.setupEventHandlers()
        logger.info("WebSocket service initialized")
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers(): void {
        if (!this.io) return

        this.io.on("connection", (socket: Socket) => {
            logger.info("Client connected", {
                socketId: socket.id,
                transport: socket.conn.transport.name
            })

            // Authenticate the connection
            this.authenticateSocket(socket)

            // Handle subscription to analytics for a specific short code
            socket.on("subscribe", (data: { shortCode: string }) => {
                this.handleSubscribe(socket, data.shortCode)
            })

            // Handle unsubscription
            socket.on("unsubscribe", (data: { shortCode: string }) => {
                this.handleUnsubscribe(socket, data.shortCode)
            })

            // Handle disconnection
            socket.on("disconnect", (reason) => {
                logger.info("Client disconnected", {
                    socketId: socket.id,
                    reason
                })
                this.handleDisconnect(socket)
            })

            // Handle errors
            socket.on("error", (error) => {
                logger.error("Socket error", {
                    socketId: socket.id,
                    error: error.message
                })
            })
        })
    }

    /**
     * Authenticate socket connection
     */
    private authenticateSocket(socket: Socket): void {
        try {
            const token = socket.handshake.auth?.token

            if (!token) {
                // Allow unauthenticated connections but with limited access
                socket.data.authenticated = false
                socket.data.userId = null
                return
            }

            // Verify JWT token
            const decoded = jwt.verify(token, config.jwtSecret) as any
            socket.data.authenticated = true
            socket.data.userId = decoded.userId

            logger.info("Socket authenticated", {
                socketId: socket.id,
                userId: decoded.userId
            })
        } catch (error) {
            logger.warn("Socket authentication failed", {
                socketId: socket.id,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            socket.data.authenticated = false
            socket.data.userId = null
        }
    }

    /**
     * Handle subscription to analytics for a short code
     */
    private handleSubscribe(socket: Socket, shortCode: string): void {
        if (!shortCode) {
            socket.emit("error", { message: "Short code is required" })
            return
        }

        console.log("WEBSOCKET: Client subscribing", {
            socketId: socket.id,
            shortCode,
            currentSubscribers: this.connectedClients.get(shortCode)?.size || 0
        })

        // Join room for this short code
        socket.join(`analytics:${shortCode}`)

        // Track subscription
        if (!this.connectedClients.has(shortCode)) {
            this.connectedClients.set(shortCode, new Set())
        }
        this.connectedClients.get(shortCode)!.add(socket.id)

        console.log("WEBSOCKET: Client subscribed successfully", {
            socketId: socket.id,
            shortCode,
            totalSubscribers: this.connectedClients.get(shortCode)?.size || 0
        })

        logger.info("Client subscribed to analytics", {
            socketId: socket.id,
            shortCode,
            userId: socket.data.userId
        })

        socket.emit("subscribed", { shortCode })
    }

    /**
     * Handle unsubscription from analytics
     */
    private handleUnsubscribe(socket: Socket, shortCode: string): void {
        if (!shortCode) return

        // Leave room
        socket.leave(`analytics:${shortCode}`)

        // Remove from tracking
        const clients = this.connectedClients.get(shortCode)
        if (clients) {
            clients.delete(socket.id)
            if (clients.size === 0) {
                this.connectedClients.delete(shortCode)
            }
        }

        logger.info("Client unsubscribed from analytics", {
            socketId: socket.id,
            shortCode
        })

        socket.emit("unsubscribed", { shortCode })
    }

    /**
     * Handle client disconnection
     */
    private handleDisconnect(socket: Socket): void {
        // Remove from all subscriptions
        this.connectedClients.forEach((clients, shortCode) => {
            if (clients.has(socket.id)) {
                clients.delete(socket.id)
                if (clients.size === 0) {
                    this.connectedClients.delete(shortCode)
                }
            }
        })
    }

    /**
     * Emit a click event to all subscribers of a short code
     */
    public emitClickEvent(event: AnalyticsClickEvent): void {
        if (!this.io) {
            console.log("WEBSOCKET: Service not initialized")
            logger.warn("WebSocket service not initialized, cannot emit click event")
            return
        }

        const room = `analytics:${event.shortCode}`
        const subscriberCount = this.connectedClients.get(event.shortCode)?.size || 0
        const emitId = Math.random().toString(36).substring(7)

        console.log("WEBSOCKET: Emitting click event", {
            emitId,
            shortCode: event.shortCode,
            room,
            subscriberCount,
            timestamp: event.timestamp,
            country: event.country,
            device: event.device,
            browser: event.browser,
            stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
        })

        // Emit comprehensive click event to all clients in the room
        this.io.to(room).emit("click", {
            shortCode: event.shortCode,
            timestamp: event.timestamp,
            country: event.country || "Unknown",
            device: event.device || "Unknown",
            browser: event.browser || "Unknown",
            referrer: event.referrer || "(direct)"
        })

        console.log("WEBSOCKET: Click event emitted to", subscriberCount, "subscribers", { emitId })

        logger.debug("Click event emitted", {
            emitId,
            shortCode: event.shortCode,
            subscriberCount,
            country: event.country,
            device: event.device
        })
    }

    /**
     * Emit analytics update to subscribers
     */
    public emitAnalyticsUpdate(shortCode: string, data: any): void {
        if (!this.io) return

        const room = `analytics:${shortCode}`
        this.io.to(room).emit("analytics:update", {
            shortCode,
            data,
            timestamp: new Date().toISOString()
        })
    }

    /**
     * Get active subscriber count for a short code
     */
    public getSubscriberCount(shortCode: string): number {
        return this.connectedClients.get(shortCode)?.size || 0
    }

    /**
     * Get total connected clients
     */
    public getTotalConnections(): number {
        return this.io?.sockets.sockets.size || 0
    }

    /**
     * Get statistics
     */
    public getStats(): {
        totalConnections: number
        activeSubscriptions: number
        subscriptionsByShortCode: Record<string, number>
    } {
        const subscriptionsByShortCode: Record<string, number> = {}
        this.connectedClients.forEach((clients, shortCode) => {
            subscriptionsByShortCode[shortCode] = clients.size
        })

        return {
            totalConnections: this.getTotalConnections(),
            activeSubscriptions: this.connectedClients.size,
            subscriptionsByShortCode
        }
    }

    /**
     * Shutdown WebSocket service
     */
    public async shutdown(): Promise<void> {
        if (this.io) {
            logger.info("Shutting down WebSocket service...")

            // Disconnect all clients
            this.io.disconnectSockets(true)

            // Close server
            await new Promise<void>((resolve) => {
                this.io!.close(() => {
                    logger.info("WebSocket service shut down")
                    resolve()
                })
            })

            this.io = null
            this.connectedClients.clear()
        }
    }
}

export const websocketService = new WebSocketService()
export default websocketService
