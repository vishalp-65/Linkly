import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';

export interface AnalyticsData {
    shortCode: string;
    totalClicks: number;
    uniqueVisitors: number;
    clicksByDate: Array<{ date: string; clicks: number }>;
    clicksByCountry: Array<{ country: string; clicks: number }>;
    clicksByIndianState?: Array<{ state: string; stateCode: string; clicks: number }>;
    clicksByDevice: Array<{ device: string; clicks: number }>;
    clicksByReferrer: Array<{ referrer: string; clicks: number }>;
}

export interface RealtimeData {
    activeUsers: number;
    recentClicks: Array<{
        timestamp: string;
        country: string;
        device: string;
    }>;
}

export interface GlobalAnalytics {
    totalUrls: number;
    totalClicks: number;
    activeUrls: number;
    topUrls: Array<{
        short_code: string;
        long_url: string;
        access_count: number;
    }>;
}

export interface DateRange {
    startDate: string;
    endDate: string;
    preset?: 'last7days' | 'last30days' | 'last90days' | 'custom';
}

export interface AnalyticsState {
    // Current URL analytics
    currentAnalytics: AnalyticsData | null;
    currentShortCode: string | null;

    // Realtime data
    realtimeData: RealtimeData | null;
    isRealtimeEnabled: boolean;

    // Global analytics
    globalAnalytics: GlobalAnalytics | null;

    // Date range selection
    dateRange: DateRange;

    // Cache for analytics data to reduce API calls
    analyticsCache: Record<string, {
        data: AnalyticsData;
        timestamp: number;
        dateRange: DateRange;
    }>;

    // Loading states
    isLoading: boolean;
    isRealtimeLoading: boolean;
    isGlobalLoading: boolean;

    // Error states
    error: string | null;
    realtimeError: string | null;
    globalError: string | null;

    // UI state
    selectedMetric: 'clicks' | 'visitors' | 'countries' | 'devices' | 'referrers';
    chartType: 'line' | 'bar' | 'pie';
}

const initialState: AnalyticsState = {
    currentAnalytics: null,
    currentShortCode: null,
    realtimeData: null,
    isRealtimeEnabled: false,
    globalAnalytics: null,
    dateRange: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        preset: 'last7days',
    },
    analyticsCache: {},
    isLoading: false,
    isRealtimeLoading: false,
    isGlobalLoading: false,
    error: null,
    realtimeError: null,
    globalError: null,
    selectedMetric: 'clicks',
    chartType: 'line',
};

// Cache expiry time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

