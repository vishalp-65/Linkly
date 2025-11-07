import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';
import type { URLItem } from '../types/url.types';

export interface URLState {
  urls: URLItem[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  filters: {
    search: string;
    sortBy: 'created_at' | 'access_count' | 'long_url';
    sortOrder: 'asc' | 'desc';
    isCustomAlias?: boolean;
    hasExpiry?: boolean;
    isExpired?: boolean;
    dateFrom?: string;
    dateTo?: string;
    minAccessCount?: number;
    maxAccessCount?: number;
  };
  selectedUrls: string[]; // Array of short codes
}

const initialState: URLState = {
  urls: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: false,
  error: null,
  filters: {
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  selectedUrls: [],
};

const urlSlice = createSlice({
  name: 'urls',
  initialState,
  reducers: {
    setFilters: (
      state,
      action: PayloadAction<Partial<URLState['filters']>>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1; // Reset to first page when filters change
    },

    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },

    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.currentPage = 1; // Reset to first page when page size changes
    },

    clearFilters: (state) => {
      state.filters = {
        search: '',
        sortBy: 'created_at',
        sortOrder: 'desc',
      };
      state.currentPage = 1;
    },

    selectUrl: (state, action: PayloadAction<string>) => {
      if (!state.selectedUrls.includes(action.payload)) {
        state.selectedUrls.push(action.payload);
      }
    },

    deselectUrl: (state, action: PayloadAction<string>) => {
      state.selectedUrls = state.selectedUrls.filter(
        (shortCode) => shortCode !== action.payload
      );
    },

    selectAllUrls: (state) => {
      state.selectedUrls = state.urls.map((url) => url.short_code);
    },

    clearSelection: (state) => {
      state.selectedUrls = [];
    },

    // Optimistic updates
    addUrlOptimistic: (state, action: PayloadAction<URLItem>) => {
      state.urls.unshift(action.payload);
      state.totalCount += 1;
    },

    removeUrlOptimistic: (state, action: PayloadAction<string>) => {
      state.urls = state.urls.filter(
        (url) => url.short_code !== action.payload
      );
      state.totalCount = Math.max(0, state.totalCount - 1);
      state.selectedUrls = state.selectedUrls.filter(
        (shortCode) => shortCode !== action.payload
      );
    },

    updateUrlOptimistic: (
      state,
      action: PayloadAction<{ shortCode: string; updates: Partial<URLItem> }>
    ) => {
      const { shortCode, updates } = action.payload;
      const urlIndex = state.urls.findIndex(
        (url) => url.short_code === shortCode
      );
      if (urlIndex !== -1) {
        state.urls[urlIndex] = { ...state.urls[urlIndex], ...updates };
      }
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
      // Get user URLs
      .addMatcher(api.endpoints.getUserUrls.matchPending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addMatcher(api.endpoints.getUserUrls.matchFulfilled, (state, action) => {
        state.isLoading = false;
        state.urls = action.payload.data.data;
        state.totalCount = (
          action.payload.data?.data as any
        ).pagination?.totalItems;
        state.error = null;
      })
      .addMatcher(
        api.endpoints.getUserUrls.matchRejected,
        (state, action: any) => {
          state.isLoading = false;
          state.error = action.payload?.data?.message || 'Failed to load URLs';
        }
      )

      // Create short URL
      .addMatcher(
        api.endpoints.createShortUrl.matchFulfilled,
        (state, action) => {
          // Remove optimistic update and add real data
          const newUrl = action.payload.data;
          const existingIndex = state.urls.findIndex(
            (url) => url.short_code === newUrl.short_code
          );

          if (existingIndex === -1) {
            state.urls.unshift(newUrl);
            state.totalCount += 1;
          } else {
            state.urls[existingIndex] = newUrl;
          }
        }
      )
      .addMatcher(
        api.endpoints.createShortUrl.matchRejected,
        (state, action: any) => {
          state.error = action.payload?.data?.message || 'Failed to create URL';
        }
      )

      // Delete URL
      .addMatcher(api.endpoints.deleteUrl.matchFulfilled, (state, action) => {
        const shortCode = action.meta.arg.originalArgs;
        state.urls = state.urls.filter((url) => url.short_code !== shortCode);
        state.totalCount = Math.max(0, state.totalCount - 1);
        state.selectedUrls = state.selectedUrls.filter(
          (selected) => selected !== shortCode
        );
      })
      .addMatcher(
        api.endpoints.deleteUrl.matchRejected,
        (state, action: any) => {
          state.error = action.payload?.data?.message || 'Failed to delete URL';
        }
      );
  },
});

export const {
  setFilters,
  setCurrentPage,
  setPageSize,
  clearFilters,
  selectUrl,
  deselectUrl,
  selectAllUrls,
  clearSelection,
  addUrlOptimistic,
  removeUrlOptimistic,
  updateUrlOptimistic,
  setError,
  clearError,
} = urlSlice.actions;

// Selectors
export const selectURLs = (state: { urls: URLState }) => state.urls.urls;
export const selectURLsLoading = (state: { urls: URLState }) =>
  state.urls.isLoading;
export const selectURLsError = (state: { urls: URLState }) => state.urls.error;
export const selectURLFilters = (state: { urls: URLState }) =>
  state.urls.filters;
export const selectCurrentPage = (state: { urls: URLState }) =>
  state.urls.currentPage;
export const selectPageSize = (state: { urls: URLState }) =>
  state.urls.pageSize;
export const selectTotalCount = (state: { urls: URLState }) =>
  state.urls.totalCount;
export const selectSelectedUrls = (state: { urls: URLState }) =>
  state.urls.selectedUrls;

// Computed selectors
export const selectFilteredURLs = (state: { urls: URLState }) => {
  const { urls, filters } = state.urls;

  let filtered = [...urls];

  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(
      (url) =>
        url.long_url.toLowerCase().includes(searchLower) ||
        url.short_code.toLowerCase().includes(searchLower)
    );
  }

  // Apply custom alias filter
  if (filters.isCustomAlias !== undefined) {
    filtered = filtered.filter((url) =>
      filters.isCustomAlias ? url.is_custom_alias : !url.is_custom_alias
    );
  }

  // Apply expiry filter
  if (filters.hasExpiry !== undefined) {
    filtered = filtered.filter((url) =>
      filters.hasExpiry ? !!url.expires_at : !url.expires_at
    );
  }

  // Apply expired filter
  if (filters.isExpired !== undefined) {
    const now = new Date();
    filtered = filtered.filter((url) => {
      const isExpired = url.expires_at && new Date(url.expires_at) < now;
      return filters.isExpired ? isExpired : !isExpired;
    });
  }

  // Apply date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    filtered = filtered.filter((url) => new Date(url.created_at) >= fromDate);
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999); // End of day
    filtered = filtered.filter((url) => new Date(url.created_at) <= toDate);
  }

  // Apply access count filters
  if (filters.minAccessCount !== undefined) {
    filtered = filtered.filter(
      (url) => url.access_count >= filters.minAccessCount!
    );
  }

  if (filters.maxAccessCount !== undefined) {
    filtered = filtered.filter(
      (url) => url.access_count <= filters.maxAccessCount!
    );
  }

  return filtered;
};

