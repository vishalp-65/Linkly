import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import type {
  ApiResponse,
  AuthTokens,
  PaginatedResponse,
  URLItem,
  URLListParams,
  User,
} from '../types/url.types';
import type { UserPermissions } from '../types/auth.types';
import { API_BASE_URL } from '../utils/constant';


// API Service
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.tokens?.accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Auth', 'URLs', 'Analytics', 'Permissions'],
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
      invalidatesTags: ['URLs'],
    }),

    deleteUrl: builder.mutation<ApiResponse<void>, string>({
      query: (shortCode) => ({
        url: `/url/${shortCode}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['URLs'],
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
      providesTags: ['URLs'],
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
        },
      }),
      providesTags: ['Analytics'],
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
      query: (shortCode) => `/analytics/${shortCode}/realtime`,
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
      providesTags: ['Analytics'],
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
  // URLs
  useCreateShortUrlMutation,
  useCheckAliasAvailabilityQuery,
  useLazyCheckAliasAvailabilityQuery,
  useGetUserUrlsQuery,
  useDeleteUrlMutation,
  useResolveUrlQuery,
  // Analytics
  useGetAnalyticsQuery,
  useGetRealtimeAnalyticsQuery,
  useGetGlobalAnalyticsQuery,
} = api;
