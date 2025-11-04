import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/metricsService';
import { logger } from '../config/logger';

/**
 * Middleware to collect HTTP request metrics for Prometheus
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Get the route pattern for better grouping
    const route = getRoutePattern(req);

    // Override res.end to capture metrics when response is sent
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
        const duration = Date.now() - startTime;

        try {
            // Record HTTP request metrics
            metricsService.recordHttpRequest(
                req.method,
                route,
                res.statusCode,
                duration
            );

            // Log slow requests
            if (duration > 1000) {
                logger.warn('Slow HTTP request', {
                    method: req.method,
                    route,
                    statusCode: res.statusCode,
                    duration,
                    userAgent: req.get('User-Agent'),
                    ip: req.ip,
                });
            }
        } catch (error) {
            logger.error('Failed to record HTTP metrics', {
                error: error instanceof Error ? error.message : 'Unknown error',
                method: req.method,
                route,
            });
        }

        // Call original end method
        return originalEnd(...args);
    };

    next();
};

/**
 * Get route pattern for metrics grouping
 * This helps group similar routes together (e.g., /api/v1/analytics/:shortCode)
 */
function getRoutePattern(req: Request): string {
    // If route is available from Express router, use it
    if (req.route && req.route.path) {
        const baseUrl = req.baseUrl || '';
        return baseUrl + req.route.path;
    }

    // Otherwise, try to normalize the path
    const path = req.path;

    // Health check endpoints
    if (path === '/health' || path === '/ready' || path === '/live') {
        return path;
    }

    // Metrics endpoint
    if (path === '/metrics') {
        return '/metrics';
    }

    // API endpoints
    if (path.startsWith('/api/v1/')) {
        // Shorten endpoint
        if (path === '/api/v1/shorten') {
            return '/api/v1/shorten';
        }

        // Analytics endpoints
        if (path.startsWith('/api/v1/analytics/')) {
            return '/api/v1/analytics/:shortCode';
        }

        // URL management endpoints
        if (path.startsWith('/api/v1/url/')) {
            return '/api/v1/url/:shortCode';
        }

        // Generic API pattern
        return '/api/v1/*';
    }

    // Redirect endpoints (short codes)
    if (path.length > 1 && !path.includes('/')) {
        return '/:shortCode';
    }

    // Root endpoint
    if (path === '/') {
        return '/';
    }

    // Default to the actual path for unknown patterns
    return path;
}

/**
 * Middleware to skip metrics collection for certain routes
 */
export const skipMetrics = (req: Request, res: Response, next: NextFunction): void => {
    // Skip metrics collection for the metrics endpoint itself to avoid recursion
    if (req.path === '/metrics') {
        return next();
    }

    // Apply metrics middleware
    metricsMiddleware(req, res, next);
};

/**
 * Express middleware to update active connections count
 */
export const connectionCounterMiddleware = (() => {
    let activeConnections = 0;

    return (req: Request, res: Response, next: NextFunction): void => {
        activeConnections++;
        metricsService.updateActiveConnections(activeConnections);

        // Decrease counter when response finishes
        res.on('finish', () => {
            activeConnections--;
            metricsService.updateActiveConnections(activeConnections);
        });

        // Decrease counter if connection is closed prematurely
        res.on('close', () => {
            activeConnections--;
            metricsService.updateActiveConnections(activeConnections);
        });

        next();
    };
})();