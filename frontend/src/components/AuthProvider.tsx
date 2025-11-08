import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { initializeAuth, clearAuth, setGuestMode } from '../store/authSlice';
import {
    useGetPermissionsQuery,
    useGetProfileQuery,
    useRefreshTokenMutation,
    useGetUserPreferencesQuery,
    useGetNotificationSettingsQuery
} from '../services/api';

interface AuthProviderProps {
    children: React.ReactNode;
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { tokens, isAuthenticated, isInitialized, isGuest } = useSelector((state: RootState) => state.auth);

    const [refreshToken] = useRefreshTokenMutation();

    // Always fetch permissions (works for both guest and authenticated users)
    const { error: permissionsError } = useGetPermissionsQuery(undefined, {
        skip: !isInitialized,
    });

    // Only fetch profile if authenticated
    const { error: profileError } = useGetProfileQuery(undefined, {
        skip: !isAuthenticated || isGuest,
    });

    // Fetch user preferences if authenticated
    useGetUserPreferencesQuery(undefined, {
        skip: !isAuthenticated || isGuest,
    });

    // Fetch notification settings if authenticated
    useGetNotificationSettingsQuery(undefined, {
        skip: !isAuthenticated || isGuest,
    });

    // Initialize auth on app start
    useEffect(() => {
        if (!isInitialized) {
            dispatch(initializeAuth());
        }
    }, [dispatch, isInitialized]);

    // Handle permissions data
    useEffect(() => {
        if (permissionsError) {
            console.error('Failed to fetch permissions:', permissionsError);
            // If not authenticated and permissions fail, set guest mode
            if (!isAuthenticated) {
                dispatch(setGuestMode());
            }
        }
    }, [permissionsError, isAuthenticated, dispatch]);

    // Handle profile error
    useEffect(() => {
        if (profileError && isAuthenticated) {
            console.error('Failed to fetch profile:', profileError);
            // If profile fetch fails with 401, clear auth
            if ('status' in profileError && profileError.status === 401) {
                dispatch(clearAuth());
            }
        }
    }, [profileError, isAuthenticated, dispatch]);

    // Set up token refresh interval
    const setupTokenRefresh = useCallback(() => {
        if (!isAuthenticated || !tokens?.refreshToken || isGuest) return;

        // Refresh token every 14 minutes (access token expires in 15 minutes)
        const interval = setInterval(async () => {
            try {
                await refreshToken({ refreshToken: tokens.refreshToken }).unwrap();
            } catch (error) {
                console.error('Token refresh failed:', error);
                dispatch(clearAuth());
                dispatch(setGuestMode());
            }
        }, 14 * 60 * 1000); // 14 minutes

        return () => clearInterval(interval);
    }, [isAuthenticated, tokens?.refreshToken, isGuest, refreshToken, dispatch]);

    useEffect(() => {
        return setupTokenRefresh();
    }, [setupTokenRefresh]);

    // Show loading spinner while initializing
    if (!isInitialized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
                <div className="flex flex-col items-center">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200"></div>
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent absolute top-0 left-0"></div>
                    </div>
                    <p className="mt-6 text-gray-600 font-medium">Loading ShortLink...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthProvider;