import { Router, Request, Response } from 'express';
import { URLRepository } from '../repositories/URLRepository';
import { URLCacheService } from '../services/urlCacheService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// Initialize services
const urlRepository = new URLRepository();
const cacheService = new URLCacheService();

/**
 * DELETE /api/v1/url/{shortCode}
 * Soft delete URL mapping
 * Requirements: 4.4 - User authentication and ownership validation
 */
router.delete('/:shortCode', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const { shortCode } = req.params;

    try {
        // Validate short code format
        if (!shortCode || !/^[a-zA-Z0-9_-]{3,10}$/.test(shortCode)) {
            res.status(400).json({
                success: false,
                error: 'INVALID_SHORT_CODE',
                message: 'Short code must be 3-10 characters long and contain only letters, numbers, hyphens, and underscores',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Get authenticated user ID (set by authentication middleware)
        const userId = (req as any).userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication is required to delete URLs',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Check if URL exists and get ownership info
        const urlMapping = await urlRepository.findById(shortCode);
        if (!urlMapping) {
            res.status(404).json({
                success: false,
                error: 'URL_NOT_FOUND',
                message: 'The specified short URL does not exist',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Check if URL is already deleted
        if (urlMapping.is_deleted) {
            res.status(404).json({
                success: false,
                error: 'URL_NOT_FOUND',
                message: 'The specified short URL does not exist',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Verify ownership - only the creator can delete the URL
        if (urlMapping.user_id !== userId) {
            logger.warn('Unauthorized URL deletion attempt', {
                shortCode,
                requestingUserId: userId,
                ownerUserId: urlMapping.user_id,
                ip: req.ip
            });

            res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_PERMISSIONS',
                message: 'You do not have permission to delete this URL',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Perform soft delete
        const deleted = await urlRepository.delete(shortCode);
        if (!deleted) {
            res.status(500).json({
                success: false,
                error: 'DELETION_FAILED',
                message: 'Failed to delete the URL',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Invalidate cache entries
        try {
            await cacheService.removeCachedUrlMapping(shortCode);
            logger.debug('Cache invalidated for deleted URL', { shortCode });
        } catch (cacheError) {
            // Log cache error but don't fail the request
            logger.warn('Failed to invalidate cache after URL deletion', {
                shortCode,
                error: cacheError instanceof Error ? cacheError.message : 'Unknown error'
            });
        }

        const responseTime = Date.now() - startTime;

        logger.info('URL deleted successfully', {
            shortCode,
            userId,
            responseTime,
            longUrl: urlMapping.long_url.substring(0, 100) // Log first 100 chars only
        });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'URL deleted successfully',
            data: {
                shortCode,
                deletedAt: new Date().toISOString()
            },
            meta: {
                responseTime,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        const responseTime = Date.now() - startTime;

        logger.error('URL deletion failed', {
            shortCode,
            userId: (req as any).userId,
            error: error.message,
            stack: error.stack,
            responseTime
        });

        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred while deleting the URL',
            meta: {
                responseTime,
                timestamp: new Date().toISOString()
            }
        });
    }
}));

export default router;