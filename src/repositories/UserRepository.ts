import { db } from '../config/database';
import { logger } from '../config/logger';
import {
    User,
    RefreshToken,
    PasswordResetToken,
    EmailVerificationToken,
    UpdateProfileRequest
} from '../types/user.types';

export class UserRepository {
    /**
     * Create a new user
     */
    async create(userData: {
        email: string;
        passwordHash: string;
        firstName?: string;
        lastName?: string;
        googleId?: string;
        avatarUrl?: string;
    }): Promise<User> {
        const query = `
      INSERT INTO users (email, password_hash, first_name, last_name, google_id, avatar_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
                google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
                is_active as "isActive", role, created_at as "createdAt", 
                updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `;

        const values = [
            userData.email,
            userData.passwordHash,
            userData.firstName || null,
            userData.lastName || null,
            userData.googleId || null,
            userData.avatarUrl || null,
        ];

        try {
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating user', { error, userData: { email: userData.email } });
            throw error;
        }
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        const query = `
      SELECT user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
             google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
             is_active as "isActive", role, created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE email = $1
    `;

        try {
            const result = await db.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by email', { error, email });
            throw error;
        }
    }

    /**
     * Find user by ID
     */
    async findById(id: number): Promise<User | null> {
        const query = `
      SELECT user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
             google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
             is_active as "isActive", role, created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE user_id = $1
    `;

        try {
            const result = await db.query(query, [id]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by ID', { error, id });
            throw error;
        }
    }

    /**
     * Find user by Google ID
     */
    async findByGoogleId(googleId: string): Promise<User | null> {
        const query = `
      SELECT user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
             google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
             is_active as "isActive", role, created_at as "createdAt", 
             updated_at as "updatedAt", last_login_at as "lastLoginAt"
      FROM users 
      WHERE google_id = $1
    `;

        try {
            const result = await db.query(query, [googleId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding user by Google ID', { error, googleId });
            throw error;
        }
    }

    /**
     * Get password hash for user
     */
    async getPasswordHash(userId: number): Promise<string | null> {
        const query = 'SELECT password_hash FROM users WHERE user_id = $1';

        try {
            const result = await db.query(query, [userId]);
            return result.rows[0]?.password_hash || null;
        } catch (error) {
            logger.error('Error getting password hash', { error, userId });
            throw error;
        }
    }

    /**
     * Update user password
     */
    async updatePassword(userId: number, passwordHash: string): Promise<void> {
        const query = 'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2';

        try {
            await db.query(query, [passwordHash, userId]);
        } catch (error) {
            logger.error('Error updating password', { error, userId });
            throw error;
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(userId: number, data: UpdateProfileRequest): Promise<User | null> {
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (data.firstName !== undefined) {
            fields.push(`first_name = $${paramCount++}`);
            values.push(data.firstName);
        }

        if (data.lastName !== undefined) {
            fields.push(`last_name = $${paramCount++}`);
            values.push(data.lastName);
        }

        if (data.avatarUrl !== undefined) {
            fields.push(`avatar_url = $${paramCount++}`);
            values.push(data.avatarUrl);
        }

        if (fields.length === 0) {
            return this.findById(userId);
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
                google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
                is_active as "isActive", role, created_at as "createdAt", 
                updated_at as "updatedAt", last_login_at as "lastLoginAt"
    `;

        try {
            const result = await db.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error updating profile', { error, userId, data });
            throw error;
        }
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: number): Promise<void> {
        const query = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = $1';

        try {
            await db.query(query, [userId]);
        } catch (error) {
            logger.error('Error updating last login', { error, userId });
            throw error;
        }
    }

    /**
     * Create refresh token
     */
    async createRefreshToken(userId: number, token: string, expiresAt: Date): Promise<void> {
        const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;

        try {
            await db.query(query, [userId, token, expiresAt]);
        } catch (error) {
            logger.error('Error creating refresh token', { error, userId });
            throw error;
        }
    }

    /**
     * Find refresh token
     */
    async findRefreshToken(token: string): Promise<RefreshToken | null> {
        const query = `
      SELECT id, user_id as "userId", token, expires_at as "expiresAt", 
             revoked, created_at as "createdAt"
      FROM refresh_tokens 
      WHERE token = $1
    `;

        try {
            const result = await db.query(query, [token]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding refresh token', { error });
            throw error;
        }
    }

    /**
     * Revoke refresh token
     */
    async revokeRefreshToken(token: string): Promise<void> {
        const query = 'UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1';

        try {
            await db.query(query, [token]);
        } catch (error) {
            logger.error('Error revoking refresh token', { error });
            throw error;
        }
    }

    /**
     * Revoke all refresh tokens for user
     */
    async revokeAllRefreshTokens(userId: number): Promise<void> {
        const query = 'UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1';

        try {
            await db.query(query, [userId]);
        } catch (error) {
            logger.error('Error revoking all refresh tokens', { error, userId });
            throw error;
        }
    }

    /**
     * Create password reset token
     */
    async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
        const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;

        try {
            await db.query(query, [userId, token, expiresAt]);
        } catch (error) {
            logger.error('Error creating password reset token', { error, userId });
            throw error;
        }
    }

    /**
     * Find password reset token
     */
    async findPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
        const query = `
      SELECT id, user_id as "userId", token, expires_at as "expiresAt", 
             used, created_at as "createdAt"
      FROM password_reset_tokens 
      WHERE token = $1
    `;

        try {
            const result = await db.query(query, [token]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding password reset token', { error });
            throw error;
        }
    }

    /**
     * Mark password reset token as used
     */
    async markPasswordResetTokenUsed(token: string): Promise<void> {
        const query = 'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1';

        try {
            await db.query(query, [token]);
        } catch (error) {
            logger.error('Error marking password reset token as used', { error });
            throw error;
        }
    }

    /**
     * Create email verification token
     */
    async createEmailVerificationToken(userId: string, token: string, expiresAt: Date): Promise<void> {
        const query = `
      INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
    `;

        try {
            await db.query(query, [userId, token, expiresAt]);
        } catch (error) {
            logger.error('Error creating email verification token', { error, userId });
            throw error;
        }
    }

    /**
     * Find email verification token
     */
    async findEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
        const query = `
      SELECT id, user_id as "userId", token, expires_at as "expiresAt", 
             used, created_at as "createdAt"
      FROM email_verification_tokens 
      WHERE token = $1
    `;

        try {
            const result = await db.query(query, [token]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error finding email verification token', { error });
            throw error;
        }
    }

    /**
     * Mark email as verified
     */
    async markEmailVerified(userId: string): Promise<void> {
        const query = 'UPDATE users SET email_verified = TRUE WHERE user_id = $1';

        try {
            await db.query(query, [userId]);
        } catch (error) {
            logger.error('Error marking email as verified', { error, userId });
            throw error;
        }
    }

    /**
     * Clean up expired tokens
     */
    async cleanupExpiredTokens(): Promise<void> {
        const queries = [
            'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP',
            'DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP',
            'DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP',
        ];

        try {
            for (const query of queries) {
                await db.query(query);
            }
        } catch (error) {
            logger.error('Error cleaning up expired tokens', { error });
            throw error;
        }
    }

    /**
     * Health check for repository
     */
    async healthCheck(): Promise<boolean> {
        try {
            await db.query('SELECT 1');
            return true;
        } catch (error) {
            logger.error('Repository health check failed', {
                repository: this.constructor.name,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }



    /**
         * Find all users
         */
    async findAll(): Promise<User[]> {
        const query = `
            SELECT user_id as "userId", email, first_name as "firstName", last_name as "lastName", 
                   google_id as "googleId", avatar_url as "avatarUrl", email_verified as "emailVerified",
                   is_active as "isActive", role, created_at as "createdAt", 
                   updated_at as "updatedAt", last_login_at as "lastLoginAt"
            FROM users 
            WHERE is_active = TRUE
            ORDER BY created_at DESC
        `;

        try {
            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error finding all users', { error });
            throw error;
        }
    }

    /**
     * Delete user account and all associated data
     */
    async deleteUser(userId: number): Promise<void> {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            // Delete in order to respect foreign key constraints
            // First delete analytics data for user's URLs
            await client.query('DELETE FROM analytics_events WHERE short_code IN (SELECT short_code FROM url_mappings WHERE user_id = $1)', [userId]);
            await client.query('DELETE FROM analytics_daily_summaries WHERE short_code IN (SELECT short_code FROM url_mappings WHERE user_id = $1)', [userId]);

            // Delete URL mappings
            await client.query('DELETE FROM url_mappings WHERE user_id = $1', [userId]);

            // Delete user preferences and notification settings
            await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM notification_settings WHERE user_id = $1', [userId]);

            // Delete authentication tokens
            await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);

            // Finally delete the user
            await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

            await client.query('COMMIT');
            logger.info('User account and all associated data deleted', { userId });
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Error deleting user account', { error, userId });
            throw error;
        } finally {
            client.release();
        }
    }
}