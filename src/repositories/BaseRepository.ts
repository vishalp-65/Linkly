import { Pool, PoolClient } from "pg"
import { db } from "../config/database"
import { logger } from "../config/logger"
import {
    DatabaseError,
    DuplicateKeyError,
    ForeignKeyError
} from "../types/database"

export abstract class BaseRepository {
    protected pool: Pool

    constructor() {
        this.pool = db.getPool()
    }

    /**
     * Execute a query with error handling and logging
     */
    protected async query(text: string, params?: any[]): Promise<any> {
        return await db.query(text, params)
    }

    /**
     * Get a client from the pool for transactions
     */
    protected async getClient(): Promise<PoolClient> {
        return await db.getClient()
    }

    /**
     * Execute multiple queries in a transaction
     */
    protected async transaction<T>(
        callback: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.getClient()

        try {
            await client.query("BEGIN")
            const result = await callback(client)
            await client.query("COMMIT")
            return result
        } catch (error) {
            await client.query("ROLLBACK")
            throw this.handleDatabaseError(error)
        } finally {
            client.release()
        }
    }

    /**
     * Handle and transform database errors
     */
    protected handleDatabaseError(error: any): Error {
        if (error.code) {
            switch (error.code) {
                case "23505": // unique_violation
                    return new DuplicateKeyError(
                        error.detail || "Duplicate key violation",
                        error.constraint
                    )
                case "23503": // foreign_key_violation
                    return new ForeignKeyError(
                        error.detail || "Foreign key violation",
                        error.constraint
                    )
                case "23502": // not_null_violation
                    return new DatabaseError(
                        `Not null violation: ${error.column}`,
                        error.code
                    )
                case "23514": // check_violation
                    return new DatabaseError(
                        error.detail || "Check constraint violation",
                        error.code,
                        error.constraint
                    )
                default:
                    return new DatabaseError(
                        error.message || "Database error",
                        error.code,
                        error.constraint,
                        error.detail
                    )
            }
        }

        return error instanceof Error ? error : new Error(String(error))
    }

    /**
     * Build WHERE clause from filters
     */
    protected buildWhereClause(
        filters: Record<string, any>,
        startParamIndex: number = 1
    ): { whereClause: string; params: any[]; nextParamIndex: number } {
        const conditions: string[] = []
        const params: any[] = []
        let paramIndex = startParamIndex

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    if (value.length > 0) {
                        const placeholders = value
                            .map(() => `$${paramIndex++}`)
                            .join(", ")
                        conditions.push(`${key} IN (${placeholders})`)
                        params.push(...value)
                    }
                } else if (typeof value === "string" && key.endsWith("_like")) {
                    const column = key.replace("_like", "")
                    conditions.push(`${column} ILIKE $${paramIndex++}`)
                    params.push(`%${value}%`)
                } else if (typeof value === "object" && value.operator) {
                    // Handle complex operators like { operator: '>=', value: date }
                    conditions.push(`${key} ${value.operator} $${paramIndex++}`)
                    params.push(value.value)
                } else {
                    conditions.push(`${key} = $${paramIndex++}`)
                    params.push(value)
                }
            }
        }

        const whereClause =
            conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

        return {
            whereClause,
            params,
            nextParamIndex: paramIndex
        }
    }

    /**
     * Build ORDER BY clause
     */
    protected buildOrderByClause(
        sortBy?: string,
        sortOrder: "ASC" | "DESC" = "DESC"
    ): string {
        if (!sortBy) return ""

        // Validate sort column to prevent SQL injection
        const allowedColumns = this.getAllowedSortColumns()
        if (!allowedColumns.includes(sortBy)) {
            logger.warn("Invalid sort column attempted", {
                sortBy,
                allowedColumns
            })
            return ""
        }

        return `ORDER BY ${sortBy} ${sortOrder}`
    }

    /**
     * Build LIMIT and OFFSET clause for pagination
     */
    protected buildPaginationClause(
        page: number,
        pageSize: number,
        paramIndex: number
    ): { clause: string; params: any[]; nextParamIndex: number } {
        const offset = (page - 1) * pageSize

        return {
            clause: `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            params: [pageSize, offset],
            nextParamIndex: paramIndex + 2
        }
    }

    /**
     * Calculate pagination metadata
     */
    protected calculatePagination(
        currentPage: number,
        pageSize: number,
        totalItems: number
    ) {
        const totalPages = Math.ceil(totalItems / pageSize)

        return {
            currentPage,
            pageSize,
            totalItems,
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
        }
    }

    /**
     * Get count for pagination
     */
    protected async getCount(
        table: string,
        whereClause: string,
        params: any[]
    ): Promise<number> {
        const countQuery = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`
        const result = await this.query(countQuery, params)
        return parseInt(result.rows[0].count, 10)
    }

    /**
     * Convert database row to camelCase object
     */
    protected toCamelCase(row: any): any {
        if (!row) return null

        const camelCaseRow: any = {}

        for (const [key, value] of Object.entries(row)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
                letter.toUpperCase()
            )
            camelCaseRow[camelKey] = value
        }

        return camelCaseRow
    }

    /**
     * Convert camelCase object to snake_case for database
     */
    protected toSnakeCase(obj: any): any {
        if (!obj) return null

        const snakeCaseObj: any = {}

        for (const [key, value] of Object.entries(obj)) {
            const snakeKey = key.replace(
                /[A-Z]/g,
                (letter) => `_${letter.toLowerCase()}`
            )
            snakeCaseObj[snakeKey] = value
        }

        return snakeCaseObj
    }

    /**
     * Build INSERT query with RETURNING clause
     */
    protected buildInsertQuery(
        table: string,
        data: Record<string, any>,
        returning: string = "*"
    ): { query: string; params: any[] } {
        const keys = Object.keys(data)
        const values = Object.values(data)
        const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ")
        const columns = keys.join(", ")

        const query = `
      INSERT INTO ${table} (${columns})
      VALUES (${placeholders})
      RETURNING ${returning}
    `

        return { query, params: values }
    }

    /**
     * Build UPDATE query with RETURNING clause
     */
    protected buildUpdateQuery(
        table: string,
        data: Record<string, any>,
        whereCondition: string,
        whereParams: any[],
        returning: string = "*"
    ): { query: string; params: any[] } {
        const keys = Object.keys(data)
        const values = Object.values(data)

        const setClause = keys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(", ")

        const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereCondition}
      RETURNING ${returning}
    `

        return { query, params: [...values, ...whereParams] }
    }

    /**
     * Get allowed sort columns for this repository
     * Override in child classes
     */
    protected abstract getAllowedSortColumns(): string[]

    /**
     * Health check for repository
     */
    async healthCheck(): Promise<boolean> {
        try {
            await this.query("SELECT 1")
            return true
        } catch (error) {
            logger.error("Repository health check failed", {
                repository: this.constructor.name,
                error: error instanceof Error ? error.message : "Unknown error"
            })
            return false
        }
    }
}
