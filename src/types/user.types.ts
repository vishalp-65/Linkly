export interface User {
    userId: number;
    email: string;
    firstName?: string;
    lastName?: string;
    googleId?: string;
    avatarUrl?: string;
    emailVerified: boolean;
    isActive: boolean;
    role: 'user' | 'admin';
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

export interface CreateUserRequest {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface GoogleAuthRequest {
    googleToken: string;
}

export interface ResetPasswordRequest {
    email: string;
}

export interface ConfirmResetPasswordRequest {
    token: string;
    newPassword: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface UpdateProfileRequest {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface JwtPayload {
    userId: number;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

export interface RefreshToken {
    id: string;
    userId: number;
    token: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
}

export interface PasswordResetToken {
    id: string;
    userId: number;
    token: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
}

export interface EmailVerificationToken {
    id: string;
    userId: number;
    token: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
}

export interface UserPermissions {
    canCreateCustomAlias: boolean;
    canViewAnalytics: boolean;
    canSetCustomExpiry: boolean;
    canDuplicateUrls: boolean;
    maxUrlsPerDay: number;
    maxUrlExpiry: number; // in days
}

export const GUEST_PERMISSIONS: UserPermissions = {
    canCreateCustomAlias: false,
    canViewAnalytics: false,
    canSetCustomExpiry: false,
    canDuplicateUrls: false,
    maxUrlsPerDay: 10,
    maxUrlExpiry: 7, // 7 days for guests
};

export const USER_PERMISSIONS: UserPermissions = {
    canCreateCustomAlias: true,
    canViewAnalytics: true,
    canSetCustomExpiry: true,
    canDuplicateUrls: true,
    maxUrlsPerDay: 100,
    maxUrlExpiry: 365, // 1 year for registered users
};