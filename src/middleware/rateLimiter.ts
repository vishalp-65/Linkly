import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

/**
 * Rate Limiting Middleware using Token Bucket Algorithm
 * Requirements: 10.1 - 100 requests/minute per IP, different limits for authenticated users
 */

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Maximum requests per window
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
    statusCode?: number;
}

export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
}

export class TokenBucketRateLimiter {
    private config: Required<RateLimitConfig>;

    constructor(config: RateLimitConfig) {
        this.config = {
            windowMs: config.windowMs,
            maxRequests: config.maxRequests,
            keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
            skipSuccessfulRequests: config.skipSuccessfulRequests || false,
            skipFailedRequests: config.skipFailedRequests || false,
            message: config.message || 'Too many requests, please try again later',
            statusCode: config.statusCode || 429
        };
    }

    /**
     * Default key generator - uses IP address
     */
    private defaultKeyGenerator(req: Request): string {
        return `rate_limit:${req.ip}`;
    }

    /**
     * Generate rate limit key for authenticated users
     */
    private authenticatedKeyGenerator(req: Request): string {
        const userId = (req as any).userId;
        if (userId) {
            return `rate_limit:user:${userId}`;
        }
        return `rate_limit:${req.ip}`;
    }

    /**
     * Get current token bucket state
     */
    private async getTokenBucket(key: string): Promise<{
        tokens: number;
        lastRefill: number;
        resetTime: number;
    }> {
        try {
            const bucketData = await redis.hgetall(key);

            if (!bucketData.tokens) {
                // Initialize new bucket
                const now = Date.now();
                const resetTime = now + this.config.windowMs;

                const bucket = {
                    tokens: this.config.maxRequests,
                    lastRefill: now,
                    resetTime
                };

                await redis.hmset(key, bucket);
                await redis.expire(key, Math.ceil(this.config.windowMs / 1000));

                return bucket;
            }

            return {
                tokens: parseInt(bucketData.tokens, 10),
                lastRefill: parseInt(bucketData.lastRefill, 10),
                resetTime: parseInt(bucketData.resetTime, 10)
            };
        } catch (error) {
            logger.error('Failed to get token bucket from Redis', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Fallback: allow request if Redis is unavailable
            return {
                tokens: this.config.maxRequests,
                lastRefill: Date.now(),
                resetTime: Date.now() + this.config.windowMs
            };
        }
    }

    /**
     * Refill tokens based on elapsed time
     */
    private refillTokens(bucket: {
        tokens: number;
        lastRefill: number;
        resetTime: number;
    }): { tokens: number; lastRefill: number; resetTime: number } {
        const now = Date.now();

        // If reset time has passed, reset the bucket
        if (now >= bucket.resetTime) {
            return {
                tokens: this.config.maxRequests,
                lastRefill: now,
                resetTime: now + this.config.windowMs
            };
        }

        // Calculate tokens to add based on elapsed time
        const elapsedMs = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(
            (elapsedMs / this.config.windowMs) * this.config.maxRequests
        );

        if (tokensToAdd > 0) {
            return {
                tokens: Math.min(bucket.tokens + tokensToAdd, this.config.maxRequests),
                lastRefill: now,
                resetTime: bucket.resetTime
            };
        }

        return bucket;
    }

    /**
     * Consume a token from the bucket
     */
    private async consumeToken(key: string): Promise<{
        allowed: boolean;
        rateLimitInfo: RateLimitInfo;
    }> {
        try {
            // Get current bucket state
            let bucket = await this.getTokenBucket(key);

            // Refill tokens
            bucket = this.refillTokens(bucket);

            // Check if request is allowed
            const allowed = bucket.tokens > 0;

            if (allowed) {
                bucket.tokens -= 1;
            }

            // Update bucket in Redis
            await redis.hmset(key, bucket);
            await redis.expire(key, Math.ceil(this.config.windowMs / 1000));

            const rateLimitInfo: RateLimitInfo = {
                limit: this.config.maxRequests,
                remaining: Math.max(0, bucket.tokens),
                resetTime: new Date(bucket.resetTime),
                retryAfter: allowed ? undefined : Math.ceil((bucket.resetTime - Date.now()) / 1000)
            };

            return { allowed, rateLimitInfo };
        } catch (error) {
            logger.error('Failed to consume token from bucket', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Fallback: allow request if Redis is unavailable
            return {
                allowed: true,
                rateLimitInfo: {
                    limit: this.config.maxRequests,
                    remaining: this.config.maxRequests - 1,
                    resetTime: new Date(Date.now() + this.config.windowMs)
                }
            };
        }
    }

    /**
     * Create middleware function
     */
    middleware() {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                const key = this.config.keyGenerator(req);
                const { allowed, rateLimitInfo } = await this.consumeToken(key);

                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
                    'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitInfo.resetTime.toISOString()
                });

                if (rateLimitInfo.retryAfter) {
                    res.set('Retry-After', rateLimitInfo.retryAfter.toString());
                }

                if (!allowed) {
                    logger.warn('Rate limit exceeded', {
                        key,
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        path: req.path,
                        method: req.method,
                        limit: rateLimitInfo.limit,
                        resetTime: rateLimitInfo.resetTime
                    });

                    res.status(this.config.statusCode).json({
                        success: false,
                        error: 'RATE_LIMIT_EXCEEDED',
                        message: this.config.message,
                        rateLimitInfo: {
                            limit: rateLimitInfo.limit,
                            remaining: rateLimitInfo.remaining,
                            resetTime: rateLimitInfo.resetTime,
                            retryAfter: rateLimitInfo.retryAfter
                        },
                        timestamp: new Date().toISOString()
                    });
                    return;
                }

                // Log rate limit info for monitoring
                if (rateLimitInfo.remaining < 10) {
                    logger.debug('Rate limit warning', {
                        key,
                        remaining: rateLimitInfo.remaining,
                        limit: rateLimitInfo.limit,
                        path: req.path
                    });
                }

                next();
            } catch (error) {
                logger.error('Rate limiter middleware error', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    path: req.path,
                    method: req.method,
                    ip: req.ip
                });

