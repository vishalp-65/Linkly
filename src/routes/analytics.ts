import { Router, Request, Response, NextFunction } from 'express';
import { analyticsRepository } from '../repositories/AnalyticsRepository';
import { analyticsCacheService } from '../services/analyticsCacheService';
import { logger } from '../config/logger';
import { AnalyticsFilters } from '../types/database';

const router = Router();

// Validation middleware for date parameters
const validateDateRange = (req: Request, res: Response, next: NextFunction): void => {
    const { date_from, date_to } = req.query;

    if (date_from && isNaN(Date.parse(date_from as string))) {
        res.status(400).json({
            error: 'Invalid date_from format. Use YYYY-MM-DD format.',
        });
        return;
    }

    if (date_to && isNaN(Date.parse(date_to as string))) {
        res.status(400).json({
            error: 'Invalid date_to format. Use YYYY-MM-DD format.',
        });
        return;
    }

    // Ensure date_from is not after date_to
    if (date_from && date_to) {
        const fromDate = new Date(date_from as string);
        const toDate = new Date(date_to as string);

        if (fromDate > toDate) {
            res.status(400).json({
                error: 'date_from cannot be after date_to.',
            });
            return;
        }
    }

    next();
};

// GET /api/v1/analytics/{shortCode}
router.get('/:shortCode', validateDateRange, async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortCode } = req.params;
        const {
            date_from,
            date_to,
            country_code,
            device_type,
            no_cache
        } = req.query;

        // Validate short code format
        if (!/^[a-zA-Z0-9]{1,10}$/.test(shortCode)) {
            res.status(400).json({
                error: 'Invalid short code format.',
            });
            return;
        }

        const filters: AnalyticsFilters = {
            date_from: date_from ? new Date(date_from as string) : undefined,
            date_to: date_to ? new Date(date_to as string) : undefined,
            country_code: country_code as string,
            device_type: device_type as string,
        };

        const dateFromStr = filters.date_from?.toISOString().split('T')[0] ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateToStr = filters.date_to?.toISOString().split('T')[0] ||
            new Date().toISOString().split('T')[0];

        let analyticsData;

        // Check cache first (unless no_cache is specified)
        if (!no_cache) {
            analyticsData = await analyticsCacheService.getAnalytics(shortCode, dateFromStr, dateToStr);
        }

        // If not in cache, fetch from database
        if (!analyticsData) {
            analyticsData = await analyticsRepository.getAnalytics(shortCode, filters);

            // Cache the result
            await analyticsCacheService.setAnalytics(shortCode, dateFromStr, dateToStr, analyticsData);
        }

        // Apply additional filters if specified
        if (country_code) {
            analyticsData.topCountries = analyticsData.topCountries.filter(
                country => country.country.toLowerCase() === (country_code as string).toLowerCase()
            );
        }

        if (device_type) {
            analyticsData.deviceBreakdown = analyticsData.deviceBreakdown.filter(
                device => device.device.toLowerCase() === (device_type as string).toLowerCase()
            );
        }

        res.json({
            success: true,
            data: analyticsData,
        });

        logger.info('Analytics data retrieved', {
            shortCode,
            dateRange: `${dateFromStr} to ${dateToStr}`,
            totalClicks: analyticsData.totalClicks,
        });

    } catch (error) {
        logger.error('Failed to get analytics data', {
            shortCode: req.params.shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        res.status(500).json({
            error: 'Internal server error while retrieving analytics data.',
        });
    }
});

// GET /api/v1/analytics/{shortCode}/realtime
router.get('/:shortCode/realtime', async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortCode } = req.params;
        const { no_cache } = req.query;

        // Validate short code format
        if (!/^[a-zA-Z0-9]{1,10}$/.test(shortCode)) {
            res.status(400).json({
                error: 'Invalid short code format.',
            });
            return;
        }

        let realtimeData;

        // Check cache first (unless no_cache is specified)
        if (!no_cache) {
            realtimeData = await analyticsCacheService.getRealtimeAnalytics(shortCode);
        }

        // If not in cache, fetch from database
        if (!realtimeData) {
            realtimeData = await analyticsRepository.getRealtimeAnalytics(shortCode);

            // Cache the result for a short time
            await analyticsCacheService.setRealtimeAnalytics(shortCode, realtimeData);
        }

        res.json({
            success: true,
            data: realtimeData,
        });

        logger.debug('Realtime analytics data retrieved', {
            shortCode,
            currentHourClicks: realtimeData.currentHourClicks,
        });

    } catch (error) {
        logger.error('Failed to get realtime analytics data', {
            shortCode: req.params.shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        res.status(500).json({
            error: 'Internal server error while retrieving realtime analytics data.',
        });
    }
});

// GET /api/v1/analytics/global/summary
router.get('/global/summary', validateDateRange, async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            date_from,
            date_to,
            no_cache
        } = req.query;

        const filters: AnalyticsFilters = {
            date_from: date_from ? new Date(date_from as string) : undefined,
            date_to: date_to ? new Date(date_to as string) : undefined,
        };

        const dateFromStr = filters.date_from?.toISOString().split('T')[0] ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dateToStr = filters.date_to?.toISOString().split('T')[0] ||
            new Date().toISOString().split('T')[0];

        let globalData;

        // Check cache first (unless no_cache is specified)
        if (!no_cache) {
            globalData = await analyticsCacheService.getGlobalAnalytics(dateFromStr, dateToStr);
        }

        // If not in cache, fetch from database
        if (!globalData) {
            globalData = await analyticsRepository.getGlobalAnalytics(filters);

            // Cache the result
            await analyticsCacheService.setGlobalAnalytics(dateFromStr, dateToStr, globalData);
        }

        res.json({
            success: true,
            data: globalData,
        });

        logger.info('Global analytics data retrieved', {
            dateRange: `${dateFromStr} to ${dateToStr}`,
            totalClicks: globalData.totalClicks,
            totalUrls: globalData.totalUrls,
        });

    } catch (error) {
        logger.error('Failed to get global analytics data', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        res.status(500).json({
            error: 'Internal server error while retrieving global analytics data.',
        });
    }
});

// POST /api/v1/analytics/{shortCode}/invalidate-cache
router.post('/:shortCode/invalidate-cache', async (req: Request, res: Response): Promise<void> => {
    try {
        const { shortCode } = req.params;

        // Validate short code format
        if (!/^[a-zA-Z0-9]{1,10}$/.test(shortCode)) {
            res.status(400).json({
                error: 'Invalid short code format.',
            });
            return;
        }

        await analyticsCacheService.invalidateAnalytics(shortCode);

        res.json({
            success: true,
            message: 'Analytics cache invalidated successfully.',
        });

        logger.info('Analytics cache invalidated', { shortCode });

    } catch (error) {
        logger.error('Failed to invalidate analytics cache', {
            shortCode: req.params.shortCode,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(500).json({
            error: 'Internal server error while invalidating cache.',
        });
    }
});

// GET /api/v1/analytics/cache/stats
router.get('/cache/stats', async (req: Request, res: Response): Promise<void> => {
    try {
        const cacheStats = await analyticsCacheService.getCacheStats();

        res.json({
            success: true,
            data: cacheStats,
        });

    } catch (error) {
        logger.error('Failed to get cache stats', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        res.status(500).json({
            error: 'Internal server error while retrieving cache stats.',
        });
    }
});

export default router;