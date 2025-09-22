import { Router, Request, Response } from 'express';
import { URLRedirectService } from '../services/urlRedirectService';
import { logger } from '../config/logger';

const router = Router();
const redirectService = new URLRedirectService();

/**
 * Handle short URL redirects
 * GET /:shortCode - Redirect to long URL
 */
router.get('/:shortCode', async (req: Request, res: Response) => {
    const { shortCode } = req.params;

    // Validate short code format
    if (!shortCode || shortCode.length < 3 || shortCode.length > 10) {
        return res.status(400).json({
            error: 'Invalid short code',
            message: 'Short code must be between 3 and 10 characters',
        });
    }

    // Handle redirect
    await redirectService.handleRedirect(req, res, shortCode);
    return; // Explicit return to satisfy TypeScript
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