import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Define types for URL management
export interface URLItem {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  customAlias?: string;
  clickCount: number;
  createdAt: string;
  expiryDate?: string;
  isExpired: boolean;
  status: 'active' | 'expired';
}

export interface URLListResponse {
  urls: URLItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface URLListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'active' | 'expired';
  sortBy?: 'date' | 'clicks' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
}

// Define the base API
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
  }),
  tagTypes: ['URL', 'Analytics'],
  endpoints: (builder) => ({
    checkAliasAvailability: builder.query<
      { available: boolean; suggestions?: string[] },
      string
    >({
      query: (alias) => `/urls/check-alias/${encodeURIComponent(alias)}`,
    }),
    createShortUrl: builder.mutation<
      {
        shortUrl: string;
        originalUrl: string;
        customAlias?: string;
        expiryDate?: string;
        createdAt: string;
      },
      {
        originalUrl: string;
        customAlias?: string;
        expiryDays?: number;
      }
    >({
      query: (data) => ({
        url: '/urls',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['URL'],
    }),
    getUserUrls: builder.query<URLListResponse, URLListParams>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params.page) searchParams.append('page', params.page.toString());
        if (params.limit) searchParams.append('limit', params.limit.toString());
        if (params.search) searchParams.append('search', params.search);
        if (params.status && params.status !== 'all') searchParams.append('status', params.status);
        if (params.sortBy) searchParams.append('sortBy', params.sortBy);
        if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);

        return `/urls?${searchParams.toString()}`;
      },
      providesTags: ['URL'],
    }),
    deleteUrl: builder.mutation<{ success: boolean }, string>({
      query: (shortCode) => ({
        url: `/urls/${shortCode}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['URL'],
    }),
  }),
});

export const {
  useCheckAliasAvailabilityQuery,
  useLazyCheckAliasAvailabilityQuery,
  useCreateShortUrlMutation,
  useGetUserUrlsQuery,
  useDeleteUrlMutation
} = api;

export default api;
