import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Button from '../components/common/Button';
import MetricCard from '../components/analytics/MetricCard';
import ClicksOverTimeChart from '../components/analytics/ClicksOverTimeChart';
import GeographicDistributionMap from '../components/analytics/GeographicDistributionMap';
import DeviceBreakdownChart from '../components/analytics/DeviceBreakdownChart';
import ReferrerTable from '../components/analytics/ReferrerTable';
import LiveUpdateToggle from '../components/analytics/LiveUpdateToggle';
import WebSocketStatus from '../components/analytics/WebSocketStatus';
import DateRangePicker, { type DateRange } from '../components/analytics/DateRangePicker';
import websocketService, { type ClickEvent } from '../services/websocket';
import {
    useGetAnalyticsQuery,
    useGetUrlByShortCodeQuery,
    useGetGlobalAnalyticsQuery
} from '../services/api';
import { setCurrentShortCode, setDateRange as setAnalyticsDateRange } from '../store/analyticsSlice';
import PageHeader from '../components/common/PageHeader';

const AnalyticsPage: React.FC = () => {
    const { shortCode } = useParams<{ shortCode: string }>();
    const dispatch = useDispatch();

    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
        label: 'Last 30 days'
    });
    const [copied, setCopied] = useState(false);
    const [liveUpdatesEnabled, setLiveUpdatesEnabled] = useState(true);
    const [liveClickCount, setLiveClickCount] = useState(0);

    const { data: analyticsData, isLoading: isLoadingAnalytics, refetch: refetchAnalytics } = useGetAnalyticsQuery(
        { shortCode: shortCode || '', dateFrom: dateRange.start, dateTo: dateRange.end },
        { skip: !shortCode, pollingInterval: liveUpdatesEnabled && shortCode ? 10000 : 0 }
    );

    const { data: globalAnalyticsData, isLoading: isLoadingGlobal } = useGetGlobalAnalyticsQuery(
        { dateFrom: dateRange.start, dateTo: dateRange.end },
        { skip: !!shortCode }
    );

    const { data: urlData } = useGetUrlByShortCodeQuery(shortCode || '', { skip: !shortCode });

    const isLoadingData = shortCode ? isLoadingAnalytics : isLoadingGlobal;
    const isGlobalView = !shortCode;
    const analytics = isGlobalView ? null : analyticsData?.data;
    const globalAnalytics = isGlobalView ? globalAnalyticsData?.data : null;
    const urlInfo = urlData?.data;

    useEffect(() => {
        if (shortCode) dispatch(setCurrentShortCode(shortCode));
    }, [shortCode, dispatch]);

    useEffect(() => {
        dispatch(setAnalyticsDateRange({ startDate: dateRange.start, endDate: dateRange.end, preset: 'custom' }));
    }, [dateRange, dispatch]);

    useEffect(() => {
        if (analytics?.totalClicks) setLiveClickCount(analytics.totalClicks);
    }, [analytics?.totalClicks]);

    useEffect(() => {
        if (!shortCode || !liveUpdatesEnabled) return;

        websocketService.connect();
        const handleClickEvent = (event: ClickEvent) => {
            if (event.shortCode === shortCode) {
                setLiveClickCount(prev => prev + 1);
                refetchAnalytics();
            }
        };
        websocketService.subscribeToClicks(shortCode, handleClickEvent);
        return () => websocketService.unsubscribeFromClicks(shortCode, handleClickEvent);
    }, [shortCode, liveUpdatesEnabled, refetchAnalytics]);

    const handleCopyUrl = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(`${window.location.origin}/${shortCode}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, [shortCode]);

    const totalClicks = isGlobalView ? (globalAnalytics?.totalClicks || 0) : (liveUpdatesEnabled ? liveClickCount : (analytics?.totalClicks || 0));
    const uniqueVisitors = isGlobalView ? 0 : (analytics?.uniqueVisitors || 0);
    const totalUrls = isGlobalView ? (globalAnalytics?.totalUrls || 0) : 1;
    const activeUrls = isGlobalView ? (globalAnalytics?.activeUrls || 0) : 1;

    const clicksChartData = isGlobalView ? [] : (analytics?.clicksByDate?.map(item => ({
        date: item.date,
        clicks: item.clicks,
        uniqueVisitors: 0
    })) || []);

    const avgDailyClicks = clicksChartData.length > 0 ? Math.round(totalClicks / clicksChartData.length) : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
            <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">

                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <PageHeader
                                title={isGlobalView ? 'Global Analytics' : 'Analytics Dashboard'}
                                subtitle={isGlobalView ? "Overview of all your shortened URLs" : <WebSocketStatus isLiveUpdateEnabled={liveUpdatesEnabled} />}
                                showBackButton
                            />
                            {!isGlobalView && (
                                <LiveUpdateToggle
                                    isEnabled={liveUpdatesEnabled}
                                    isConnected={websocketService.isConnected()}
                                    onToggle={() => setLiveUpdatesEnabled(prev => !prev)}
                                />
                            )}
                        </div>

                        {/* URL Info Card */}
                        {!isGlobalView && (
                            <div className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-blue-900/10 rounded-xl p-4 sm:p-5 shadow-lg border border-blue-100 dark:border-blue-900/30">
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-start sm:items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Short URL:</span>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <button
                                                onClick={() => window.open(`${window.location.origin}/${shortCode}`, '_blank')}
                                                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-mono hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all cursor-pointer truncate"
                                            >
                                                {window.location.origin}/{shortCode}
                                            </button>
                                            <button
                                                className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                                                onClick={handleCopyUrl}
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

                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        <span className="font-semibold">Destination:</span> <span className="break-all">{urlInfo?.long_url || 'Loading...'}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
                                            Active
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <span className="font-bold text-lg text-gray-900 dark:text-white">{liveClickCount.toLocaleString()}</span>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">clicks</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Date Range Controls */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="bg-white dark:bg-gray-800 rounded-xl flex-1 p-4 shadow-md border border-gray-200 dark:border-gray-700">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Date Range:</span>
                                    <div className="flex-1">
                                        <DateRangePicker value={dateRange} onChange={setDateRange} disabled={isLoadingData} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="secondary" size="sm" className="flex-1 sm:flex-initial flex items-center justify-center gap-2" disabled={isLoadingData}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    CSV
                                </Button>
                                <Button variant="secondary" size="sm" className="flex-1 sm:flex-initial flex items-center justify-center gap-2" disabled={isLoadingData}>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="mb-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        {isGlobalView ? (
                            <>
                                <MetricCard title="Total URLs" value={totalUrls} subtitle="shortened links" icon={<svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>} />
                                <MetricCard title="Total Clicks" value={totalClicks} subtitle="across all URLs" icon={<svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
                                <MetricCard title="Active URLs" value={activeUrls} subtitle="currently active" icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                                <MetricCard title="Avg. Clicks/URL" value={totalUrls > 0 ? Math.round(totalClicks / totalUrls) : 0} subtitle="per link" icon={<svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                            </>
                        ) : (
                            <>
                                <MetricCard title="Total Clicks" value={totalClicks} subtitle="all time" icon={<svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} />
                                <MetricCard title="Unique Visitors" value={uniqueVisitors} subtitle="in period" icon={<svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>} />
                                <MetricCard title="Avg. Daily Clicks" value={avgDailyClicks} subtitle="in period" icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} />
                                <MetricCard title="Peak Hour" value={`2 PM`} subtitle="UTC timezone" icon={<svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
                            </>
                        )}
                    </div>
                </div>

                {/* Charts */}
                {isGlobalView ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Performing URLs</h2>
                        {globalAnalytics?.topUrls && globalAnalytics.topUrls.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Short Code</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Destination</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Clicks</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {globalAnalytics.topUrls.map((url) => (
                                            <tr key={url.short_code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-6 py-4"><code className="text-sm font-mono text-blue-600 dark:text-blue-400">{url.short_code}</code></td>
                                                <td className="px-6 py-4 hidden md:table-cell"><div className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-md">{url.long_url}</div></td>
                                                <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900 dark:text-white">{url.access_count.toLocaleString()}</span></td>
                                                <td className="px-6 py-4"><a href={`/analytics/${url.short_code}`} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm">View</a></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <p className="mt-4 text-gray-500 dark:text-gray-400">No URLs found</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        <ClicksOverTimeChart data={clicksChartData} loading={isLoadingData} />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <GeographicDistributionMap data={[]} loading={isLoadingData} />
                            <DeviceBreakdownChart data={[]} loading={isLoadingData} />
                        </div>
                        <ReferrerTable data={[]} loading={isLoadingData} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnalyticsPage;