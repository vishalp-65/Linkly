// Database types and interfaces

export interface URLMapping {
    short_code: string
    long_url: string
    long_url_hash: string
    user_id: number | null
    created_at: Date
    expires_at: Date | null
    last_accessed_at: Date | null
    access_count: number
    is_custom_alias: boolean
    is_deleted: boolean
    deleted_at: Date | null
}

export interface User {
    user_id: number
    email: string
    password_hash: string
    duplicate_strategy: "generate_new" | "reuse_existing"
    default_expiry_days: number | null
    rate_limit_tier: "standard" | "premium" | "enterprise"
    api_key_hash: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
    last_login_at: Date | null
}

export interface AnalyticsEvent {
    event_id: string
    short_code: string
    clicked_at: Date
    ip_address: string | null
    user_agent: string | null
    referrer: string | null
    country_code: string | null
    region: string | null
    city: string | null
    device_type: string | null
    browser: string | null
    os: string | null
}

export interface AnalyticsAggregate {
    short_code: string
    date: Date
    hour: number
    click_count: number
    unique_ips: number
    unique_countries: number
    top_referrer: string | null
    top_country: string | null
    created_at: Date
    updated_at: Date
}

// Input types for creating/updating records
export interface CreateURLMappingInput {
    short_code: string
    long_url: string
    long_url_hash: string
    user_id?: number
    expires_at?: Date
    is_custom_alias?: boolean
}

export interface UpdateURLMappingInput {
    long_url?: string
    long_url_hash?: string
    expires_at?: Date
    last_accessed_at?: Date
    access_count?: number
}

export interface CreateUserInput {
    email: string
    password_hash: string
    duplicate_strategy?: "generate_new" | "reuse_existing"
    default_expiry_days?: number
    rate_limit_tier?: "standard" | "premium" | "enterprise"
    api_key_hash?: string
}

export interface UpdateUserInput {
    email?: string
    password_hash?: string
    duplicate_strategy?: "generate_new" | "reuse_existing"
    default_expiry_days?: number | null
    rate_limit_tier?: "standard" | "premium" | "enterprise"
    api_key_hash?: string
    is_active?: boolean
    last_login_at?: Date
}

export interface CreateAnalyticsEventInput {
    short_code: string
    clicked_at?: Date
    ip_address?: string
    user_agent?: string
    referrer?: string
    country_code?: string
    region?: string
    city?: string
    device_type?: string
    browser?: string
    os?: string
}

// Query options and filters
export interface PaginationOptions {
    page: number
    pageSize: number
}

export interface URLMappingFilters {
    user_id?: number
    is_custom_alias?: boolean
    is_deleted?: boolean
    created_after?: Date
    created_before?: Date
    expires_after?: Date
    expires_before?: Date
    search?: string // Search in long_url
}

export interface AnalyticsFilters {
    short_code?: string
    date_from?: Date
    date_to?: Date
    country_code?: string
    device_type?: string
}

// Result types
export interface PaginatedResult<T> {
    data: T[]
    pagination: {
        currentPage: number
        pageSize: number
        totalItems: number
        totalPages: number
        hasNextPage: boolean
        hasPrevPage: boolean
    }
}

export interface URLMappingWithStats extends URLMapping {
    total_clicks?: number
    unique_visitors?: number
    last_click_at?: Date
}

export interface UserWithStats extends User {
    total_urls?: number
    active_urls?: number
    total_clicks?: number
    last_url_accessed?: Date
}

// Sharding configuration
export interface ShardConfig {
    shard_count: number
    hash_function: "crc32" | "md5" | "sha1"
}

// Connection pool stats
export interface PoolStats {
    totalCount: number
    idleCount: number
    waitingCount: number
}

// Repository base interface
export interface BaseRepository<T, CreateInput, UpdateInput> {
    create(input: CreateInput): Promise<T>
    findById(id: string | number): Promise<T | null>
    update(id: string | number, input: UpdateInput): Promise<T | null>
    delete(id: string | number): Promise<boolean>
    exists(id: string | number): Promise<boolean>
}

// Error types
export class DatabaseError extends Error {
    constructor(
        message: string,
        public code?: string,
        public constraint?: string,
        public detail?: string
    ) {
        super(message)
        this.name = "DatabaseError"
    }
}

export interface URLMappingFilters {
    search?: string
    is_custom_alias?: boolean
    has_expiry?: boolean
    is_expired?: boolean
    date_from?: Date
    date_to?: Date
    min_access_count?: number
    max_access_count?: number
    sort_by?: string
    sort_order?: "ASC" | "DESC"
    long_url_like?: string // Keep for backward compatibility
}

export class DuplicateKeyError extends DatabaseError {
    constructor(message: string, constraint?: string) {
        super(message, "23505", constraint)
        this.name = "DuplicateKeyError"
    }
}

export class ForeignKeyError extends DatabaseError {
    constructor(message: string, constraint?: string) {
        super(message, "23503", constraint)
        this.name = "ForeignKeyError"
    }
}

export class NotFoundError extends Error {
    constructor(resource: string, id: string | number) {
        super(`${resource} with id ${id} not found`)
        this.name = "NotFoundError"
    }
}