const analyticsSlice = createSlice({
    name: 'analytics',
    initialState,
    reducers: {
        setCurrentShortCode: (state, action: PayloadAction<string>) => {
            state.currentShortCode = action.payload;
            state.currentAnalytics = null; // Clear previous data
        },

        setDateRange: (state, action: PayloadAction<DateRange>) => {
            state.dateRange = action.payload;
            // Clear cache when date range changes
            state.analyticsCache = {};
        },

        setDateRangePreset: (
            state,
            action: PayloadAction<'last7days' | 'last30days' | 'last90days' | 'custom'>
        ) => {
            const preset = action.payload;
            const now = new Date();
            let startDate: Date;

            switch (preset) {
                case 'last7days':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'last30days':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'last90days':
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    return; // Don't change for custom
            }

            state.dateRange = {
                startDate: startDate.toISOString().split('T')[0],
                endDate: now.toISOString().split('T')[0],
                preset,
            };

            // Clear cache when date range changes
            state.analyticsCache = {};
        },

        enableRealtime: (state) => {
            state.isRealtimeEnabled = true;
        },

        disableRealtime: (state) => {
            state.isRealtimeEnabled = false;
            state.realtimeData = null;
        },

        setSelectedMetric: (
            state,
            action: PayloadAction<'clicks' | 'visitors' | 'countries' | 'devices' | 'referrers'>
        ) => {
            state.selectedMetric = action.payload;
        },

        setChartType: (
            state,
            action: PayloadAction<'line' | 'bar' | 'pie'>
        ) => {
            state.chartType = action.payload;
        },

        // Cache management
        getCachedAnalytics: (
            state,
            action: PayloadAction<{ shortCode: string; dateRange: DateRange }>
        ) => {
            const { shortCode, dateRange } = action.payload;
            const cacheKey = `${shortCode}_${dateRange.startDate}_${dateRange.endDate}`;
            const cached = state.analyticsCache[cacheKey];

            if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
                state.currentAnalytics = cached.data;
                state.currentShortCode = shortCode;
            }
        },

        setCachedAnalytics: (
            state,
            action: PayloadAction<{
                shortCode: string;
                data: AnalyticsData;
                dateRange: DateRange;
            }>
        ) => {
            const { shortCode, data, dateRange } = action.payload;
            const cacheKey = `${shortCode}_${dateRange.startDate}_${dateRange.endDate}`;

            state.analyticsCache[cacheKey] = {
                data,
                timestamp: Date.now(),
                dateRange,
            };
        },

        clearCache: (state) => {
            state.analyticsCache = {};
        },

        // Update realtime data
        updateRealtimeClicks: (
            state,
            action: PayloadAction<{
                timestamp: string;
                country: string;
                device: string;
            }>
        ) => {
            if (state.realtimeData) {
                state.realtimeData.recentClicks.unshift(action.payload);
                // Keep only last 50 clicks
                if (state.realtimeData.recentClicks.length > 50) {
                    state.realtimeData.recentClicks = state.realtimeData.recentClicks.slice(0, 50);
                }
            }
        },

        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },

        setRealtimeError: (state, action: PayloadAction<string>) => {
            state.realtimeError = action.payload;
        },

        setGlobalError: (state, action: PayloadAction<string>) => {
            state.globalError = action.payload;
        },

        clearErrors: (state) => {
            state.error = null;
            state.realtimeError = null;
            state.globalError = null;
        },
    },

    extraReducers: (builder) => {
        builder
            // Get analytics
            .addMatcher(
                api.endpoints.getAnalytics.matchPending,
                (state) => {
                    state.isLoading = true;
                    state.error = null;
                }
            )
            .addMatcher(
                api.endpoints.getAnalytics.matchFulfilled,
                (state, action) => {
                    state.isLoading = false;
                    state.currentAnalytics = action.payload.data;
                    state.error = null;

                    // Cache the result
                    if (state.currentShortCode) {
                        const cacheKey = `${state.currentShortCode}_${state.dateRange.startDate}_${state.dateRange.endDate}`;
                        state.analyticsCache[cacheKey] = {
                            data: action.payload.data,
                            timestamp: Date.now(),
                            dateRange: state.dateRange,
                        };
                    }
                }
            )
            .addMatcher(
                api.endpoints.getAnalytics.matchRejected,
                (state, action: any) => {
                    state.isLoading = false;
                    state.error = action.payload?.data?.message || 'Failed to load analytics';
                }
            )

            // Get realtime analytics
            .addMatcher(
                api.endpoints.getRealtimeAnalytics.matchPending,
                (state) => {
                    state.isRealtimeLoading = true;
                    state.realtimeError = null;
                }
            )
            .addMatcher(
                api.endpoints.getRealtimeAnalytics.matchFulfilled,
                (state, action) => {
                    state.isRealtimeLoading = false;
                    state.realtimeData = action.payload.data;
                    state.realtimeError = null;
                }
            )
            .addMatcher(
                api.endpoints.getRealtimeAnalytics.matchRejected,
                (state, action: any) => {
                    state.isRealtimeLoading = false;
                    state.realtimeError = action.payload?.data?.message || 'Failed to load realtime data';
                }
            )

            // Get global analytics
            .addMatcher(
                api.endpoints.getGlobalAnalytics.matchPending,
                (state) => {
                    state.isGlobalLoading = true;
                    state.globalError = null;
                }
            )
            .addMatcher(
                api.endpoints.getGlobalAnalytics.matchFulfilled,
                (state, action) => {
                    state.isGlobalLoading = false;
                    state.globalAnalytics = action.payload.data;
                    state.globalError = null;
                }
            )
            .addMatcher(
                api.endpoints.getGlobalAnalytics.matchRejected,
                (state, action: any) => {
                    state.isGlobalLoading = false;
                    state.globalError = action.payload?.data?.message || 'Failed to load global analytics';
                }
            );
    },
});

export const {
    setCurrentShortCode,
    setDateRange,
    setDateRangePreset,
    enableRealtime,
    disableRealtime,
    setSelectedMetric,
    setChartType,
    getCachedAnalytics,
    setCachedAnalytics,
    clearCache,
    updateRealtimeClicks,
    setError,
    setRealtimeError,
    setGlobalError,
    clearErrors,
} = analyticsSlice.actions;

export default analyticsSlice.reducer;

// Selectors
export const selectCurrentAnalytics = (state: { analytics: AnalyticsState }) =>
    state.analytics.currentAnalytics;

export const selectCurrentShortCode = (state: { analytics: AnalyticsState }) =>
    state.analytics.currentShortCode;

export const selectRealtimeData = (state: { analytics: AnalyticsState }) =>
    state.analytics.realtimeData;

export const selectIsRealtimeEnabled = (state: { analytics: AnalyticsState }) =>
    state.analytics.isRealtimeEnabled;

export const selectGlobalAnalytics = (state: { analytics: AnalyticsState }) =>
    state.analytics.globalAnalytics;

export const selectDateRange = (state: { analytics: AnalyticsState }) =>
    state.analytics.dateRange;

