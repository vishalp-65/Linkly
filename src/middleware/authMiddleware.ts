import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { JwtPayload, USER_PERMISSIONS, GUEST_PERMISSIONS } from '../types/user.types';

// Extend Express Request interface to include user data and permissions
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            isGuest?: boolean;
            permissions?: typeof USER_PERMISSIONS | typeof GUEST_PERMISSIONS;
        }
    }
}

export class AuthMiddleware {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    /**
     * Middleware: Require authentication (access token must be valid)
     */
    authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw ApiError.unauthorized('Access token required');
            }

            const token = authHeader.substring(7);
            const decoded = this.authService.verifyAccessToken(token);

            // Ensure user still exists and is active
            const user = await this.authService.getUserById(decoded.userId);
            if (!user || !user.isActive) {
                throw ApiError.unauthorized('User not found or inactive');
            }

            req.user = decoded;
            req.isGuest = false;
            req.permissions = USER_PERMISSIONS;

            next();
        } catch (error: any) {
            logger.warn('Authentication failed', {
                path: req.path,
                method: req.method,
                message: error.message || 'Unknown error'
            });

            next(ApiError.unauthorized('Authentication failed'));
        }
    };

    /**
     * Middleware: Optional authentication (allows guests)
     */
    optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                // No token → treat as guest
                req.isGuest = true;
                req.permissions = GUEST_PERMISSIONS;
                return next();
            }

            const token = authHeader.substring(7);

            try {
                const decoded = this.authService.verifyAccessToken(token);
                const user = await this.authService.getUserById(decoded.userId);

                if (!user || !user.isActive) {
                    req.isGuest = true;
                    req.permissions = GUEST_PERMISSIONS;
                    return next();
                }

                req.user = decoded;
                req.isGuest = false;
                req.permissions = USER_PERMISSIONS;
            } catch {
                // Invalid token → guest access
                req.isGuest = true;
                req.permissions = GUEST_PERMISSIONS;
            }

            next();
        } catch (error: any) {
            logger.error('Optional authentication error', {
                path: req.path,
                method: req.method,
                message: error.message || 'Unknown error'
            });

            req.isGuest = true;
            req.permissions = GUEST_PERMISSIONS;
            next();
        }
    };

    /**
     * Middleware: Require admin role
     */
    requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(ApiError.unauthorized('Authentication required'));
        }

        if (req.user.role !== 'admin') {
            return next(ApiError.forbidden('Admin access required'));
        }

        next();
    };

    /**
     * Middleware: Require authenticated (non-guest) user
     */
    requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
        if (req.isGuest || !req.user) {
            return next(ApiError.unauthorized('Authentication required'));
        }
        next();
    };

    /**
     * Middleware: Require specific permission
     */
    requirePermission = (permission: keyof typeof USER_PERMISSIONS) => {
        return (req: Request, _res: Response, next: NextFunction): void => {
            if (!req.permissions) {
                return next(ApiError.unauthorized('Authentication required'));
            }

            if (!req.permissions[permission]) {
                return next(
                    ApiError.forbidden(
                        req.isGuest
                            ? 'This feature requires user registration'
                            : 'You do not have permission to access this feature'
                    )
                );
            }

            next();
        };
    };

    /**
     * Middleware: Rate limiting stub by user type
     * (Can be replaced by Redis or token-bucket based rate limiter)
     */
    rateLimitByUserType = (_req: Request, _res: Response, next: NextFunction): void => {
        // TODO: Implement actual rate-limiting based on req.permissions.maxUrlsPerDay, etc.
        next();
    };
}

// Singleton instance for global middleware usage
export const authMiddleware = new AuthMiddleware();
