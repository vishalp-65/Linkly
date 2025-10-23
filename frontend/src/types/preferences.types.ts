export interface UserPreferences {
    duplicateStrategy: 'generate_new' | 'reuse_existing';
    defaultExpiry: number | null; // null for permanent, number for days
    customDomain?: string;
    enableAnalytics: boolean;
    enableQRCode: boolean;
    enablePasswordProtection: boolean;
}

export interface NotificationSettings {
    emailNotifications: {
        urlExpiring: boolean;
        urlExpired: boolean;
        highTraffic: boolean;
        weeklyReport: boolean;
        monthlyReport: boolean;
    };
    webhooks: {
        enabled: boolean;
        url: string;
        secret?: string;
        events: {
            urlCreated: boolean;
            urlClicked: boolean;
            urlExpired: boolean;
            urlDeleted: boolean;
        };
    };
}

export interface UpdatePreferencesRequest extends Partial<UserPreferences> { }

export interface UpdateNotificationSettingsRequest extends Partial<NotificationSettings> { }

export interface PreferencesResponse {
    preferences: UserPreferences;
}

export interface NotificationSettingsResponse {
    notifications: NotificationSettings;
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