                // Allow request to proceed if rate limiter fails
                next();
            }
        };
    }
}

/**
 * Rate limiter configurations for different tiers
 */
export const rateLimitConfigs = {
    // Anonymous users: 100 requests per minute
    anonymous: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
        message: 'Too many requests from this IP, please try again later'
    },

    // Standard authenticated users: 1000 requests per minute
    standard: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 1000,
        keyGenerator: (req: Request) => {
            const userId = (req as any).userId;
            return userId ? `rate_limit:user:${userId}` : `rate_limit:${req.ip}`;
        },
        message: 'Rate limit exceeded for your account tier'
    },

    // Premium users: 5000 requests per minute
    premium: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 5000,
        keyGenerator: (req: Request) => {
            const userId = (req as any).userId;
            return userId ? `rate_limit:user:${userId}` : `rate_limit:${req.ip}`;
        },
        message: 'Rate limit exceeded for your account tier'
    },

    // Enterprise users: 20000 requests per minute
    enterprise: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 20000,
        keyGenerator: (req: Request) => {
            const userId = (req as any).userId;
            return userId ? `rate_limit:user:${userId}` : `rate_limit:${req.ip}`;
        },
        message: 'Rate limit exceeded for your account tier'
    },

    // Strict rate limiting for sensitive operations
    strict: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 10,
        message: 'Too many attempts, please try again later'
    }
};

/**
 * Create rate limiter instances
 */
export const rateLimiters = {
    anonymous: new TokenBucketRateLimiter(rateLimitConfigs.anonymous),
    standard: new TokenBucketRateLimiter(rateLimitConfigs.standard),
    premium: new TokenBucketRateLimiter(rateLimitConfigs.premium),
    enterprise: new TokenBucketRateLimiter(rateLimitConfigs.enterprise),
    strict: new TokenBucketRateLimiter(rateLimitConfigs.strict)
};

/**
 * Adaptive rate limiter that chooses the appropriate limiter based on user tier
 */
export const adaptiveRateLimit = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).userId;
        const userTier = (req as any).userTier || 'anonymous';

        let rateLimiter: TokenBucketRateLimiter;

        switch (userTier) {
            case 'enterprise':
                rateLimiter = rateLimiters.enterprise;
                break;
            case 'premium':
                rateLimiter = rateLimiters.premium;
                break;
            case 'standard':
                rateLimiter = rateLimiters.standard;
                break;
            default:
                rateLimiter = rateLimiters.anonymous;
                break;
        }

        return rateLimiter.middleware()(req, res, next);
    } catch (error) {
        logger.error('Adaptive rate limiter error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (req as any).userId,
            userTier: (req as any).userTier
        });

        // Fall back to anonymous rate limiter
        return rateLimiters.anonymous.middleware()(req, res, next);
    }
};

/**
 * Get rate limit status for a key
 */
export const getRateLimitStatus = async (key: string): Promise<RateLimitInfo | null> => {
    try {
        const bucketData = await redis.hgetall(key);

        if (!bucketData.tokens) {
            return null;
        }

        const bucket = {
            tokens: parseInt(bucketData.tokens, 10),
            lastRefill: parseInt(bucketData.lastRefill, 10),
            resetTime: parseInt(bucketData.resetTime, 10)
        };

        return {
            limit: rateLimitConfigs.anonymous.maxRequests, // Default limit
            remaining: Math.max(0, bucket.tokens),
            resetTime: new Date(bucket.resetTime)
        };
    } catch (error) {
        logger.error('Failed to get rate limit status', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
};

/**
 * Clear rate limit for a key (admin function)
 */
export const clearRateLimit = async (key: string): Promise<boolean> => {
    try {
        await redis.del(key);
        logger.info('Rate limit cleared', { key });
        return true;
    } catch (error) {
        logger.error('Failed to clear rate limit', {
            key,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
};

export default {
    TokenBucketRateLimiter,
    rateLimiters,
    adaptiveRateLimit,
    getRateLimitStatus,
    clearRateLimit
};