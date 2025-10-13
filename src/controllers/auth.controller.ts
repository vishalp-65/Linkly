import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';
import {
    CreateUserRequest,
    LoginRequest,
    ResetPasswordRequest,
    ConfirmResetPasswordRequest,
    ChangePasswordRequest,
    UpdateProfileRequest
} from '../types/user.types';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const startTime = Date.now();
        try {
            const userData: CreateUserRequest = req.body;

            if (!userData.email || !userData.password) {
                throw ApiError.badRequest('Email and password are required');
            }
            if (userData.password.length < 8) {
                throw ApiError.badRequest('Password must be at least 8 characters long');
            }

            const result = await this.authService.register(userData);
            const responseTime = Date.now() - startTime;

            logger.info('User registered successfully', {
                email: result.user.email,
                responseTime
            });

            ApiResponse.created(res, {
                user: result.user,
                tokens: result.tokens
            }, { responseTime });

        } catch (error) {
            next(error);
        }
    };

    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const startTime = Date.now();
        try {
            const loginData: LoginRequest = req.body;

            if (!loginData.email || !loginData.password) {
                throw ApiError.badRequest('Email and password are required');
            }

            const result = await this.authService.login(loginData);
            const responseTime = Date.now() - startTime;

            logger.info('User login successful', {
                email: result.user.email,
                responseTime
            });

            ApiResponse.success(res, {
                user: result.user,
                tokens: result.tokens
            }, 200, { responseTime });

        } catch (error) {
            next(error);
        }
    };

    refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                throw ApiError.badRequest('Refresh token is required');
            }

            const tokens = await this.authService.refreshToken(refreshToken);

            ApiResponse.success(res, { tokens }, 200);
        } catch (error) {
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { refreshToken } = req.body;

            if (refreshToken) {
                await this.authService.logout(refreshToken);
            }

            ApiResponse.success(res, { message: 'Logout successful' });
        } catch (error) {
            logger.warn('Logout encountered an error but continuing', { error });
            ApiResponse.success(res, { message: 'Logout successful' });
        }
    };

    requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { email }: ResetPasswordRequest = req.body;

            if (!email) {
                throw ApiError.badRequest('Email is required');
            }

            await this.authService.requestPasswordReset({ email });

            ApiResponse.success(res, {
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        } catch (error) {
            logger.error('Password reset request error', { error });
            // Always return success to prevent email enumeration
            ApiResponse.success(res, {
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        }
    };

    confirmPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { token, newPassword }: ConfirmResetPasswordRequest = req.body;

            if (!token || !newPassword) {
                throw ApiError.badRequest('Token and new password are required');
            }
            if (newPassword.length < 8) {
                throw ApiError.badRequest('Password must be at least 8 characters long');
            }

            await this.authService.confirmPasswordReset({ token, newPassword });

            ApiResponse.success(res, { message: 'Password reset successful' });
        } catch (error) {
            next(error);
        }
    };

    changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

            if (!currentPassword || !newPassword) {
                throw ApiError.badRequest('Current password and new password are required');
            }
            if (newPassword.length < 8) {
                throw ApiError.badRequest('Password must be at least 8 characters long');
            }

            await this.authService.changePassword(req.user.userId, { currentPassword, newPassword });

            ApiResponse.success(res, { message: 'Password changed successfully' });
        } catch (error) {
            next(error);
        }
    };

    getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const user = await this.authService.getUserById(req.user.userId);
            if (!user) throw ApiError.notFound('User not found');

            ApiResponse.success(res, { user });
        } catch (error) {
            next(error);
        }
    };

    updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const updateData: UpdateProfileRequest = req.body;
            const user = await this.authService.updateProfile(req.user.userId, updateData);

            ApiResponse.success(res, {
                message: 'Profile updated successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    };

    getPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            ApiResponse.success(res, {
                permissions: req.permissions,
                isGuest: req.isGuest,
                user: req.user
                    ? {
                        userId: req.user.userId,
                        email: req.user.email,
                        role: req.user.role,
                    }
                    : null,
            });
        } catch (error) {
            next(error);
        }
    };
}
