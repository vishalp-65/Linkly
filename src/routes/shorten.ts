import { Router, Request, Response } from 'express';
import { URLShortenerService } from '../services/urlShortenerService';
import { URLRepository } from '../repositories/URLRepository';
import { UserRepository } from '../repositories/UserRepository';
import { IDGenerator } from '../services/idGenerator';
import { URLCacheService } from '../services/urlCacheService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import Joi from 'joi';

const router = Router();

// Initialize services
const urlRepository = new URLRepository();
const userRepository = new UserRepository();
const idGenerator = IDGenerator.getInstance();
const cacheService = new URLCacheService();
const urlShortenerService = new URLShortenerService(
    urlRepository,
    userRepository,
    idGenerator,
    cacheService
);

// Request validation schema
const shortenRequestSchema = Joi.object({
    url: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .max(2048)
        .required()
        .messages({
            'string.uri': 'URL must be a valid HTTP or HTTPS URL',
            'string.max': 'URL cannot exceed 2048 characters',
            'any.required': 'URL is required'
        }),
    customAlias: Joi.string()
        .pattern(/^[a-zA-Z0-9_-]{3,50}$/)
        .optional()
        .messages({
            'string.pattern.base': 'Custom alias must be 3-50 characters long and contain only letters, numbers, hyphens, and underscores'
        }),
    expiryDays: Joi.number()
        .integer()
        .min(1)
        .max(3650) // Max 10 years
        .optional()
        .messages({
            'number.min': 'Expiry days must be at least 1',
            'number.max': 'Expiry days cannot exceed 3650 (10 years)'
        })
});

/**
 * POST /api/v1/shorten
 * Create a shortened URL
 */
router.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
        // Validate request body
        const { error, value } = shortenRequestSchema.validate(req.body);
        if (error) {
            res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: error.details[0].message,
                timestamp: new Date().toISOString()
            });
            return;
        }

        const { url, customAlias, expiryDays } = value;

        // Extract user ID from request (if authenticated)
        // This will be set by authentication middleware when implemented
        const userId = (req as any).userId || undefined;

        // Create short URL
        const result = await urlShortenerService.createShortUrl({
            longUrl: url,
            customAlias,
            userId,
            expiryDays
        });

        const responseTime = Date.now() - startTime;

        // Log successful creation
        logger.info('URL shortened successfully', {
            shortCode: result.shortCode,
            userId,
            customAlias: result.isCustomAlias,
            wasReused: result.wasReused,
            responseTime,
            longUrlLength: url.length
        });

        // Return success response
        res.status(201).json({
            success: true,
            data: {
                shortCode: result.shortCode,
                shortUrl: result.shortUrl,
                longUrl: result.longUrl,
                isCustomAlias: result.isCustomAlias,
                expiresAt: result.expiresAt,
                wasReused: result.wasReused,
                createdAt: new Date().toISOString()
            },
            meta: {
                responseTime,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        const responseTime = Date.now() - startTime;

        // Handle specific service errors
        if (error.code) {
            let statusCode = 500;
            let message = error.message;

            switch (error.code) {
                case 'INVALID_URL':
                    statusCode = 400;
                    break;
                case 'INVALID_ALIAS':
                    statusCode = 400;
                    break;
                case 'ALIAS_TAKEN':
                    statusCode = 409;
                    message = 'Custom alias is already taken';
                    break;
                case 'USER_NOT_FOUND':
                    statusCode = 404;
                    message = 'User not found';
                    break;
                case 'GENERATION_FAILED':
                    statusCode = 503;
                    message = 'Unable to generate unique short code, please try again';
                    break;
                case 'CREATION_FAILED':
                default:
                    statusCode = 500;
                    message = 'Failed to create short URL';
                    break;
            }

            logger.error('URL shortening failed', {
                error: error.code,
                message: error.message,
                details: error.details,
                userId: (req as any).userId,
                longUrl: req.body.url?.substring(0, 100),
                responseTime
            });

            res.status(statusCode).json({
                success: false,
                error: error.code,
                message,
                ...(error.details && { details: error.details }),
                meta: {
                    responseTime,
                    timestamp: new Date().toISOString()
                }
            });
            return;
        }

        // Handle unexpected errors
        logger.error('Unexpected error during URL shortening', {
            error: error.message,
            stack: error.stack,
            userId: (req as any).userId,
            longUrl: req.body.url?.substring(0, 100),
            responseTime
        });

        res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
            meta: {
                responseTime,
                timestamp: new Date().toISOString()
            }
        });
    }
}));

export default router;