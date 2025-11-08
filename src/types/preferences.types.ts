export interface UserPreferences {
    id: string;
    userId: number;
    duplicateStrategy: 'generate_new' | 'reuse_existing';
    defaultExpiry: number | null;
    customDomain: string | null;
    enableAnalytics: boolean;
    enableQRCode: boolean;
    enablePasswordProtection: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationSettings {
    id: string;
    userId: number;
    emailNotifications: {
        urlExpiring: boolean;
        urlExpired: boolean;
        highTraffic: boolean;
        weeklyReport: boolean;
        monthlyReport: boolean;
    };
    webhooks: {
        enabled: boolean;
        url: string | null;
        secret: string | null;
        events: {
            urlCreated: boolean;
            urlClicked: boolean;
            urlExpired: boolean;
            urlDeleted: boolean;
        };
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdatePreferencesRequest {
    duplicateStrategy?: 'generate_new' | 'reuse_existing';
    defaultExpiry?: number | null;
    customDomain?: string;
    enableAnalytics?: boolean;
    enableQRCode?: boolean;
    enablePasswordProtection?: boolean;
}

export interface UpdateNotificationSettingsRequest {
    emailNotifications?: {
        urlExpiring?: boolean;
        urlExpired?: boolean;
        highTraffic?: boolean;
        weeklyReport?: boolean;
        monthlyReport?: boolean;
    };
    webhooks?: {
        enabled?: boolean;
        url?: string;
        secret?: string;
        events?: {
            urlCreated?: boolean;
            urlClicked?: boolean;
            urlExpired?: boolean;
            urlDeleted?: boolean;
        };
    };
}

export interface WebhookTestRequest {
    url: string;
    secret?: string;
}

export interface WebhookTestResponse {
    success: boolean;
    statusCode?: number;
    responseTime?: number;
    error?: string;
}

export interface AccountUpdateRequest {
    email?: string;
    currentPassword: string;
}

export interface AccountDeletionRequest {
    password: string;
    confirmText: string;
}