export const selectSortedURLs = (state: { urls: URLState }) => {
  const filtered = selectFilteredURLs(state);
  const { sortBy, sortOrder } = state.urls.filters;

  return [...filtered].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortBy) {
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'access_count':
        aValue = a.access_count;
        bValue = b.access_count;
        break;
      case 'long_url':
        aValue = a.long_url.toLowerCase();
        bValue = b.long_url.toLowerCase();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

export const selectPaginatedURLs = (state: { urls: URLState }) => {
  const sorted = selectSortedURLs(state);
  const { currentPage, pageSize } = state.urls;

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return sorted.slice(startIndex, endIndex);
};

export const selectTotalPages = (state: { urls: URLState }) => {
  const filtered = selectFilteredURLs(state);
  const { pageSize } = state.urls;

  return Math.ceil(filtered.length / pageSize);
};

export const selectURLByShortCode =
  (shortCode: string) => (state: { urls: URLState }) => {
    return state.urls.urls.find((url) => url.short_code === shortCode);
  };

export const selectSelectedURLsData = (state: { urls: URLState }) => {
  const { urls, selectedUrls } = state.urls;
  return urls.filter((url) => selectedUrls.includes(url.short_code));
};

export const selectIsAllSelected = (state: { urls: URLState }) => {
  const { urls, selectedUrls } = state.urls;
  return urls.length > 0 && selectedUrls.length === urls.length;
};

export const selectHasSelection = (state: { urls: URLState }) => {
  return state.urls.selectedUrls.length > 0;
};

export default urlSlice.reducer;
