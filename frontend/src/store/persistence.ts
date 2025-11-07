import { store } from './index';
import { initializeAuth } from './authSlice';
import { initializeTheme, initializeLayout, initializeUIPreferences } from './uiSlice';
import { initializeLocalPreferences } from './userSlice';

/**
 * Initialize the store with persisted data from localStorage
 */
export const initializeStore = () => {
    // Initialize auth state from localStorage
    store.dispatch(initializeAuth());

    // Initialize UI preferences from localStorage
    store.dispatch(initializeTheme());
    store.dispatch(initializeLayout());
    store.dispatch(initializeUIPreferences());

    // Initialize user local preferences from localStorage
    store.dispatch(initializeLocalPreferences());
};

/**
 * Subscribe to store changes and persist relevant data to localStorage
 */
export const setupPersistence = () => {
    store.subscribe(() => {
        // Persistence is handled automatically in individual slices
        // This function is kept for future persistence logic if needed
    });
};

/**
 * Clear all persisted data (useful for logout)
 */
export const clearPersistedData = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('theme');
    localStorage.removeItem('sidebarCollapsed');
    localStorage.removeItem('uiPreferences');
    localStorage.removeItem('userLocalPreferences');
};

/**
 * Get persisted data for debugging
 */
export const getPersistedData = () => {
    return {
        accessToken: localStorage.getItem('accessToken'),
        refreshToken: localStorage.getItem('refreshToken'),
        theme: localStorage.getItem('theme'),
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed'),
        uiPreferences: localStorage.getItem('uiPreferences'),
        userLocalPreferences: localStorage.getItem('userLocalPreferences'),
    };
};