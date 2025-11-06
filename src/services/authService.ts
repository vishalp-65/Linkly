import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/environment';
import { logger } from '../config/logger';
import {
    User,
    CreateUserRequest,
    LoginRequest,
    AuthTokens,
    JwtPayload,
    ResetPasswordRequest,
    ConfirmResetPasswordRequest,
    ChangePasswordRequest,
    UpdateProfileRequest
} from '../types/user.types';
import { UserRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';

export class AuthService {
    private userRepository: UserRepository;
    private readonly saltRounds = 12;
    private readonly accessTokenExpiry = '1d';
    private readonly refreshTokenExpiry = '15d';

    constructor() {
        this.userRepository = new UserRepository();
    }

    /**
     * Register a new user
     */
    async register(userData: CreateUserRequest): Promise<{ user: User; tokens: AuthTokens }> {
        const existingUser = await this.userRepository.findByEmail(userData.email);
        if (existingUser) throw ApiError.conflict('User already exists with this email', 'USER_EXISTS');

        const passwordHash = await bcrypt.hash(userData.password, this.saltRounds);
        const user = await this.userRepository.create({ ...userData, passwordHash });

        const tokens = await this.generateTokens(user);
        await this.userRepository.updateLastLogin(user.userId);

        logger.info('User registered successfully', { userId: user.userId, email: user.email });
        return { user, tokens };
    }

    /**
     * Login user with email and password
     */
    async login(loginData: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
        const user = await this.userRepository.findByEmail(loginData.email);
        if (!user) throw ApiError.unauthorized('Invalid email or password');

        if (!user.isActive) throw ApiError.unauthorized('Account is deactivated');

        const passwordHash = await this.userRepository.getPasswordHash(user.userId);
        if (!passwordHash) throw ApiError.unauthorized('Invalid email or password');

        const isPasswordValid = await bcrypt.compare(loginData.password, passwordHash);
        if (!isPasswordValid) throw ApiError.unauthorized('Invalid email or password');

        const tokens = await this.generateTokens(user);
        await this.userRepository.updateLastLogin(user.userId);

        logger.info('User login successful', { userId: user.userId, email: user.email });
        return { user, tokens };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshToken: string): Promise<AuthTokens> {
        try {
            const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as JwtPayload;

            const tokenRecord = await this.userRepository.findRefreshToken(refreshToken);
            if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
                throw ApiError.unauthorized('Invalid or expired refresh token');
            }

            const user = await this.userRepository.findById(decoded.userId);
            if (!user || !user.isActive) {
                throw ApiError.unauthorized('User not found or inactive');
            }

            await this.userRepository.revokeRefreshToken(refreshToken);
            const tokens = await this.generateTokens(user);

            logger.info('Token refreshed successfully', { userId: user.userId });
            return tokens;

        } catch (error: any) {
            logger.error('Token refresh failed', { error: error.message });
            if (error instanceof ApiError) throw error;
            throw ApiError.unauthorized('Invalid refresh token');
        }
    }

    /**
     * Logout user by revoking refresh token
     */
    async logout(refreshToken: string): Promise<void> {
        try {
            await this.userRepository.revokeRefreshToken(refreshToken);
            logger.info('User logged out successfully');
        } catch (error: any) {
            logger.error('Logout failed', { error: error.message });
            throw ApiError.internal('Failed to log out user');
        }
    }

    /**
     * Request password reset
     */
    async requestPasswordReset(data: ResetPasswordRequest): Promise<void> {
        const user = await this.userRepository.findByEmail(data.email);
        if (!user) {
            logger.info('Password reset requested for non-existent email', { email: data.email });
            return;
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await this.userRepository.createPasswordResetToken(user.userId, resetToken, expiresAt);

        // TODO: integrate with mail service
        logger.info('Password reset token generated', { userId: user.userId, email: user.email });
    }

    /**
     * Confirm password reset
     */
    async confirmPasswordReset(data: ConfirmResetPasswordRequest): Promise<void> {
        const tokenRecord = await this.userRepository.findPasswordResetToken(data.token);
        if (!tokenRecord || tokenRecord.used || tokenRecord.expiresAt < new Date()) {
            throw ApiError.badRequest('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
        }

        const passwordHash = await bcrypt.hash(data.newPassword, this.saltRounds);

        await this.userRepository.updatePassword(tokenRecord.userId, passwordHash);
        await this.userRepository.markPasswordResetTokenUsed(data.token);
        await this.userRepository.revokeAllRefreshTokens(tokenRecord.userId);

        logger.info('Password reset successful', { userId: tokenRecord.userId });
    }

    /**
     * Change password for authenticated user
     */
    async changePassword(userId: number, data: ChangePasswordRequest): Promise<void> {
        const currentPasswordHash = await this.userRepository.getPasswordHash(userId);
        if (!currentPasswordHash) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

        const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, currentPasswordHash);
        if (!isCurrentPasswordValid) throw ApiError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');

        const newPasswordHash = await bcrypt.hash(data.newPassword, this.saltRounds);
        await this.userRepository.updatePassword(userId, newPasswordHash);
        await this.userRepository.revokeAllRefreshTokens(userId);

        logger.info('Password changed successfully', { userId });
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: number, data: UpdateProfileRequest): Promise<User> {
        const user = await this.userRepository.updateProfile(userId, data);
        if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');

        logger.info('Profile updated successfully', { userId });
        return user;
    }

    /**
     * Get user by ID
     */
    async getUserById(userId: number): Promise<User | null> {
        return this.userRepository.findById(userId);
    }

    /**
     * Verify JWT access token
     */
    verifyAccessToken(token: string): JwtPayload {
        try {
            return jwt.verify(token, config.jwtSecret) as JwtPayload;
        } catch {
            throw ApiError.unauthorized('Invalid or expired access token');
        }
    }

    /**
     * Generate access and refresh tokens
     */
    private async generateTokens(user: User): Promise<AuthTokens> {
        const payload: JwtPayload = {
            userId: user.userId,
            email: user.email,
            role: user.role,
        };

        const accessToken = jwt.sign(payload, config.jwtSecret, {
            expiresIn: this.accessTokenExpiry,
        });

        const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
            expiresIn: this.refreshTokenExpiry,
        });

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await this.userRepository.createRefreshToken(user.userId, refreshToken, expiresAt);

        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 min in seconds
        };
    }
}
