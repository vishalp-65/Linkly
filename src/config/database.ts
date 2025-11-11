import dotenv from "dotenv"
// Load environment variables first
dotenv.config()

import { Pool, PoolConfig } from "pg"
import { logger } from "./logger"
import * as fs from "fs"
import * as path from "path"

interface DatabaseConfig extends PoolConfig {
    host: string
    port: number
    database: string
    user: string
    password: string
    min: number
    max: number
    connectionTimeoutMillis: number
    idleTimeoutMillis: number
}

// Read SSL certificate from environment variable or file
let sslConfig: any = false
if (process.env.NODE_ENV === "production") {
    try {
        // First try environment variable (for Vercel/cloud deployments)
        if (process.env.DB_SSL_CA) {
            // Handle both escaped newlines (\n) and actual newlines
            const ca = process.env.DB_SSL_CA.replace(/\\n/g, "\n")
            sslConfig = { rejectUnauthorized: true, ca }
            logger.info("Using SSL certificate from environment variable")
        }
        // Fallback to ca.pem file (for local production testing)
        else {
            const caPath = path.join(__dirname, "../../ca.pem")
            if (fs.existsSync(caPath)) {
                const ca = fs.readFileSync(caPath, "utf8")
                sslConfig = { rejectUnauthorized: true, ca }
                logger.info("Using SSL certificate from ca.pem file")
            } else {
                logger.warn("Production mode but no SSL certificate found")
            }
            logger.warn("Production mode but no SSL certificate found")
        }
    } catch (error) {
        logger.error("Error loading SSL certificate", {
            error: error instanceof Error ? error.message : "Unknown error"
        })
    }
}

const config: DatabaseConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "url_shortener",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
    min: parseInt(process.env.DB_POOL_MIN || "2"),
    max: parseInt(process.env.DB_POOL_MAX || "10"),
    connectionTimeoutMillis: parseInt(
        process.env.DB_CONNECTION_TIMEOUT || "30000"
    ),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || "30000"),
    ssl: sslConfig
}

class DatabaseConnection {
    private pool: Pool
    private static instance: DatabaseConnection

    private constructor() {
        this.pool = new Pool(config)
        this.setupEventHandlers()
    }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection()
        }
        return DatabaseConnection.instance
    }

    private setupEventHandlers(): void {
        this.pool.on("connect", (_client) => {
            logger.info("New database client connected", {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            })
        })

        this.pool.on("error", (err, _client) => {
            logger.error("Database pool error", {
                error: err.message,
                stack: err.stack,
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            })
        })

        this.pool.on("acquire", (_client) => {
            logger.debug("Database client acquired from pool", {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            })
        })

        this.pool.on("release", (_client) => {
            logger.debug("Database client released back to pool", {
                totalCount: this.pool.totalCount,
                idleCount: this.pool.idleCount,
                waitingCount: this.pool.waitingCount
            })
        })
    }

    public getPool(): Pool {
        return this.pool
    }

    public async query(text: string, params?: any[]): Promise<any> {
        const start = Date.now()
        try {
            const result = await this.pool.query(text, params)
            const duration = Date.now() - start

            logger.debug("Database query executed", {
                query:
                    text.substring(0, 100) + (text.length > 100 ? "..." : ""),
                duration,
                rowCount: result.rowCount
            })

            return result
        } catch (error) {
            const duration = Date.now() - start
            logger.error("Database query failed", {
                query:
                    text.substring(0, 100) + (text.length > 100 ? "..." : ""),
                duration,
                error: error instanceof Error ? error.message : "Unknown error",
                stack: error instanceof Error ? error.stack : undefined
            })
            throw error
        }
    }

    public async getClient() {
        return await this.pool.connect()
    }

    public async healthCheck(): Promise<boolean> {
        try {
            const result = await this.query("SELECT 1 as health_check")
            return result.rows[0].health_check === 1
        } catch (error) {
            logger.error("Database health check failed", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return false
        }
    }

    public async close(): Promise<void> {
        try {
            await this.pool.end()
            logger.info("Database connection pool closed")
        } catch (error) {
            logger.error("Error closing database connection pool", {
                error: error instanceof Error ? error.message : "Unknown error"
            })
            throw error
        }
    }

    public getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        }
    }
}

export const db = DatabaseConnection.getInstance()
export default db
