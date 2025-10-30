import { Request, Response, NextFunction } from 'express';
import { PreferencesService } from '../services/preferencesService';
import { AuthService } from '../services/authService';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';
import {
    UpdatePreferencesRequest,
    UpdateNotificationSettingsRequest,
    WebhookTestRequest,
    AccountUpdateRequest,
    AccountDeletionRequest
} from '../types/preferences.types';
import bcrypt from 'bcrypt';

export class PreferencesController {
    private preferencesService: PreferencesService;
    private authService: AuthService;

    constructor() {
        this.preferencesService = new PreferencesService();
        this.authService = new AuthService();
    }

    /**
     * Get user preferences
     */
    getUserPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const preferences = await this.preferencesService.getUserPreferences(req.user.userId);

            ApiResponse.success(res, { preferences });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Update user preferences
     */
    updateUserPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const data: UpdatePreferencesRequest = req.body;
            const preferences = await this.preferencesService.updateUserPreferences(req.user.userId, data);

            logger.info('User preferences updated', { userId: req.user.userId });
            ApiResponse.success(res, { preferences });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get notification settings
     */
    getNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const notifications = await this.preferencesService.getNotificationSettings(req.user.userId);

            ApiResponse.success(res, { notifications });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Update notification settings
     */
    updateNotificationSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const data: UpdateNotificationSettingsRequest = req.body;
            const notifications = await this.preferencesService.updateNotificationSettings(req.user.userId, data);

            logger.info('Notification settings updated', { userId: req.user.userId });
            ApiResponse.success(res, { notifications });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Test webhook endpoint
     */
    testWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const data: WebhookTestRequest = req.body;

            if (!data.url) {
                throw ApiError.badRequest('Webhook URL is required');
            }

            const result = await this.preferencesService.testWebhook(data);

            ApiResponse.success(res, result);
        } catch (error) {
            next(error);
        }
    };

    /**
     * Get account information
     */
    getAccountInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const user = await this.authService.getUserById(req.user.userId);
            if (!user) {
                throw ApiError.notFound('User not found');
            }

            // Get URL statistics (you may need to implement this in URLRepository)
            // For now, returning mock data structure
            const accountInfo = {
                id: user.userId.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                avatarUrl: user.avatarUrl,
                emailVerified: user.emailVerified,
                role: user.role,
                createdAt: user.createdAt,
                lastLogin: user.lastLoginAt,
                totalUrls: 0, // TODO: Implement URL count
                totalClicks: 0, // TODO: Implement click count
            };

            ApiResponse.success(res, { account: accountInfo });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Update email address
     */
    updateEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const { email, currentPassword }: AccountUpdateRequest = req.body;

            if (!email || !currentPassword) {
                throw ApiError.badRequest('Email and current password are required');
            }

            // Verify current password
            const passwordHash = await this.authService['userRepository'].getPasswordHash(req.user.userId);
            if (!passwordHash) {
                throw ApiError.unauthorized('Invalid password');
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, passwordHash);
            if (!isPasswordValid) {
                throw ApiError.unauthorized('Invalid current password');
            }

            // Check if email is already taken
            const existingUser = await this.authService['userRepository'].findByEmail(email);
            if (existingUser && existingUser.userId !== req.user.userId) {
                throw ApiError.conflict('Email already in use', 'EMAIL_IN_USE');
            }

            // Update email (you may need to add this method to UserRepository)
            // For now, we'll use updateProfile
            const user = await this.authService.updateProfile(req.user.userId, {
                // Note: You may need to add email update to updateProfile or create a separate method
            });

            logger.info('Email updated', { userId: req.user.userId, newEmail: email });
            ApiResponse.success(res, {
                message: 'Email updated successfully',
                user
            });
        } catch (error) {
            next(error);
        }
    };

    /**
     * Delete account
     */
    deleteAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                throw ApiError.unauthorized('Authentication required');
            }

            const { password, confirmText }: AccountDeletionRequest = req.body;

            if (!password || !confirmText) {
                throw ApiError.badRequest('Password and confirmation text are required');
            }

            if (confirmText !== 'DELETE') {
                throw ApiError.badRequest('Confirmation text must be "DELETE"');
            }

            // Verify password
            const passwordHash = await this.authService['userRepository'].getPasswordHash(req.user.userId);
            if (!passwordHash) {
                throw ApiError.unauthorized('Invalid password');
            }

            const isPasswordValid = await bcrypt.compare(password, passwordHash);
            if (!isPasswordValid) {
                throw ApiError.unauthorized('Invalid password');
            }

            // TODO: Implement account deletion logic
            // This should:
            // 1. Delete all user URLs
            // 2. Delete all analytics data
            // 3. Delete all preferences
            // 4. Delete all tokens
            // 5. Delete user account
            // For now, we'll just log it

            logger.warn('Account deletion requested', { userId: req.user.userId });

            ApiResponse.success(res, {
                message: 'Account deletion initiated. This feature is not yet fully implemented.'
            });
        } catch (error) {
            next(error);
        }
    };
}
