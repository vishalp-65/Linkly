import { createApi, fetchBaseQuery, retry } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../store';
import type {
  ApiResponse,
  AuthTokens,
  LongURL,
  PaginatedResponse,
  URLItem,
  URLListParams,
  User,
} from '../types/url.types';
import type { UserPermissions } from '../types/auth.types';
import type {
  UpdatePreferencesRequest,
  PreferencesResponse,
  UpdateNotificationSettingsRequest,
  NotificationSettingsResponse,
  WebhookTestRequest,
  WebhookTestResponse
} from '../types/preferences.types';
import { API_BASE_URL } from '../utils/constant';

// Custom base query with automatic token refresh and error handling
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.tokens?.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to get a new token
    const refreshToken = (api.getState() as RootState).auth.tokens?.refreshToken;

    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: '/auth/refresh-token',
          method: 'POST',
          body: { refreshToken },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        // Store the new token
        const { tokens } = (refreshResult.data as any).data;
        api.dispatch({ type: 'auth/setTokens', payload: tokens });

        // Retry the original query
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed, logout user
        api.dispatch({ type: 'auth/logout' });
      }
    } else {
      // No refresh token, logout user
      api.dispatch({ type: 'auth/logout' });
    }
  }

  return result;
};

// Add retry logic for network errors
const staggeredBaseQuery = retry(baseQueryWithReauth, {
  maxRetries: 2,
});


