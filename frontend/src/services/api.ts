import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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
  }),
});

export const {
  useCheckAliasAvailabilityQuery,
  useLazyCheckAliasAvailabilityQuery,
  useCreateShortUrlMutation
} = api;

export default api;
