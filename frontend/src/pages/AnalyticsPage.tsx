import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

import Button from '../components/common/Button';
import MetricCard from '../components/analytics/MetricCard';
import ClicksOverTimeChart from '../components/analytics/ClicksOverTimeChart';
import GeographicDistributionMap from '../components/analytics/GeographicDistributionMap';
import DeviceBreakdownChart from '../components/analytics/DeviceBreakdownChart';
import ReferrerTable from '../components/analytics/ReferrerTable';
import LiveClickCounter from '../components/analytics/LiveClickCounter';
import WebSocketStatus from '../components/analytics/WebSocketStatus';
import DateRangePicker, { type DateRange } from '../components/analytics/DateRangePicker';
import { clicksData, deviceData, geoData, referrerData } from '../utils/DummyAnalyticsData';

interface AnalyticsPageProps { }

const AnalyticsPage: React.FC<AnalyticsPageProps> = () => {
    const { shortCode } = useParams<{ shortCode: string }>();
    const [dateRange, setDateRange] = useState<DateRange>({
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
        end: new Date().toISOString().split('T')[0],
        label: 'Last 30 days'
    });
    const [isLoadingData, setIsLoadingData] = useState(false);



    const handleExport = (format: 'csv' | 'pdf') => {
        console.log(`Exporting analytics data as ${format}`);
        // TODO: Implement export functionality
    };

    const handleDateRangeChange = (newRange: DateRange) => {
        setDateRange(newRange);
        fetchAnalyticsData(newRange);
    };

    const fetchAnalyticsData = async (range: DateRange) => {
        setIsLoadingData(true);
        try {
            // TODO: Replace with actual API call
            console.log('Fetching analytics data for range:', range);

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Here you would typically call your analytics API
            // const response = await api.getAnalytics(shortCode, range.start, range.end);
            // Update your data state with the response

        } catch (error) {
            console.error('Failed to fetch analytics data:', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* URL Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    onClick={() => window.history.back()}
                                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>
                                <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
                            </div>

                            {/* WebSocket Status */}
                            <WebSocketStatus className="mb-2" />

                            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-medium text-gray-500">Short URL:</span>
                                            <code className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-mono">
                                                short.ly/{shortCode}
                                            </code>
                                            <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="text-sm text-gray-600 truncate">
                                            <span className="font-medium">Destination:</span> https://example.com/very/long/url/that/might/be/truncated
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                                            Active
                                        </span>
                                        <LiveClickCounter
                                            shortCode={shortCode || ''}
                                            initialCount={12500}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-col gap-4 lg:items-end">
                            {/* Date Range Picker */}
                            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="text-sm font-medium text-gray-700">
                                        Date Range:
                                    </div>
                                    <div className="flex-1 max-w-xs">
                                        <DateRangePicker
                                            value={dateRange}
                                            onChange={handleDateRangeChange}
                                            disabled={isLoadingData}
                                        />
                                    </div>
                                    {isLoadingData && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Updating data...
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Export Buttons */}
                            <div className="flex flex-col xs:flex-row gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExport('csv')}
                                    className="flex items-center justify-center gap-2"
                                    disabled={isLoadingData}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="hidden xs:inline">Export</span> CSV
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleExport('pdf')}
                                    className="flex items-center justify-center gap-2"
                                    disabled={isLoadingData}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden xs:inline">Export</span> PDF
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Total Clicks"
                            value={12500}
                            change="+15%"
                            changeType="positive"
                            subtitle="from last period"
                            icon={
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            }
                        />

                        <MetricCard
                            title="Unique Visitors"
                            value={8300}
                            change="+12%"
                            changeType="positive"
                            subtitle="from last period"
                            icon={
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            }
                        />

                        <MetricCard
                            title="Avg. Daily Clicks"
                            value={450}
                            change="-5%"
                            changeType="negative"
                            subtitle="from last period"
                            icon={
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        />

                        <MetricCard
                            title="Peak Traffic Hour"
                            value="2 PM"
                            subtitle="UTC timezone"
                            icon={
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                    </div>
                </div>

                {/* Charts Section */}
                <div className="space-y-8">
                    {/* Clicks Over Time Chart */}
                    <ClicksOverTimeChart data={clicksData} loading={isLoadingData} />

                    {/* Geographic and Device Analytics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <GeographicDistributionMap data={geoData} loading={isLoadingData} />
                        <DeviceBreakdownChart data={deviceData} loading={isLoadingData} />
                    </div>

                    {/* Referrer Table */}
                    <ReferrerTable data={referrerData} loading={isLoadingData} />
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;