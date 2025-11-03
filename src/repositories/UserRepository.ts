import { BaseRepository } from './BaseRepository';
import {
    User,
    CreateUserInput,
    UpdateUserInput,
    UserWithStats,
    PaginatedResult,
    NotFoundError,
    BaseRepository as IBaseRepository,
} from '../types/database';
import { logger } from '../config/logger';

export class UserRepository extends BaseRepository implements IBaseRepository<User, CreateUserInput, UpdateUserInput> {

    /**
     * Create a new user
     */
    async create(input: CreateUserInput): Promise<User> {
        try {
            const data = {
                email: input.email,
                password_hash: input.password_hash,
                duplicate_strategy: input.duplicate_strategy || 'generate_new',
                default_expiry_days: input.default_expiry_days || null,
                rate_limit_tier: input.rate_limit_tier || 'standard',
                api_key_hash: input.api_key_hash || null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date(),
            };

            const { query, params } = this.buildInsertQuery('users', data);
            const result = await this.query(query, params);

            logger.info('User created', {
                userId: result.rows[0].user_id,
                email: input.email,
                rateLimitTier: input.rate_limit_tier,
            });

            return result.rows[0] as User;
        } catch (error) {
            logger.error('Failed to create user', {
                email: input.email,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find user by ID
     */
    async findById(userId: number): Promise<User | null> {
        try {
            const query = `
        SELECT * FROM users
        WHERE user_id = $1 AND is_active = TRUE
      `;

            const result = await this.query(query, [userId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to find user by ID', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<User | null> {
        try {
            const query = `
        SELECT * FROM users
        WHERE email = $1 AND is_active = TRUE
      `;

            const result = await this.query(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to find user by email', {
                email,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find user by API key hash
     */
    async findByApiKeyHash(apiKeyHash: string): Promise<User | null> {
        try {
            const query = `
        SELECT * FROM users
        WHERE api_key_hash = $1 AND is_active = TRUE
      `;

            const result = await this.query(query, [apiKeyHash]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to find user by API key', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Update user
     */
    async update(userId: number, input: UpdateUserInput): Promise<User | null> {
        try {
            const existing = await this.findById(userId);
            if (!existing) {
                throw new NotFoundError('User', userId);
            }

            const data = {
                ...input,
                updated_at: new Date(),
            };

            // Remove undefined values
            Object.keys(data).forEach(key => {
                if (data[key as keyof typeof data] === undefined) {
                    delete data[key as keyof typeof data];
                }
            });

            const { query, params } = this.buildUpdateQuery(
                'users',
                data,
                'user_id = $' + (Object.keys(data).length + 1),
                [userId]
            );

            const result = await this.query(query, params);

            logger.info('User updated', {
                userId,
                updatedFields: Object.keys(input),
            });

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to update user', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Soft delete user (deactivate)
     */
    async delete(userId: number): Promise<boolean> {
        try {
            const query = `
        UPDATE users
        SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = $1 AND is_active = TRUE
        RETURNING user_id
      `;

            const result = await this.query(query, [userId]);

            if (result.rows.length === 0) {
                return false;
            }

            logger.info('User deactivated', { userId });
            return true;
        } catch (error) {
            logger.error('Failed to deactivate user', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Check if user exists
     */
    async exists(userId: number): Promise<boolean> {
        try {
            const query = `
        SELECT 1 FROM users
        WHERE user_id = $1 AND is_active = TRUE
        LIMIT 1
      `;

            const result = await this.query(query, [userId]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Failed to check user existence', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Check if email exists
     */
    async emailExists(email: string, excludeUserId?: number): Promise<boolean> {
        try {
            let query = `
        SELECT 1 FROM users
        WHERE email = $1 AND is_active = TRUE
      `;
            const params = [email];

            if (excludeUserId) {
                query += ` AND user_id != $2`;
                params.push(excludeUserId.toString());
            }

            query += ` LIMIT 1`;

            const result = await this.query(query, params);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Failed to check email existence', {
                email,
                excludeUserId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(userId: number): Promise<void> {
        try {
            const query = `
        UPDATE users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND is_active = TRUE
      `;

            await this.query(query, [userId]);

            logger.debug('Last login updated', { userId });
        } catch (error) {
            logger.error('Failed to update last login', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw error for login timestamp updates
        }
    }

    /**
     * Get user with statistics
     */
    async getUserWithStats(userId: number): Promise<UserWithStats | null> {
        try {
            const query = `
        SELECT 
          u.*,
          COUNT(um.short_code) as total_urls,
          COUNT(CASE WHEN NOT um.is_deleted THEN 1 END) as active_urls,
          SUM(um.access_count) as total_clicks,
          MAX(um.last_accessed_at) as last_url_accessed
        FROM users u
        LEFT JOIN url_mappings um ON u.user_id = um.user_id
        WHERE u.user_id = $1 AND u.is_active = TRUE
        GROUP BY u.user_id
      `;

            const result = await this.query(query, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                ...row,
                total_urls: parseInt(row.total_urls, 10),
                active_urls: parseInt(row.active_urls, 10),
                total_clicks: parseInt(row.total_clicks || '0', 10),
            } as UserWithStats;
        } catch (error) {
            logger.error('Failed to get user with stats', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get all users with pagination and filters
     */
    async findAll(
        filters: {
            email_like?: string;
            rate_limit_tier?: string;
            created_after?: Date;
            created_before?: Date;
            is_active?: boolean;
        } = {},
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginatedResult<UserWithStats>> {
        try {
            const baseFilters = {
                is_active: true,
                ...filters,
            };

            const { whereClause, params, nextParamIndex } = this.buildWhereClause(baseFilters);

            // Get total count
            const total = await this.getCount('users', whereClause, params);

            // Get paginated results with stats
            const { clause: paginationClause, params: paginationParams } =
                this.buildPaginationClause(page, pageSize, nextParamIndex);

            const query = `
        SELECT 
          u.*,
          COUNT(um.short_code) as total_urls,
          COUNT(CASE WHEN NOT um.is_deleted THEN 1 END) as active_urls,
          SUM(um.access_count) as total_clicks,
          MAX(um.last_accessed_at) as last_url_accessed
        FROM users u
        LEFT JOIN url_mappings um ON u.user_id = um.user_id
        ${whereClause}
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
        ${paginationClause}
      `;

            const result = await this.query(query, [...params, ...paginationParams]);

            const data = result.rows.map((row: any) => ({
                ...row,
                total_urls: parseInt(row.total_urls, 10),
                active_urls: parseInt(row.active_urls, 10),
                total_clicks: parseInt(row.total_clicks || '0', 10),
            })) as UserWithStats[];

            return {
                data,
                pagination: this.calculatePagination(page, pageSize, total),
            };
        } catch (error) {
            logger.error('Failed to find all users', {
                filters,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get users by rate limit tier
     */
    async findByRateLimitTier(tier: 'standard' | 'premium' | 'enterprise'): Promise<User[]> {
        try {
            const query = `
        SELECT * FROM users
        WHERE rate_limit_tier = $1 AND is_active = TRUE
        ORDER BY created_at DESC
      `;

            const result = await this.query(query, [tier]);
            return result.rows as User[];
        } catch (error) {
            logger.error('Failed to find users by rate limit tier', {
                tier,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get inactive users (for cleanup)
     */
    async findInactiveUsers(
        inactiveDays: number = 365,
        limit: number = 1000
    ): Promise<User[]> {
        try {
            const query = `
        SELECT * FROM users
        WHERE is_active = TRUE
          AND (
            last_login_at < NOW() - INTERVAL '${inactiveDays} days'
            OR (last_login_at IS NULL AND created_at < NOW() - INTERVAL '${inactiveDays} days')
          )
        ORDER BY COALESCE(last_login_at, created_at) ASC
        LIMIT $1
      `;

            const result = await this.query(query, [limit]);
            return result.rows as User[];
        } catch (error) {
            logger.error('Failed to find inactive users', {
                inactiveDays,
                limit,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Update user preferences
     */
    async updatePreferences(
        userId: number,
        preferences: {
            duplicate_strategy?: 'generate_new' | 'reuse_existing';
            default_expiry_days?: number | null;
        }
    ): Promise<User | null> {
        try {
            return await this.update(userId, preferences);
        } catch (error) {
            logger.error('Failed to update user preferences', {
                userId,
                preferences,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get allowed sort columns
     */
    protected getAllowedSortColumns(): string[] {
        return [
            'created_at',
            'updated_at',
            'last_login_at',
            'email',
            'rate_limit_tier',
            'user_id',
        ];
    }

    /**
     * Get user activity summary
     */
    async getUserActivitySummary(
        userId: number,
        days: number = 30
    ): Promise<{
        user: User;
        urlsCreated: number;
        totalClicks: number;
        topUrls: Array<{ short_code: string; long_url: string; clicks: number }>;
    } | null> {
        try {
            const user = await this.findById(userId);
            if (!user) {
                return null;
            }

            // Get URLs created in the last N days
            const urlsQuery = `
        SELECT COUNT(*) as count
        FROM url_mappings
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '${days} days'
          AND NOT is_deleted
      `;
            const urlsResult = await this.query(urlsQuery, [userId]);
            const urlsCreated = parseInt(urlsResult.rows[0].count, 10);

            // Get total clicks in the last N days
            const clicksQuery = `
        SELECT COALESCE(SUM(aa.click_count), 0) as total_clicks
        FROM url_mappings um
        JOIN analytics_aggregates aa ON um.short_code = aa.short_code
        WHERE um.user_id = $1 
          AND aa.date >= CURRENT_DATE - INTERVAL '${days} days'
          AND NOT um.is_deleted
      `;
            const clicksResult = await this.query(clicksQuery, [userId]);
            const totalClicks = parseInt(clicksResult.rows[0].total_clicks, 10);

            // Get top 5 URLs by clicks
            const topUrlsQuery = `
        SELECT 
          um.short_code,
          um.long_url,
          COALESCE(SUM(aa.click_count), 0) as clicks
        FROM url_mappings um
        LEFT JOIN analytics_aggregates aa ON um.short_code = aa.short_code
          AND aa.date >= CURRENT_DATE - INTERVAL '${days} days'
        WHERE um.user_id = $1 AND NOT um.is_deleted
        GROUP BY um.short_code, um.long_url
        ORDER BY clicks DESC
        LIMIT 5
      `;
            const topUrlsResult = await this.query(topUrlsQuery, [userId]);
            const topUrls = topUrlsResult.rows.map((row: any) => ({
                short_code: row.short_code,
                long_url: row.long_url,
                clicks: parseInt(row.clicks, 10),
            }));

            return {
                user,
                urlsCreated,
                totalClicks,
                topUrls,
            };
        } catch (error) {
            logger.error('Failed to get user activity summary', {
                userId,
                days,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }
}