// API Service
export const api = createApi({
  reducerPath: 'api',
  baseQuery: staggeredBaseQuery,
  tagTypes: ['Auth', 'URLs', 'Analytics', 'Permissions', 'Preferences', 'Notifications'],
  endpoints: (builder) => ({
    // Auth Endpoints
    register: builder.mutation<
      ApiResponse<{ user: User; tokens: AuthTokens }>,
      { email: string; password: string; firstName?: string; lastName?: string }
    >({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth', 'Permissions'],
    }),

    login: builder.mutation<
      ApiResponse<{ user: User; tokens: AuthTokens }>,
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth', 'Permissions'],
    }),

    logout: builder.mutation<ApiResponse<void>, { refreshToken: string }>({
      query: (body) => ({
        url: '/auth/logout',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth', 'URLs', 'Analytics', 'Permissions'],
    }),

    refreshToken: builder.mutation<
      ApiResponse<{ tokens: AuthTokens }>,
      { refreshToken: string }
    >({
      query: (body) => ({
        url: '/auth/refresh-token',
        method: 'POST',
        body,
      }),
    }),

    getProfile: builder.query<ApiResponse<{ user: User }>, void>({
      query: () => '/auth/profile',
      providesTags: ['Auth'],
    }),

    updateProfile: builder.mutation<
      ApiResponse<{ user: User }>,
      Partial<Pick<User, 'firstName' | 'lastName' | 'avatarUrl'>>
    >({
      query: (data) => ({
        url: '/auth/profile',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Auth'],
    }),

    changePassword: builder.mutation<
      ApiResponse<void>,
      { currentPassword: string; newPassword: string }
    >({
      query: (data) => ({
        url: '/auth/change-password',
        method: 'POST',
        body: data,
      }),
    }),

    requestPasswordReset: builder.mutation<
      ApiResponse<void>,
      { email: string }
    >({
      query: (data) => ({
        url: '/auth/request-password-reset',
        method: 'POST',
        body: data,
      }),
    }),

    confirmPasswordReset: builder.mutation<
      ApiResponse<void>,
      { token: string; newPassword: string }
    >({
      query: (data) => ({
        url: '/auth/confirm-password-reset',
        method: 'POST',
        body: data,
      }),
    }),

    getPermissions: builder.query<
      ApiResponse<{ permissions: UserPermissions }>,
      void
    >({
      query: () => '/auth/permissions',
      providesTags: ['Permissions'],
    }),

    // User Preferences Endpoints
    getUserPreferences: builder.query<
      ApiResponse<PreferencesResponse>,
      void
    >({
      query: () => '/user/preferences',
      providesTags: ['Preferences'],
    }),

    updateUserPreferences: builder.mutation<
      ApiResponse<PreferencesResponse>,
      UpdatePreferencesRequest
    >({
      query: (data) => ({
        url: '/user/preferences',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Preferences'],
    }),

    // Notification Settings Endpoints
    getNotificationSettings: builder.query<
      ApiResponse<NotificationSettingsResponse>,
      void
    >({
      query: () => '/user/notifications',
      providesTags: ['Notifications'],
    }),

    updateNotificationSettings: builder.mutation<
      ApiResponse<NotificationSettingsResponse>,
      UpdateNotificationSettingsRequest
    >({
      query: (data) => ({
        url: '/user/notifications',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Notifications'],
    }),

    testWebhook: builder.mutation<
      ApiResponse<WebhookTestResponse>,
      WebhookTestRequest
    >({
      query: (data) => ({
        url: '/user/notifications/test-webhook',
        method: 'POST',
        body: data,
      }),
    }),

    deleteAccount: builder.mutation<
      ApiResponse<{ message: string }>,
      { password: string; confirmText: string }
    >({
      query: (data) => ({
        url: '/user/account',
        method: 'DELETE',
        body: data,
      }),
      invalidatesTags: ['Auth', 'URLs', 'Analytics', 'Permissions', 'Preferences', 'Notifications'],
    }),

    // URL Endpoints
    createShortUrl: builder.mutation<
      ApiResponse<URLItem>,
      { url: string; customAlias?: string; expiryDays?: number }
    >({
      query: (data) => ({
        url: '/url/shorten',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['URLs', 'Analytics'],
      // Optimistic update
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          // Invalidate and refetch user URLs
          dispatch(
            api.util.invalidateTags([
              'URLs',
              { type: 'Analytics', id: 'global' },
            ])
          );
        } catch {
          // Handle error if needed
        }
      },
    }),

    deleteUrl: builder.mutation<ApiResponse<void>, string>({
      query: (shortCode) => ({
        url: `/url/${shortCode}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, shortCode) => [
        'URLs',
        { type: 'Analytics', id: shortCode },
        { type: 'Analytics', id: 'global' },
      ],
      // Optimistic update
      async onQueryStarted(_shortCode, { queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // Handle error if needed
        }
      },
    }),

    resolveUrl: builder.query<
      ApiResponse<{
        shortCode: string;
        longUrl: string;
        accessCount: number;
        expiresAt?: string;
      }>,
      string
    >({
      query: (shortCode) => `/url/resolve/${shortCode}`,
    }),

    getUrlByShortCode: builder.query<
      ApiResponse<URLItem>,
      string
    >({
      query: (shortCode) => `/url/${shortCode}/stats`,
    }),

    getLongUrlByShortCode: builder.query<
      ApiResponse<LongURL>,
      string
    >({
      query: (shortCode) => `/url/${shortCode}`,
    }),

    checkAliasAvailability: builder.query<
      ApiResponse<{
        isAvailable: boolean;
        suggestions?: string[];
      }>,
      string
    >({
      query: (alias) => `/url/check-alias?alias=${alias}`,
    }),

    getUserUrls: builder.query<
      { data: ApiResponse<URLItem[]>; pagination: PaginatedResponse<URLItem> },
      URLListParams
    >({
      query: (params) => ({
        url: '/url/get-all',
        params: {
          page: params.page || 1,
          pageSize: params.pageSize || 10,
          ...(params.search && { search: params.search }),
          ...(params.sortBy && { sortBy: params.sortBy }),
          ...(params.sortOrder && { sortOrder: params.sortOrder }),
          ...(params.isCustomAlias !== undefined && {
            isCustomAlias: params.isCustomAlias,
          }),
          ...(params.hasExpiry !== undefined && {
            hasExpiry: params.hasExpiry,
          }),
          ...(params.isExpired !== undefined && {
            isExpired: params.isExpired,
          }),
          ...(params.dateFrom && { dateFrom: params.dateFrom }),
          ...(params.dateTo && { dateTo: params.dateTo }),
          ...(params.minAccessCount !== undefined && {
            minAccessCount: params.minAccessCount,
          }),
          ...(params.maxAccessCount !== undefined && {
            maxAccessCount: params.maxAccessCount,
          }),
        },
      }),
      providesTags: (result) => [
        'URLs',
        ...(result?.data?.data?.map(({ short_code }) => ({
          type: 'URLs' as const,
          id: short_code,
        })) ?? []),
      ],
      // Keep data for 5 minutes
      keepUnusedDataFor: 300,
    }),

    // Analytics Endpoints
    getAnalytics: builder.query<
      ApiResponse<{
        shortCode: string;
        totalClicks: number;
        uniqueVisitors: number;
        clicksByDate: Array<{ date: string; clicks: number }>;
        clicksByCountry: Array<{ country: string; clicks: number }>;
        clicksByDevice: Array<{ device: string; clicks: number }>;
        clicksByReferrer: Array<{ referrer: string; clicks: number }>;
      }>,
      { shortCode: string; dateFrom?: string; dateTo?: string }
    >({
      query: ({ shortCode, dateFrom, dateTo }) => ({
        url: `/analytics/${shortCode}`,
        params: {
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo && { date_to: dateTo }),
        }
      }),
      providesTags: (_result, _error, { shortCode }) => [
        { type: 'Analytics', id: shortCode },
        'Analytics',
      ],
      // Disable RTK Query caching for analytics
      keepUnusedDataFor: 300,
    }),

    getRealtimeAnalytics: builder.query<
      ApiResponse<{
        activeUsers: number;
        recentClicks: Array<{
          timestamp: string;
          country: string;
          device: string;
        }>;
      }>,
      string
    >({
      query: (shortCode) => ({
        url: `/analytics/${shortCode}/realtime`,
      }),
      providesTags: (_result, _error, shortCode) => [
        { type: 'Analytics', id: `${shortCode}-realtime` },
      ],
      // Keep data for 5 seconds
      keepUnusedDataFor: 30,
    }),

    getGlobalAnalytics: builder.query<
      ApiResponse<{
        totalUrls: number;
        totalClicks: number;
        activeUrls: number;
        topUrls: Array<URLItem>;
      }>,
      { dateFrom?: string; dateTo?: string }
    >({
      query: (params) => ({
        url: '/analytics/global/summary',
        params: {
          ...(params.dateFrom && { date_from: params.dateFrom }),
          ...(params.dateTo && { date_to: params.dateTo }),
        },
      }),
      providesTags: ['Analytics', 'URLs'],
      // Disable RTK Query caching for global analytics
      keepUnusedDataFor: 600,
    }),
  }),
});

// Export hooks for usage in components
export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
  useGetPermissionsQuery,
  // User Preferences
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
  // Notification Settings
  useGetNotificationSettingsQuery,
  useUpdateNotificationSettingsMutation,
  useTestWebhookMutation,
  useDeleteAccountMutation,
  // URLs
  useCreateShortUrlMutation,
  useCheckAliasAvailabilityQuery,
  useLazyCheckAliasAvailabilityQuery,
  useGetUserUrlsQuery,
  useDeleteUrlMutation,
  useResolveUrlQuery,
  useGetLongUrlByShortCodeQuery,
  useGetUrlByShortCodeQuery,
  // Analytics
  useGetAnalyticsQuery,
  useGetRealtimeAnalyticsQuery,
  useGetGlobalAnalyticsQuery,
} = api;
