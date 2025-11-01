// =============================
// 🔹 Shared / Utility Types
// =============================

/** ISO8601 date string, e.g., "2025-11-06T12:00:00Z" */
export type ISODateString = string;

/** Common timestamps for database entities */
export interface EntityTimestamps {
    createdAt: ISODateString;
    updatedAt?: ISODateString;
    deletedAt?: ISODateString;
}

/** Base entity with ID */
export interface BaseEntity extends EntityTimestamps {
    id?: number | string;
}

// =============================
// 🔹 User Models
// =============================

/** User roles within the system */
export enum UserRole {
    User = 'user',
    Admin = 'admin',
    Premium = 'premium',
}

/** Represents an authenticated user profile */
export interface User extends BaseEntity {
    userId: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role: UserRole;
    avatarUrl?: string;
    /** Whether the user’s account is verified */
    isVerified?: boolean;
    /** Last time the user logged in */
    lastLoginAt?: ISODateString;
}

/** Tokens returned after authentication */
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    /** Expiration time in seconds */
    expiresIn: number;
    /** Optional issued-at timestamp for better tracking */
    issuedAt?: ISODateString;
}

// =============================
// 🔹 URL & Analytics Models
// =============================

/** Represents a shortened URL entry */
export interface URLItem extends BaseEntity {
    access_count: number;
    long_url: string;
    short_code: string;
    is_custom_alias: boolean;
    is_deleted: boolean;
    total_clicks: number;
    unique_visitors?: number;
    last_accessed_at?: ISODateString;
    expires_at?: ISODateString;
    created_at: ISODateString;
    deleted_at?: ISODateString;
    user_id?: number;
}


/** Backward-compatible alias for legacy code */
export type URLMapping = URLItem;

/** Query parameters for URL listing or filtering */
export interface URLListParams {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'created_at' |
    'access_count' |
    'last_accessed_at' |
    'expires_at' |
    'short_code' |
    'unique_visitors';
    sortOrder?: 'asc' | 'desc';
    isCustomAlias?: boolean;
    hasExpiry?: boolean;
    isExpired?: boolean;
    dateFrom?: ISODateString;
    dateTo?: ISODateString;
    minAccessCount?: number;
    maxAccessCount?: number;
    /** Optional user filter (for admin analytics) */
    userId?: number;
}

// =============================
// 🔹 Alias & Validation Models
// =============================

/** Response returned when checking alias availability */
export interface AliasAvailabilityResponse {
    isAvailable: boolean;
    suggestions?: string[];
    error?: string;
    /** Optional recommended alias format */
    formatHint?: string;
}

// =============================
// 🔹 Pagination & API Responses
// =============================

/** Standard pagination metadata */
export interface PaginationMeta {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    /** Optional cursors for cursor-based pagination */
    nextCursor?: string;
    prevCursor?: string;
}

/** Standardized paginated response structure */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: PaginationMeta;
}

/** Generic API response wrapper */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: PaginationMeta;
    /** Optional error code for better frontend handling */
    errorCode?: string;
}


