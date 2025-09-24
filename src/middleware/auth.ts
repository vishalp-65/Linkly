import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { logger } from '../config/logger';
import { config } from '../config/environment';

/**
 * Authentication and Authorization Middleware
 * Requirements: 10.4 - API key validation, user ownership checks, anonymous and authenticated requests
 */

export interface AuthenticatedRequest extends Request {
    userId?: number;
    user?: any;
    userTier?: 'standard' | 'premium' | 'enterprise';
    apiKey?: string;
}

const userRepository = new UserRepository();

/**
 * Hash API key for secure storage comparison
 */
function hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req: Request): string | null {
    // Check X-API-Key header
    const apiKeyHeader = req.get('X-API-Key');
    if (apiKeyHeader) {
        return apiKeyHeader;
    }

    // Check Authorization header with Bearer token
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check query parameter (less secure, for testing only)
    const apiKeyQuery = req.query.api_key as string;
    if (apiKeyQuery) {
        return apiKeyQuery;
    }

    return null;
}

/**
 * Extract JWT token from request headers
 */
function extractJwtToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Simple check to see if it looks like a JWT (has 3 parts separated by dots)
        if (token.split('.').length === 3) {
            return token;
        }
    }
    return null;
}

/**
 * Verify JWT token
 */
async function verifyJwtToken(token: string): Promise<{ userId: number; userTier: string } | null> {
    try {
        const jwtSecret = config.security.jwtSecret || process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger.error('JWT secret not configured');
            return null;
        }

        const decoded = jwt.verify(token, jwtSecret) as any;

        if (!decoded.userId) {
            return null;
        }

        return {
            userId: decoded.userId,
            userTier: decoded.userTier || 'standard'
        };
    } catch (error) {
        logger.debug('JWT verification failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

/**
 * Authenticate user via API key
 */
async function authenticateApiKey(apiKey: string): Promise<{
    userId: number;
    user: any;
    userTier: string;
} | null> {
    try {
        const hashedApiKey = hashApiKey(apiKey);
        const user = await userRepository.findByApiKeyHash(hashedApiKey);

        if (!user || !user.is_active) {
            return null;
        }

        // Update last login timestamp
        await userRepository.updateLastLogin(user.user_id);

        return {
            userId: user.user_id,
            user,
            userTier: user.rate_limit_tier
        };
    } catch (error) {
        logger.error('API key authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

/**
 * Authenticate user via JWT token
 */
async function authenticateJwt(token: string): Promise<{
    userId: number;
    user: any;
    userTier: string;
} | null> {
    try {
        const tokenData = await verifyJwtToken(token);
        if (!tokenData) {
            return null;
        }

        const user = await userRepository.findById(tokenData.userId);
        if (!user || !user.is_active) {
            return null;
        }

        // Update last login timestamp
        await userRepository.updateLastLogin(user.user_id);

        return {
            userId: user.user_id,
            user,
            userTier: user.rate_limit_tier
        };
    } catch (error) {
        logger.error('JWT authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if no credentials provided
 */
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Try API key authentication first
        const apiKey = extractApiKey(req);
        if (apiKey) {
            const authResult = await authenticateApiKey(apiKey);
            if (authResult) {
                req.userId = authResult.userId;
                req.user = authResult.user;
                req.userTier = authResult.userTier as any;
                req.apiKey = apiKey;

                logger.debug('User authenticated via API key', {
                    userId: authResult.userId,
                    userTier: authResult.userTier
                });
            } else {
                logger.warn('Invalid API key provided', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });
            }
        } else {
            // Try JWT authentication
            const jwtToken = extractJwtToken(req);
            if (jwtToken) {
                const authResult = await authenticateJwt(jwtToken);
                if (authResult) {
                    req.userId = authResult.userId;
                    req.user = authResult.user;
                    req.userTier = authResult.userTier as any;

                    logger.debug('User authenticated via JWT', {
                        userId: authResult.userId,
                        userTier: authResult.userTier
                    });
                } else {
                    logger.warn('Invalid JWT token provided', {
                        ip: req.ip,
                        userAgent: req.get('User-Agent'),
                        path: req.path
                    });
                }
            }
        }

        next();
    } catch (error) {
        logger.error('Optional authentication error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            path: req.path,
            ip: req.ip
        });

        // Continue without authentication
        next();
    }
};

/**
 * Required authentication middleware
 * Fails if no valid credentials provided
 */
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        // Try API key authentication first
        const apiKey = extractApiKey(req);
        if (apiKey) {
            const authResult = await authenticateApiKey(apiKey);
            if (authResult) {
                req.userId = authResult.userId;
                req.user = authResult.user;
                req.userTier = authResult.userTier as any;
                req.apiKey = apiKey;

                logger.debug('User authenticated via API key', {
                    userId: authResult.userId,
                    userTier: authResult.userTier
                });

                return next();
            } else {
                logger.warn('Authentication failed - invalid API key', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });

                return res.status(401).json({
                    success: false,
                    error: 'INVALID_API_KEY',
                    message: 'Invalid API key provided',
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Try JWT authentication
        const jwtToken = extractJwtToken(req);
        if (jwtToken) {
            const authResult = await authenticateJwt(jwtToken);
            if (authResult) {
                req.userId = authResult.userId;
                req.user = authResult.user;
                req.userTier = authResult.userTier as any;

                logger.debug('User authenticated via JWT', {
                    userId: authResult.userId,
                    userTier: authResult.userTier
                });

                return next();
            } else {
                logger.warn('Authentication failed - invalid JWT token', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path
                });

                return res.status(401).json({
                    success: false,
                    error: 'INVALID_TOKEN',
                    message: 'Invalid or expired token',
                    timestamp: new Date().toISOString()
                });
            }
        }

        // No credentials provided
        logger.warn('Authentication required but no credentials provided', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });

        return res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required. Please provide a valid API key or JWT token.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Authentication middleware error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            path: req.path,
            ip: req.ip
        });

        return res.status(500).json({
            success: false,
            error: 'AUTHENTICATION_ERROR',
            message: 'An error occurred during authentication',
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Check if user has required tier
 */
export const requireTier = (requiredTier: 'standard' | 'premium' | 'enterprise') => {
    const tierLevels = { standard: 1, premium: 2, enterprise: 3 };

    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication is required',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const userTier = req.userTier || 'standard';
        const userLevel = tierLevels[userTier];
        const requiredLevel = tierLevels[requiredTier];

        if (userLevel < requiredLevel) {
            logger.warn('Insufficient tier access attempt', {
                userId: req.userId,
                userTier,
                requiredTier,
                path: req.path
            });

            res.status(403).json({
                success: false,
                error: 'INSUFFICIENT_TIER',
                message: `This feature requires ${requiredTier} tier or higher`,
                currentTier: userTier,
                requiredTier,
                timestamp: new Date().toISOString()
            });
            return;
        }

        next();
    };
};

/**
 * Check URL ownership
 */
export const requireUrlOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId) {
            res.status(401).json({
                success: false,
                error: 'AUTHENTICATION_REQUIRED',
                message: 'Authentication is required',
                timestamp: new Date().toISOString()
            });
            return;
        }

        const shortCode = req.params.shortCode;
        if (!shortCode) {
            res.status(400).json({
                success: false,
                error: 'MISSING_SHORT_CODE',
                message: 'Short code is required',
                timestamp: new Date().toISOString()
            });
            return;
        }

        // This would typically use URLRepository to check ownership
        // For now, we'll add the check to the route handlers
        next();

    } catch (error) {
        logger.error('URL ownership check error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.userId,
            shortCode: req.params.shortCode
        });

        res.status(500).json({
            success: false,
            error: 'OWNERSHIP_CHECK_FAILED',
            message: 'Failed to verify URL ownership',
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Generate API key for user
 */
export const generateApiKey = (): string => {
    // Generate a secure random API key
    const randomBytes = crypto.randomBytes(32);
    return randomBytes.toString('hex');
};

/**
 * Generate JWT token for user
 */
export const generateJwtToken = (userId: number, userTier: string = 'standard'): string => {
    const jwtSecret = config.security.jwtSecret || process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT secret not configured');
    }

    return jwt.sign(
        {
            userId,
            userTier,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        },
        jwtSecret
    );
};

/**
 * Validate API key format
 */
export const isValidApiKeyFormat = (apiKey: string): boolean => {
    // API keys should be 64 character hex strings
    return /^[a-f0-9]{64}$/.test(apiKey);
};

/**
 * Admin authentication middleware
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.userId) {
        res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // Check if user has admin role (this would be stored in user record)
    const isAdmin = req.user?.is_admin || false;
    if (!isAdmin) {
        logger.warn('Admin access attempt by non-admin user', {
            userId: req.userId,
            path: req.path,
            ip: req.ip
        });

        res.status(403).json({
            success: false,
            error: 'ADMIN_REQUIRED',
            message: 'Administrator privileges are required',
            timestamp: new Date().toISOString()
        });
        return;
    }

    next();
};

export default {
    optionalAuth,
    requireAuth,
    requireTier,
    requireUrlOwnership,
    requireAdmin,
    generateApiKey,
    generateJwtToken,
    isValidApiKeyFormat,
    hashApiKey
};