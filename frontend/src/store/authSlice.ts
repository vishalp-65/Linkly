import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';
import type { AuthState, UserPermissions } from '../types/auth.types';
import type { AuthTokens, User } from '../types/url.types';

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isGuest: false,
  isInitialized: false,
  permissions: null,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; tokens: AuthTokens }>
    ) => {
      state.user = action.payload.user;
      state.tokens = action.payload.tokens;
      state.isAuthenticated = true;
      state.isGuest = false;
      state.error = null;

      // Store tokens in localStorage
      localStorage.setItem('accessToken', action.payload.tokens.accessToken);
      localStorage.setItem('refreshToken', action.payload.tokens.refreshToken);
    },

    setTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
      state.isAuthenticated = true;
      state.isGuest = false;
      state.error = null;

      // Update tokens in localStorage
      localStorage.setItem('accessToken', action.payload.accessToken);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    },

    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isGuest = false;
    },

    setPermissions: (state, action: PayloadAction<UserPermissions>) => {
      state.permissions = action.payload;
    },

    setGuestMode: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isGuest = true;
      state.error = null;
      // Guest permissions - limited
      state.permissions = {
        canViewAnalytics: false,
        canCreateCustomAlias: false,
        canSetCustomExpiry: false,
        canViewStats: false,
        canDuplicateUrls: false,
        maxUrlsExpiry: 365,
        canExportData: false,
        maxUrlsPerDay: 5,
        maxUrlsTotal: 10,
      };
    },

    logout: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isGuest = false;
      state.permissions = null;
      state.error = null;

      // Clear tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },

    initializeAuth: (state) => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (accessToken && refreshToken) {
        state.tokens = {
          accessToken,
          refreshToken,
          expiresIn: 900,
        };
        state.isAuthenticated = true;
        state.isGuest = false;
      } else {
        // No tokens found, set guest mode
        state.isGuest = true;
        state.isAuthenticated = false;
        state.permissions = {
          canViewAnalytics: false,
          canCreateCustomAlias: false,
          canSetCustomExpiry: false,
          canViewStats: false,
          canDuplicateUrls: false,
          maxUrlsExpiry: 365,
          canExportData: false,
          maxUrlsPerDay: 5,
          maxUrlsTotal: 10,
        };
      }
      state.isInitialized = true;
    },

    clearAuth: (state) => {
      state.user = null;
      state.tokens = null;
      state.isAuthenticated = false;
      state.isGuest = true;
      state.permissions = null;
      state.error = null;

      // Clear tokens from localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Login
      .addMatcher(api.endpoints.login.matchFulfilled, (state, action) => {
        const { user, tokens } = action.payload.data;
        state.user = user;
        state.tokens = tokens;
        state.isAuthenticated = true;
        state.isGuest = false;
        state.error = null;

        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
      })
      .addMatcher(api.endpoints.login.matchRejected, (state, action: any) => {
        state.error = action.payload?.data?.message || 'Login failed';
      })

      // Register
      .addMatcher(api.endpoints.register.matchFulfilled, (state, action) => {
        const { user, tokens } = action.payload.data;
        state.user = user;
        state.tokens = tokens;
        state.isAuthenticated = true;
        state.isGuest = false;
        state.error = null;

        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('refreshToken', tokens.refreshToken);
      })
      .addMatcher(
        api.endpoints.register.matchRejected,
        (state, action: any) => {
          state.error = action.payload?.data?.message || 'Registration failed';
        }
      )

      // Logout
      .addMatcher(api.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.tokens = null;
        state.isAuthenticated = false;
        state.isGuest = true;
        state.permissions = null;
        state.error = null;

        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      })

      // Refresh token
      .addMatcher(
        api.endpoints.refreshToken.matchFulfilled,
        (state, action) => {
          const { tokens } = action.payload.data;
          state.tokens = tokens;
          state.isAuthenticated = true;
          state.isGuest = false;

          localStorage.setItem('accessToken', tokens.accessToken);
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
      )

      // Get profile
      .addMatcher(api.endpoints.getProfile.matchFulfilled, (state, action) => {
        state.user = action.payload.data.user;
        state.isAuthenticated = true;
        state.isGuest = false;
      })

      // Get permissions
      .addMatcher(
        api.endpoints.getPermissions.matchFulfilled,
        (state, action) => {
          state.permissions = action.payload.data.permissions;
        }
      )

      // Update Profile
      .addMatcher(api.endpoints.updateProfile.matchFulfilled, (state, action) => {
        state.user = action.payload.data.user;
        state.error = null;
      })
      .addMatcher(api.endpoints.updateProfile.matchRejected, (state, action: any) => {
        state.error = action.payload?.data?.message || 'Failed to update profile';
      })

      // Change Password
      .addMatcher(api.endpoints.changePassword.matchFulfilled, (state) => {
        state.error = null;
      })
      .addMatcher(api.endpoints.changePassword.matchRejected, (state, action: any) => {
        state.error = action.payload?.data?.message || 'Failed to change password';
      })

      // Request Password Reset
      .addMatcher(api.endpoints.requestPasswordReset.matchFulfilled, (state) => {
        state.error = null;
      })
      .addMatcher(api.endpoints.requestPasswordReset.matchRejected, (state, action: any) => {
        state.error = action.payload?.data?.message || 'Failed to request password reset';
      })

      // Confirm Password Reset
      .addMatcher(api.endpoints.confirmPasswordReset.matchFulfilled, (state) => {
        state.error = null;
      })
      .addMatcher(api.endpoints.confirmPasswordReset.matchRejected, (state, action: any) => {
        state.error = action.payload?.data?.message || 'Failed to reset password';
      })

      // Handle 401 errors
      .addMatcher(
        (action) =>
          action.type.endsWith('/rejected') && action.payload?.status === 401,
        (state) => {
          state.user = null;
          state.tokens = null;
          state.isAuthenticated = false;
          state.isGuest = true;
          state.error = 'Session expired. Please login again.';

          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      );
  },
});

export const {
  setCredentials,
  setTokens,
  setUser,
  setPermissions,
  setGuestMode,
  logout,
  initializeAuth,
  clearAuth,
  setError,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
