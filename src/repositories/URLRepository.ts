import { PoolClient } from 'pg';
import { BaseRepository } from './BaseRepository';
import {
    URLMapping,
    CreateURLMappingInput,
    UpdateURLMappingInput,
    URLMappingFilters,
    PaginatedResult,
    URLMappingWithStats,
    NotFoundError,
    BaseRepository as IBaseRepository,
} from '../types/database';
import { logger } from '../config/logger';
import crypto from 'crypto';

export class URLRepository extends BaseRepository implements IBaseRepository<URLMapping, CreateURLMappingInput, UpdateURLMappingInput> {

    /**
     * Create a new URL mapping
     */
    async create(input: CreateURLMappingInput): Promise<URLMapping> {
        try {
            const data = {
                short_code: input.short_code,
                long_url: input.long_url,
                long_url_hash: input.long_url_hash,
                user_id: input.user_id || null,
                expires_at: input.expires_at || null,
                is_custom_alias: input.is_custom_alias || false,
                created_at: new Date(),
                access_count: 0,
                is_deleted: false,
            };

            const { query, params } = this.buildInsertQuery('url_mappings', data);
            const result = await this.query(query, params);

            logger.info('URL mapping created', {
                shortCode: input.short_code,
                userId: input.user_id,
                isCustomAlias: input.is_custom_alias,
            });

            return result.rows[0] as URLMapping;
        } catch (error) {
            logger.error('Failed to create URL mapping', {
                shortCode: input.short_code,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find URL mapping by short code
     */
    async findById(shortCode: string): Promise<URLMapping | null> {
        try {
            const query = `
        SELECT * FROM url_mappings
        WHERE short_code = $1 AND NOT is_deleted
      `;

            const result = await this.query(query, [shortCode]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to find URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find URL mapping by long URL hash (for duplicate detection)
     */
    async findByLongUrlHash(
        longUrlHash: string,
        userId?: number
    ): Promise<URLMapping | null> {
        try {
            let query = `
        SELECT * FROM url_mappings
        WHERE long_url_hash = $1 
          AND NOT is_deleted
          AND (expires_at IS NULL OR expires_at > NOW())
      `;
            const params = [longUrlHash];

            if (userId) {
                query += ` AND user_id = $2`;
                params.push(userId as any);
            } else {
                query += ` AND user_id IS NULL`;
            }

            query += ` ORDER BY created_at DESC LIMIT 1`;

            const result = await this.query(query, params);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to find URL mapping by hash', {
                longUrlHash,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Update URL mapping
     */
    async update(shortCode: string, input: UpdateURLMappingInput): Promise<URLMapping | null> {
        try {
            const existing = await this.findById(shortCode);
            if (!existing) {
                throw new NotFoundError('URL mapping', shortCode);
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
                'url_mappings',
                data,
                'short_code = $' + (Object.keys(data).length + 1),
                [shortCode]
            );

            const result = await this.query(query, params);

            logger.info('URL mapping updated', {
                shortCode,
                updatedFields: Object.keys(input),
            });

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Failed to update URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Soft delete URL mapping
     */
    async delete(shortCode: string): Promise<boolean> {
        try {
            const query = `
        UPDATE url_mappings
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE short_code = $1 AND NOT is_deleted
        RETURNING short_code
      `;

            const result = await this.query(query, [shortCode]);

            if (result.rows.length === 0) {
                return false;
            }

            logger.info('URL mapping soft deleted', { shortCode });
            return true;
        } catch (error) {
            logger.error('Failed to delete URL mapping', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Check if URL mapping exists
     */
    async exists(shortCode: string): Promise<boolean> {
        try {
            const query = `
        SELECT 1 FROM url_mappings
        WHERE short_code = $1 AND NOT is_deleted
        LIMIT 1
      `;

            const result = await this.query(query, [shortCode]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Failed to check URL mapping existence', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Increment access count atomically
     */
    async incrementAccessCount(shortCode: string): Promise<void> {
        try {
            const query = `
        UPDATE url_mappings
        SET access_count = access_count + 1,
            last_accessed_at = NOW()
        WHERE short_code = $1 AND NOT is_deleted
      `;

            await this.query(query, [shortCode]);

            logger.debug('Access count incremented', { shortCode });
        } catch (error) {
            logger.error('Failed to increment access count', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw error for access count updates to avoid breaking redirects
        }
    }

    /**
     * Find URLs by user with pagination and filters
     */
    async findByUser(
        userId: number,
        filters: URLMappingFilters = {},
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginatedResult<URLMappingWithStats>> {
        try {
            const baseFilters = {
                user_id: userId,
                is_deleted: false,
                ...filters,
            };

            const { whereClause, params, nextParamIndex } = this.buildWhereClause(baseFilters);

            // Get total count
            const total = await this.getCount('url_mappings', whereClause, params);

            // Get paginated results with stats
            const { clause: paginationClause, params: paginationParams } =
                this.buildPaginationClause(page, pageSize, nextParamIndex);

            const query = `
        SELECT 
          um.*,
          COALESCE(SUM(aa.click_count), 0) as total_clicks,
          COUNT(DISTINCT aa.date) as unique_visitors,
          MAX(aa.updated_at) as last_click_at
        FROM url_mappings um
        LEFT JOIN analytics_aggregates aa ON um.short_code = aa.short_code
        ${whereClause}
        GROUP BY um.short_code
        ORDER BY um.created_at DESC
        ${paginationClause}
      `;

            const result = await this.query(query, [...params, ...paginationParams]);

            const data = result.rows.map((row: any) => ({
                ...row,
                total_clicks: parseInt(row.total_clicks, 10),
                unique_visitors: parseInt(row.unique_visitors, 10),
            })) as URLMappingWithStats[];

            return {
                data,
                pagination: this.calculatePagination(page, pageSize, total),
            };
        } catch (error) {
            logger.error('Failed to find URLs by user', {
                userId,
                filters,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find expired URLs for cleanup
     */
    async findExpiredUrls(limit: number = 1000): Promise<URLMapping[]> {
        try {
            const query = `
        SELECT * FROM url_mappings
        WHERE expires_at < NOW() 
          AND NOT is_deleted
        ORDER BY expires_at ASC
        LIMIT $1
      `;

            const result = await this.query(query, [limit]);
            return result.rows as URLMapping[];
        } catch (error) {
            logger.error('Failed to find expired URLs', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get URL statistics
     */
    async getUrlStats(shortCode: string): Promise<URLMappingWithStats | null> {
        try {
            const query = `
        SELECT 
          um.*,
          COALESCE(SUM(aa.click_count), 0) as total_clicks,
          COUNT(DISTINCT aa.date) as unique_visitors,
          MAX(aa.updated_at) as last_click_at
        FROM url_mappings um
        LEFT JOIN analytics_aggregates aa ON um.short_code = aa.short_code
        WHERE um.short_code = $1 AND NOT um.is_deleted
        GROUP BY um.short_code
      `;

            const result = await this.query(query, [shortCode]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                ...row,
                total_clicks: parseInt(row.total_clicks, 10),
                unique_visitors: parseInt(row.unique_visitors, 10),
            } as URLMappingWithStats;
        } catch (error) {
            logger.error('Failed to get URL stats', {
                shortCode,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Bulk soft delete URLs
     */
    async bulkDelete(shortCodes: string[]): Promise<number> {
        if (shortCodes.length === 0) return 0;

        try {
            const placeholders = shortCodes.map((_, index) => `$${index + 1}`).join(', ');
            const query = `
        UPDATE url_mappings
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE short_code IN (${placeholders}) AND NOT is_deleted
      `;

            const result = await this.query(query, shortCodes);

            logger.info('Bulk deleted URL mappings', {
                count: result.rowCount,
                shortCodes: shortCodes.slice(0, 10), // Log first 10 for debugging
            });

            return result.rowCount || 0;
        } catch (error) {
            logger.error('Failed to bulk delete URL mappings', {
                count: shortCodes.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get shard for short code (for future sharding implementation)
     */
    private getShardForShortCode(shortCode: string): number {
        // Simple hash-based sharding
        const hash = crypto.createHash('md5').update(shortCode).digest('hex');
        const hashInt = parseInt(hash.substring(0, 8), 16);
        return hashInt % 16; // 16 shards
    }

    /**
     * Get allowed sort columns
     */
    protected getAllowedSortColumns(): string[] {
        return [
            'created_at',
            'access_count',
            'last_accessed_at',
            'expires_at',
            'short_code',
        ];
    }

    /**
     * Search URLs by long URL pattern
     */
    async searchByLongUrl(
        pattern: string,
        userId?: number,
        page: number = 1,
        pageSize: number = 20
    ): Promise<PaginatedResult<URLMapping>> {
        try {
            const filters: any = {
                is_deleted: false,
                long_url_like: pattern,
            };

            if (userId) {
                filters.user_id = userId;
            }

            const { whereClause, params, nextParamIndex } = this.buildWhereClause(filters);

            // Get total count
            const total = await this.getCount('url_mappings', whereClause, params);

            // Get paginated results
            const { clause: paginationClause, params: paginationParams } =
                this.buildPaginationClause(page, pageSize, nextParamIndex);

            const query = `
        SELECT * FROM url_mappings
        ${whereClause}
        ORDER BY created_at DESC
        ${paginationClause}
      `;

            const result = await this.query(query, [...params, ...paginationParams]);

            return {
                data: result.rows as URLMapping[],
                pagination: this.calculatePagination(page, pageSize, total),
            };
        } catch (error) {
            logger.error('Failed to search URLs by long URL', {
                pattern,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Get top URLs by access count
     */
    async getTopUrls(
        limit: number = 10,
        userId?: number,
        timeframe?: { start: Date; end: Date }
    ): Promise<URLMappingWithStats[]> {
        try {
            let query = `
        SELECT 
          um.*,
          COALESCE(SUM(aa.click_count), 0) as total_clicks,
          COUNT(DISTINCT aa.date) as unique_visitors,
          MAX(aa.updated_at) as last_click_at
        FROM url_mappings um
        LEFT JOIN analytics_aggregates aa ON um.short_code = aa.short_code
        WHERE um.is_deleted = FALSE
      `;

            const params: any[] = [];
            let paramIndex = 1;

            if (userId) {
                query += ` AND um.user_id = $${paramIndex++}`;
                params.push(userId);
            }

            if (timeframe) {
                query += ` AND aa.date >= $${paramIndex++} AND aa.date <= $${paramIndex++}`;
                params.push(timeframe.start, timeframe.end);
            }

            query += `
        GROUP BY um.short_code
        ORDER BY total_clicks DESC, um.access_count DESC
        LIMIT $${paramIndex}
      `;
            params.push(limit);

            const result = await this.query(query, params);

            return result.rows.map((row: any) => ({
                ...row,
                total_clicks: parseInt(row.total_clicks, 10),
                unique_visitors: parseInt(row.unique_visitors, 10),
            })) as URLMappingWithStats[];
        } catch (error) {
            logger.error('Failed to get top URLs', {
                limit,
                userId,
                timeframe,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Find soft-deleted URLs older than specified date
     */
    async findSoftDeletedUrls(olderThan: Date, limit: number = 1000): Promise<URLMapping[]> {
        try {
            const query = `
        SELECT * FROM url_mappings
        WHERE is_deleted = TRUE 
          AND deleted_at < $1
        ORDER BY deleted_at ASC
        LIMIT $2
      `;

            const result = await this.query(query, [olderThan, limit]);
            return result.rows as URLMapping[];
        } catch (error) {
            logger.error('Failed to find soft-deleted URLs', {
                olderThan,
                limit,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }

    /**
     * Permanently delete URLs (hard delete)
     */
    async hardDelete(shortCodes: string[]): Promise<number> {
        if (shortCodes.length === 0) return 0;

        try {
            const placeholders = shortCodes.map((_, index) => `$${index + 1}`).join(', ');
            const query = `
        DELETE FROM url_mappings
        WHERE short_code IN (${placeholders}) AND is_deleted = TRUE
      `;

            const result = await this.query(query, shortCodes);

            logger.info('Hard deleted URL mappings', {
                count: result.rowCount,
                shortCodes: shortCodes.slice(0, 10), // Log first 10 for debugging
            });

            return result.rowCount || 0;
        } catch (error) {
            logger.error('Failed to hard delete URL mappings', {
                count: shortCodes.length,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw this.handleDatabaseError(error);
        }
    }
}