export const selectAnalyticsLoading = (state: { analytics: AnalyticsState }) =>
    state.analytics.isLoading;

export const selectRealtimeLoading = (state: { analytics: AnalyticsState }) =>
    state.analytics.isRealtimeLoading;

export const selectGlobalLoading = (state: { analytics: AnalyticsState }) =>
    state.analytics.isGlobalLoading;

export const selectAnalyticsError = (state: { analytics: AnalyticsState }) =>
    state.analytics.error;

export const selectRealtimeError = (state: { analytics: AnalyticsState }) =>
    state.analytics.realtimeError;

export const selectGlobalError = (state: { analytics: AnalyticsState }) =>
    state.analytics.globalError;

export const selectSelectedMetric = (state: { analytics: AnalyticsState }) =>
    state.analytics.selectedMetric;

export const selectChartType = (state: { analytics: AnalyticsState }) =>
    state.analytics.chartType;

// Computed selectors
export const selectAnalyticsCache = (state: { analytics: AnalyticsState }) =>
    state.analytics.analyticsCache;

export const selectCachedAnalytics = (shortCode: string, dateRange: DateRange) =>
    (state: { analytics: AnalyticsState }) => {
        const cacheKey = `${shortCode}_${dateRange.startDate}_${dateRange.endDate}`;
        const cached = state.analytics.analyticsCache[cacheKey];

        if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 minutes
            return cached.data;
        }

        return null;
    };

export const selectMetricData = (state: { analytics: AnalyticsState }) => {
    const analytics = state.analytics.currentAnalytics;
    const selectedMetric = state.analytics.selectedMetric;

    if (!analytics) return null;

    switch (selectedMetric) {
        case 'clicks':
            return analytics.clicksByDate;
        case 'visitors':
            return [{ label: 'Unique Visitors', value: analytics.uniqueVisitors }];
        case 'countries':
            return analytics.clicksByCountry;
        case 'devices':
            return analytics.clicksByDevice;
        case 'referrers':
            return analytics.clicksByReferrer;
        default:
            return null;
    }
};

export const selectTopCountries = (limit: number = 5) =>
    (state: { analytics: AnalyticsState }) => {
        const analytics = state.analytics.currentAnalytics;
        if (!analytics) return [];

        return analytics.clicksByCountry
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, limit);
    };

export const selectTopDevices = (limit: number = 5) =>
    (state: { analytics: AnalyticsState }) => {
        const analytics = state.analytics.currentAnalytics;
        if (!analytics) return [];

        return analytics.clicksByDevice
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, limit);
    };

export const selectTopReferrers = (limit: number = 5) =>
    (state: { analytics: AnalyticsState }) => {
        const analytics = state.analytics.currentAnalytics;
        if (!analytics) return [];

        return analytics.clicksByReferrer
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, limit);
    };

export const selectClickTrend = (state: { analytics: AnalyticsState }) => {
    const analytics = state.analytics.currentAnalytics;
    if (!analytics || analytics.clicksByDate.length < 2) return 0;

    const sortedData = [...analytics.clicksByDate].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const recent = sortedData.slice(-7); // Last 7 days
    const previous = sortedData.slice(-14, -7); // Previous 7 days

    const recentTotal = recent.reduce((sum, day) => sum + day.clicks, 0);
    const previousTotal = previous.reduce((sum, day) => sum + day.clicks, 0);

    if (previousTotal === 0) return recentTotal > 0 ? 100 : 0;

    return ((recentTotal - previousTotal) / previousTotal) * 100;
};

export const selectPeakHour = (state: { analytics: AnalyticsState }) => {
    const realtimeData = state.analytics.realtimeData;
    if (!realtimeData || realtimeData.recentClicks.length === 0) return null;

    const hourCounts: Record<number, number> = {};

    realtimeData.recentClicks.forEach((click) => {
        const hour = new Date(click.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let peakHour = 0;
    let maxClicks = 0;

    Object.entries(hourCounts).forEach(([hour, clicks]) => {
        if (clicks > maxClicks) {
            maxClicks = clicks;
            peakHour = parseInt(hour);
        }
    });

    return { hour: peakHour, clicks: maxClicks };
};

export const selectAnalyticsSummary = (state: { analytics: AnalyticsState }) => {
    const analytics = state.analytics.currentAnalytics;
    const realtimeData = state.analytics.realtimeData;
    const trend = selectClickTrend(state);
    const peakHour = selectPeakHour(state);

    if (!analytics) return null;

    return {
        totalClicks: analytics.totalClicks,
        uniqueVisitors: analytics.uniqueVisitors,
        clickTrend: trend,
        peakHour,
        activeUsers: realtimeData?.activeUsers || 0,
        topCountry: analytics.clicksByCountry[0]?.country || 'Unknown',
        topDevice: analytics.clicksByDevice[0]?.device || 'Unknown',
    };
};