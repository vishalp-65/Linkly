import type { AuthTokens, User } from "./url.types";

/** Feature access and usage limits based on role or subscription */
export interface UserPermissions {
    canViewAnalytics: boolean;
    canCreateCustomAlias: boolean;
    canSetCustomExpiry: boolean;
    canViewStats: boolean;
    maxUrlsPerDay: number;
    maxUrlsExpiry: number;
    canDuplicateUrls: boolean;
    canExportData?: boolean;
    maxUrlsTotal?: number;
    /** Optional flag for beta features */
    canAccessBeta?: boolean;
}


export interface AuthState {
    user: User | null;
    tokens: AuthTokens | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    isInitialized: boolean;
    permissions: UserPermissions | null;
    error: string | null;
}