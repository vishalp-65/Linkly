import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import Button from '../components/common/Button';
import MetricCard from '../components/analytics/MetricCard';
import ClicksOverTimeChart from '../components/analytics/ClicksOverTimeChart';
import GeographicDistributionMap from '../components/analytics/GeographicDistributionMap';
import DeviceBreakdownChart from '../components/analytics/DeviceBreakdownChart';
import ReferrerTable from '../components/analytics/ReferrerTable';
import LiveClickCounter from '../components/analytics/LiveClickCounter';
import WebSocketStatus from '../components/analytics/WebSocketStatus';
import DateRangePicker, { type DateRange } from '../components/analytics/DateRangePicker';
import {
    useGetAnalyticsQuery,
    useGetRealtimeAnalyticsQuery,
    useGetUrlByShortCodeQuery,
    useGetGlobalAnalyticsQuery
} from '../services/api';
import {
    setCurrentShortCode,
    setDateRange as setAnalyticsDateRange,
    enableRealtime,
    disableRealtime,
    updateRealtimeClicks
} from '../store/analyticsSlice';
import { type RootState } from '../store';
import websocketService, { type ClickEvent } from '../services/websocket';

const AnalyticsPage: React.FC = () => {
    const { shortCode } = useParams<{ shortCode: string }>();
    const dispatch = useDispatch();
    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        label: 'Last 30 days'
    });
    const [copied, setCopied] = useState(false);

    const authToken = useSelector((state: RootState) => state.auth.tokens?.accessToken);

    // Fetch specific URL analytics
    const { data: analyticsData, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useGetAnalyticsQuery(
        {
            shortCode: shortCode || '',
            dateFrom: dateRange.start,
            dateTo: dateRange.end
        },
        { skip: !shortCode }
    );

    // Fetch global analytics when no shortCode
    const { data: globalAnalyticsData, isLoading: isLoadingGlobal } = useGetGlobalAnalyticsQuery(
        {
            dateFrom: dateRange.start,
            dateTo: dateRange.end
        },
        { skip: !!shortCode }
    );

    // Fetch realtime analytics (only for specific URLs)
    const { data: realtimeData, isLoading: isLoadingRealtime } = useGetRealtimeAnalyticsQuery(
        shortCode || '',
        {
            skip: !shortCode,
            pollingInterval: 30000
        }
    );

    // Fetch URL details (only for specific URLs)
    const { data: urlData } = useGetUrlByShortCodeQuery(shortCode || '', { skip: !shortCode });

    const isLoadingData = shortCode
        ? (isLoadingAnalytics || isLoadingRealtime)
        : isLoadingGlobal;

    // WebSocket setup (only for specific URLs)
    useEffect(() => {
        if (!shortCode || !authToken) return;

        websocketService.connect(authToken);

        const handleClickEvent = (event: ClickEvent) => {
            dispatch(updateRealtimeClicks({
                timestamp: event.timestamp,
                country: event.country || 'Unknown',
                device: event.userAgent || 'Unknown'
            }));
            refetchAnalytics();
        };

        websocketService.subscribeToClicks(shortCode, handleClickEvent);
        dispatch(enableRealtime());

        return () => {
            websocketService.unsubscribeFromClicks(shortCode, handleClickEvent);
            dispatch(disableRealtime());
        };
    }, [shortCode, authToken, dispatch, refetchAnalytics]);

    // Update Redux store
    useEffect(() => {
        if (shortCode) {
            dispatch(setCurrentShortCode(shortCode));
        }
    }, [shortCode, dispatch]);

    useEffect(() => {
        dispatch(setAnalyticsDateRange({
            startDate: dateRange.start,
            endDate: dateRange.end,
            preset: 'custom'
        }));
    }, [dateRange, dispatch]);

    const handleExport = useCallback((format: 'csv' | 'pdf') => {
        console.log(`Exporting analytics data as ${format}`);
        // TODO: Implement export functionality
    }, []);

    const handleDateRangeChange = useCallback((newRange: DateRange) => {
        setDateRange(newRange);
    }, []);

    const handleCopyUrl = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    }, [shortCode]);

    const handleShortUrlClick = useCallback(() => {
        window.open(`${window.location.origin}/${shortCode}`, '_blank', 'noopener,noreferrer');
    }, [shortCode]);

    // Prepare data based on whether we have a specific URL or global view
    const isGlobalView = !shortCode;
    const analytics = isGlobalView ? null : analyticsData?.data;
    const globalAnalytics = isGlobalView ? globalAnalyticsData?.data : null;
    const realtime = realtimeData?.data;
    const urlInfo = urlData?.data;

    // Transform data for charts
    const clicksChartData = isGlobalView
        ? []
        : (analytics?.clicksByDate?.map(item => ({
            date: item.date,
            clicks: item.clicks,
            uniqueVisitors: 0
        })) || []);

    const geoChartData = isGlobalView
        ? []
        : (analytics?.clicksByCountry?.map((item) => ({
            country: item.country,
            countryCode: item.country.substring(0, 2).toUpperCase(),
            clicks: item.clicks,
            percentage: analytics.totalClicks > 0 ? (item.clicks / analytics.totalClicks) * 100 : 0
        })) || []);

    const deviceChartData = isGlobalView
        ? []
        : (analytics?.clicksByDevice?.map((item, index) => {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
            return {
                device: item.device,
                clicks: item.clicks,
                percentage: analytics.totalClicks > 0 ? (item.clicks / analytics.totalClicks) * 100 : 0,
                color: colors[index % colors.length]
            };
        }) || []);

    const referrerTableData = isGlobalView
        ? []
        : (analytics?.clicksByReferrer?.map(item => ({
            referrer: item.referrer || '(direct)',
            clicks: item.clicks,
            percentage: analytics.totalClicks > 0 ? (item.clicks / analytics.totalClicks) * 100 : 0
        })) || []);

    // Calculate metrics
    const totalClicks = isGlobalView
        ? (globalAnalytics?.totalClicks || 0)
        : (analytics?.totalClicks || 0);

    const uniqueVisitors = isGlobalView
        ? 0
        : (analytics?.uniqueVisitors || 0);

    const avgDailyClicks = clicksChartData.length > 0
        ? Math.round(totalClicks / clicksChartData.length)
        : 0;

    const peakHour = realtime?.recentClicks && realtime.recentClicks.length > 0
        ? new Date(realtime.recentClicks[0].timestamp).getHours()
        : 14;

    const totalUrls = isGlobalView ? (globalAnalytics?.totalUrls || 0) : 1;
    const activeUrls = isGlobalView ? (globalAnalytics?.activeUrls || 0) : 1;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            {/* Background decoration */}

            <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col gap-3 sm:gap-4">
                        {/* Title and Back Button */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <button
                                    onClick={() => window.history.back()}
                                    className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    aria-label="Go back"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                                    {isGlobalView ? 'Global Analytics' : 'Analytics Dashboard'}
                                </h1>
                            </div>

                            {/* WebSocket Status (only for specific URLs) */}
                            {!isGlobalView && <WebSocketStatus className="mb-3 mt-2 ml-8 sm:ml-9" />}
                        </div>

                        {/* URL Info Card (only for specific URLs) */}
                        {!isGlobalView && (
                            <div className="bg-white dark:bg-gray-800 w-full rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                <div className="flex flex-col gap-3">
                                    {/* Short URL Row */}
                                    <div className="flex items-start sm:items-center gap-2 flex-wrap">
                                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Short URL:</span>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <button
                                                onClick={handleShortUrlClick}
                                                className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 cursor-pointer text-blue-700 dark:text-blue-300 rounded text-xs sm:text-sm font-mono hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors truncate max-w-full"
                                                title={`${window.location.origin}/${shortCode}`}
                                            >
                                                {window.location.origin}/{shortCode}
                                            </button>
                                            <button
                                                className={`p-1.5 rounded transition-all duration-200 cursor-pointer ${copied
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                                    }`}
                                                onClick={handleCopyUrl}
                                                aria-label={copied ? "Copied!" : "Copy short URL"}
                                                title={copied ? "Copied!" : "Copy short URL"}
                                            >
                                                {copied ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Destination URL Row */}
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-medium">Destination:</span>{' '}
                                        <span className="break-all">{urlInfo?.long_url || 'Loading...'}</span>
                                    </div>

                                    {/* Status and Counter Row */}
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                                            Active
                                        </span>
                                        <LiveClickCounter
                                            shortCode={shortCode || ''}
                                            initialCount={totalClicks}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Global View Info */}
                        {isGlobalView && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                    Overview of all your shortened URLs and their performance
                                </p>
                            </div>
                        )}

                        {/* Date Range and Export Controls */}
                        <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 w-full'>
                            {/* Date Range Picker */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg w-full sm:flex-1 p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                        Date Range:
                                    </div>
                                    <div className="flex-1">
                                        <DateRangePicker
                                            value={dateRange}
                                            onChange={handleDateRangeChange}
                                            disabled={isLoadingData}
                                        />
                                    </div>
                                    {isLoadingData && (
                                        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            <span className="hidden sm:inline">Updating...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Export Buttons */}
                            <div className="flex gap-2 sm:gap-3">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExport('csv')}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4"
                                    disabled={isLoadingData}
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    CSV
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExport('pdf')}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4"
                                    disabled={isLoadingData}
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="mb-6 sm:mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                        {isGlobalView ? (
                            <>
                                <MetricCard
                                    title="Total URLs"
                                    value={totalUrls}
                                    subtitle="shortened links"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Total Clicks"
                                    value={totalClicks}
                                    subtitle="across all URLs"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Active URLs"
                                    value={activeUrls}
                                    subtitle="currently active"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Avg. Clicks/URL"
                                    value={totalUrls > 0 ? Math.round(totalClicks / totalUrls) : 0}
                                    subtitle="per shortened link"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    }
                                />
                            </>
                        ) : (
                            <>
                                <MetricCard
                                    title="Total Clicks"
                                    value={totalClicks}
                                    subtitle="all time"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Unique Visitors"
                                    value={uniqueVisitors}
                                    subtitle="in selected period"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Avg. Daily Clicks"
                                    value={avgDailyClicks}
                                    subtitle="in selected period"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    }
                                />
                                <MetricCard
                                    title="Peak Traffic Hour"
                                    value={`${peakHour % 12 || 12} ${peakHour >= 12 ? 'PM' : 'AM'}`}
                                    subtitle="UTC timezone"
                                    icon={
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    }
                                />
                            </>
                        )}
                    </div>
                </div>

                {/* Charts Section */}
                {isGlobalView ? (
                    <div className="space-y-6 sm:space-y-8">
                        {/* Top URLs Table */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-4">Top Performing URLs</h2>
                            {globalAnalytics?.topUrls && globalAnalytics.topUrls.length > 0 ? (
                                <div className="overflow-x-auto -mx-4 sm:mx-0">
                                    <div className="inline-block min-w-full align-middle">
                                        <div className="overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-900/50">
                                                    <tr>
                                                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {globalAnalytics.topUrls.map((url) => (
                                                        <tr key={url.short_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                                <code className="text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400">
                                                                    {url.short_code}
                                                                </code>
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                                                                <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate max-w-md">
                                                                    {url.long_url}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                                                <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                                                    {url.access_count.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                                                                <a
                                                                    href={`/analytics/${url.short_code}`}
                                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                                                                >
                                                                    View
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 sm:py-12">
                                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <p className="mt-4 text-sm sm:text-base text-gray-500 dark:text-gray-400">
                                        No URLs found. Create your first shortened URL to see analytics.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 sm:space-y-8">
                        {/* Clicks Over Time Chart */}
                        <ClicksOverTimeChart data={clicksChartData} loading={isLoadingData} />

                        {/* Geographic and Device Analytics */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                            <GeographicDistributionMap data={geoChartData} loading={isLoadingData} />
                            <DeviceBreakdownChart data={deviceChartData} loading={isLoadingData} />
                        </div>

                        {/* Referrer Table */}
                        <ReferrerTable data={referrerTableData} loading={isLoadingData} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;