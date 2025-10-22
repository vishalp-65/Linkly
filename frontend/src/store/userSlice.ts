import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';
import type {
    UserPreferences,
    NotificationSettings,
} from '../types/preferences.types';

export interface UserState {
    // User preferences
    preferences: UserPreferences | null;

    // Notification settings
    notificationSettings: NotificationSettings | null;

    // Loading states
    isLoadingPreferences: boolean;
    isLoadingNotifications: boolean;

    // Error states
    preferencesError: string | null;
    notificationsError: string | null;

    // Local preferences (persisted to localStorage)
    localPreferences: {
        duplicateStrategy: 'generate_new' | 'reuse_existing';
        defaultExpiry: number | null; // days
        customDomain: string | null;
        language: string;
        timezone: string;
    };
}

const initialState: UserState = {
    preferences: null,
    notificationSettings: null,
    isLoadingPreferences: false,
    isLoadingNotifications: false,
    preferencesError: null,
    notificationsError: null,
    localPreferences: {
        duplicateStrategy: 'generate_new',
        defaultExpiry: null,
        customDomain: null,
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        // Local preferences (stored in localStorage)
        setLocalPreferences: (
            state,
            action: PayloadAction<Partial<UserState['localPreferences']>>
        ) => {
            state.localPreferences = { ...state.localPreferences, ...action.payload };
            localStorage.setItem('userLocalPreferences', JSON.stringify(state.localPreferences));
        },

        initializeLocalPreferences: (state) => {
            const saved = localStorage.getItem('userLocalPreferences');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    state.localPreferences = { ...state.localPreferences, ...parsed };
                } catch (error) {
                    console.warn('Failed to parse user preferences from localStorage');
                }
            }
        },

        // Optimistic updates for better UX
        updatePreferencesOptimistic: (
            state,
            action: PayloadAction<Partial<UserPreferences>>
        ) => {
            if (state.preferences) {
                state.preferences = { ...state.preferences, ...action.payload };
            }
        },

        updateNotificationSettingsOptimistic: (
            state,
            action: PayloadAction<Partial<NotificationSettings>>
        ) => {
            if (state.notificationSettings) {
                state.notificationSettings = { ...state.notificationSettings, ...action.payload };
            }
        },

        // Error handling
        setPreferencesError: (state, action: PayloadAction<string>) => {
            state.preferencesError = action.payload;
        },

        setNotificationsError: (state, action: PayloadAction<string>) => {
            state.notificationsError = action.payload;
        },

        clearErrors: (state) => {
            state.preferencesError = null;
            state.notificationsError = null;
        },

        // Reset state (on logout)
        resetUserState: (state) => {
            state.preferences = null;
            state.notificationSettings = null;
            state.preferencesError = null;
            state.notificationsError = null;
            state.isLoadingPreferences = false;
            state.isLoadingNotifications = false;
            // Keep local preferences
        },
    },

    extraReducers: (builder) => {
        builder
            // Get user preferences
            .addMatcher(
                api.endpoints.getUserPreferences.matchPending,
                (state) => {
                    state.isLoadingPreferences = true;
                    state.preferencesError = null;
                }
            )
            .addMatcher(
                api.endpoints.getUserPreferences.matchFulfilled,
                (state, action) => {
                    state.isLoadingPreferences = false;
                    state.preferences = action.payload.data.preferences;
                    state.preferencesError = null;
                }
            )
            .addMatcher(
                api.endpoints.getUserPreferences.matchRejected,
                (state, action: any) => {
                    state.isLoadingPreferences = false;
                    state.preferencesError = action.payload?.data?.message || 'Failed to load preferences';
                }
            )

            // Update user preferences
            .addMatcher(
                api.endpoints.updateUserPreferences.matchPending,
                (state) => {
                    state.preferencesError = null;
                }
            )
            .addMatcher(
                api.endpoints.updateUserPreferences.matchFulfilled,
                (state, action) => {
                    state.preferences = action.payload.data.preferences;
                    state.preferencesError = null;
                }
            )
            .addMatcher(
                api.endpoints.updateUserPreferences.matchRejected,
                (state, action: any) => {
                    state.preferencesError = action.payload?.data?.message || 'Failed to update preferences';
                }
            )

            // Get notification settings
            .addMatcher(
                api.endpoints.getNotificationSettings.matchPending,
                (state) => {
                    state.isLoadingNotifications = true;
                    state.notificationsError = null;
                }
            )
            .addMatcher(
                api.endpoints.getNotificationSettings.matchFulfilled,
                (state, action) => {
                    state.isLoadingNotifications = false;
                    state.notificationSettings = action.payload.data.notifications;
                    state.notificationsError = null;
                }
            )
            .addMatcher(
                api.endpoints.getNotificationSettings.matchRejected,
                (state, action: any) => {
                    state.isLoadingNotifications = false;
                    state.notificationsError = action.payload?.data?.message || 'Failed to load notification settings';
                }
            )

            // Update notification settings
            .addMatcher(
                api.endpoints.updateNotificationSettings.matchPending,
                (state) => {
                    state.notificationsError = null;
                }
            )
            .addMatcher(
                api.endpoints.updateNotificationSettings.matchFulfilled,
                (state, action) => {
                    state.notificationSettings = action.payload.data.notifications;
                    state.notificationsError = null;
                }
            )
            .addMatcher(
                api.endpoints.updateNotificationSettings.matchRejected,
                (state, action: any) => {
                    state.notificationsError = action.payload?.data?.message || 'Failed to update notification settings';
                }
            )

            // Reset on logout
            .addMatcher(
                api.endpoints.logout.matchFulfilled,
                (state) => {
                    state.preferences = null;
                    state.notificationSettings = null;
                    state.preferencesError = null;
                    state.notificationsError = null;
                    state.isLoadingPreferences = false;
                    state.isLoadingNotifications = false;
                }
            );
    },
});

export const {
    setLocalPreferences,
    initializeLocalPreferences,
    updatePreferencesOptimistic,
    updateNotificationSettingsOptimistic,
    setPreferencesError,
    setNotificationsError,
    clearErrors,
    resetUserState,
} = userSlice.actions;

export default userSlice.reducer;