import { Request, Response, NextFunction } from "express"
import { URLRedirectService } from "../services/urlRedirectService"
import { ApiResponse } from "../utils/ApiResponse"
import { logger } from "../config/logger"

export class RedirectController {
    private redirectService: URLRedirectService

    constructor() {
        this.redirectService = new URLRedirectService()
    }

    handleRedirect = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const startTime = Date.now()
        const { shortCode } = req.params
        const requestId = Math.random().toString(36).substring(7)

        console.log("=== REDIRECT CONTROLLER CALLED ===", {
            requestId,
            shortCode,
            url: req.url,
            method: req.method,
            userAgent: req.get("User-Agent")?.substring(0, 50),
            referer: req.get("Referer")
        })

        try {
            const result = await this.redirectService.handleRedirect(
                req,
                res,
                shortCode
            )
            const responseTime = Date.now() - startTime

            console.log("=== REDIRECT COMPLETED ===", {
                requestId,
                shortCode,
                responseTime,
                statusCode: result?.statusCode || "unknown"
            })

            if (responseTime > 50) {
                logger.warn("Slow redirect response", {
                    requestId,
                    shortCode,
                    responseTime,
                    statusCode: result?.statusCode || "unknown"
                })
            } else {
                logger.debug("Redirect handled", {
                    requestId,
                    shortCode,
                    responseTime,
                    statusCode: result?.statusCode || "unknown"
                })
            }
        } catch (error) {
            const responseTime = Date.now() - startTime

            console.log("=== REDIRECT FAILED ===", {
                requestId,
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error"
            })

            logger.error("Redirect handling failed", {
                requestId,
                shortCode,
                error: error instanceof Error ? error.message : "Unknown error",
                responseTime
            })

            next(error)
        }
    }

    getStats = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const metrics = this.redirectService.getPerformanceMetrics()
            ApiResponse.success(res, metrics)
        } catch (error) {
            next(error)
        }
    }

    healthCheck = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const health = await this.redirectService.healthCheck()
            const isHealthy = health.service && health.cache.overall

            res.status(isHealthy ? 200 : 503).json({
                success: isHealthy,
                timestamp: new Date().toISOString(),
                health
            })
        } catch (error) {
            next(error)
        }
    }
}
