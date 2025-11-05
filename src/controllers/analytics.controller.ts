import { Request, Response, NextFunction } from 'express';
import { analyticsRepository } from '../repositories/AnalyticsRepository';
import { analyticsCacheService } from '../services/analyticsCacheService';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';
import { AnalyticsFilters } from '../types/database';

export class AnalyticsController {
    getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { shortCode } = req.params;
            const { date_from, date_to, country_code, device_type, no_cache } = req.query;

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

            if (!no_cache) {
                analyticsData = await analyticsCacheService.getAnalytics(shortCode, dateFromStr, dateToStr);
            }

            if (!analyticsData) {
                analyticsData = await analyticsRepository.getAnalytics(shortCode, filters);
                await analyticsCacheService.setAnalytics(shortCode, dateFromStr, dateToStr, analyticsData);
            }

            // Apply client-side filters
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

            logger.info('Analytics data retrieved', {
                shortCode,
                dateRange: `${dateFromStr} to ${dateToStr}`,
                totalClicks: analyticsData.totalClicks,
            });

            ApiResponse.success(res, analyticsData);

        } catch (error) {
            next(error);
        }
    };

    getRealtimeAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { shortCode } = req.params;
            const { no_cache } = req.query;

            let realtimeData;

            if (!no_cache) {
                realtimeData = await analyticsCacheService.getRealtimeAnalytics(shortCode);
            }

            if (!realtimeData) {
                realtimeData = await analyticsRepository.getRealtimeAnalytics(shortCode);
                await analyticsCacheService.setRealtimeAnalytics(shortCode, realtimeData);
            }

            logger.debug('Realtime analytics data retrieved', {
                shortCode,
                currentHourClicks: realtimeData.currentHourClicks,
            });

            ApiResponse.success(res, realtimeData);

        } catch (error) {
            next(error);
        }
    };

    getGlobalAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { date_from, date_to, no_cache } = req.query;

            const filters: AnalyticsFilters = {
                date_from: date_from ? new Date(date_from as string) : undefined,
                date_to: date_to ? new Date(date_to as string) : undefined,
            };

            const dateFromStr = filters.date_from?.toISOString().split('T')[0] ||
                new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const dateToStr = filters.date_to?.toISOString().split('T')[0] ||
                new Date().toISOString().split('T')[0];

            let globalData;

            if (!no_cache) {
                globalData = await analyticsCacheService.getGlobalAnalytics(dateFromStr, dateToStr);
            }

            if (!globalData) {
                globalData = await analyticsRepository.getGlobalAnalytics(filters);
                await analyticsCacheService.setGlobalAnalytics(dateFromStr, dateToStr, globalData);
            }

            logger.info('Global analytics data retrieved', {
                dateRange: `${dateFromStr} to ${dateToStr}`,
                totalClicks: globalData.totalClicks,
                totalUrls: globalData.totalUrls,
            });

            ApiResponse.success(res, globalData);

        } catch (error) {
            next(error);
        }
    };

    invalidateCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { shortCode } = req.params;

            await analyticsCacheService.invalidateAnalytics(shortCode);

            logger.info('Analytics cache invalidated', { shortCode });

            ApiResponse.success(res, {
                message: 'Analytics cache invalidated successfully.'
            });

        } catch (error) {
            next(error);
        }
    };

    getCacheStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const cacheStats = await analyticsCacheService.getCacheStats();
            ApiResponse.success(res, cacheStats);
        } catch (error) {
            next(error);
        }
    };
}