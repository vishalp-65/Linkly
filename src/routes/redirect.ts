import { Router, Request, Response } from 'express';
import { URLRedirectService } from '../services/urlRedirectService';
import { logger } from '../config/logger';

const router = Router();
const redirectService = new URLRedirectService();

/**
 * Handle short URL redirects
 * GET /:shortCode - Redirect to long URL
 * Requirements: 2.1, 2.2, 2.3, 2.4 - Sub-50ms response time, proper HTTP status codes
 */
router.get('/:shortCode', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { shortCode } = req.params;

    try {
        // Validate short code format (alphanumeric, 3-10 characters)
        if (!shortCode || !/^[a-zA-Z0-9_-]{3,10}$/.test(shortCode)) {
            const responseTime = Date.now() - startTime;
            logger.warn('Invalid short code format', {
                shortCode,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                responseTime
            });

            return res.status(400).json({
                success: false,
                error: 'INVALID_SHORT_CODE',
                message: 'Short code must be 3-10 characters long and contain only letters, numbers, hyphens, and underscores',
                timestamp: new Date().toISOString()
            });
        }

        // Handle redirect with performance tracking
        const result = await redirectService.handleRedirect(req, res, shortCode);
        const responseTime = Date.now() - startTime;

        // Log performance metrics (only if slow or for monitoring)
        if (responseTime > 50) {
            logger.warn('Slow redirect response', {
                shortCode,
                responseTime,
                statusCode: result?.statusCode || 'unknown',
                cacheSource: result?.cacheSource || 'unknown'
            });
        } else {
            logger.debug('Redirect handled', {
                shortCode,
                responseTime,
                statusCode: result?.statusCode || 'unknown',
                cacheSource: result?.cacheSource || 'unknown'
            });
        }

        return; // Explicit return to satisfy TypeScript
    } catch (error) {
        const responseTime = Date.now() - startTime;

        logger.error('Redirect handling failed', {
            shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            responseTime,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        // Return 500 for unexpected errors
        return res.status(500).json({
            success: false,
            error: 'REDIRECT_FAILED',
            message: 'An error occurred while processing the redirect',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * Resolve URL without redirecting (API endpoint)
 * GET /api/resolve/:shortCode - Get URL info without redirect
 */
router.get('/api/resolve/:shortCode', async (req: Request, res: Response) => {
    const { shortCode } = req.params;

    try {
        // Validate short code format
        if (!shortCode || shortCode.length < 3 || shortCode.length > 10) {
            return res.status(400).json({
                error: 'Invalid short code',
                message: 'Short code must be between 3 and 10 characters',
            });
        }

        const result = await redirectService.resolveUrl(shortCode);

        switch (result.status) {
            case 'found':
                return res.json({
                    success: true,
                    shortCode,
                    longUrl: result.urlMapping!.long_url,
                    createdAt: result.urlMapping!.created_at,
                    expiresAt: result.urlMapping!.expires_at,
                    accessCount: result.urlMapping!.access_count,
                    lastAccessedAt: result.urlMapping!.last_accessed_at,
                    latency: result.latency,
                });

            case 'not_found':
                return res.status(404).json({
                    error: 'URL not found',
                    message: 'The requested short URL does not exist',
                    shortCode,
                    latency: result.latency,
                });

            case 'expired':
                return res.status(410).json({
                    error: 'URL expired',
                    message: 'The requested short URL has expired',
                    shortCode,
                    latency: result.latency,
                });

            case 'deleted':
                return res.status(404).json({
                    error: 'URL not found',
                    message: 'The requested short URL does not exist',
                    shortCode,
                    latency: result.latency,
                });

            default:
                return res.status(500).json({
                    error: 'Internal server error',
                    message: 'An unexpected error occurred',
                    shortCode,
                });
        }

    } catch (error) {
        logger.error('Error resolving URL', {
            shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            error: 'Internal server error',
            message: 'An error occurred while resolving the URL',
            shortCode,
        });
    }
});

/**
 * Get redirect service statistics
 * GET /api/redirect/stats - Get performance metrics
 */
router.get('/api/redirect/stats', async (req: Request, res: Response) => {
    try {
        const metrics = redirectService.getPerformanceMetrics();

        return res.json({
            success: true,
            timestamp: new Date().toISOString(),
            metrics,
        });

    } catch (error) {
        logger.error('Error getting redirect stats', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(500).json({
            error: 'Internal server error',
            message: 'An error occurred while retrieving statistics',
        });
    }
});

/**
 * Health check for redirect service
 * GET /api/redirect/health - Check service health
 */
router.get('/api/redirect/health', async (req: Request, res: Response) => {
    try {
        const health = await redirectService.healthCheck();

        const statusCode = health.service && health.cache.overall ? 200 : 503;

        return res.status(statusCode).json({
            success: health.service && health.cache.overall,
            timestamp: new Date().toISOString(),
            health,
        });

    } catch (error) {
        logger.error('Error checking redirect service health', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return res.status(503).json({
            success: false,
            error: 'Health check failed',
            message: 'An error occurred during health check',
        });
    }
});

export default router;