import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DeviceData {
    device: string;
    clicks: number;
    percentage: number;
    color: string;
}

interface DeviceBreakdownChartProps {
    data: DeviceData[];
    loading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const DeviceBreakdownChart: React.FC<DeviceBreakdownChartProps> = ({ data, loading = false }) => {
    const getDeviceIcon = (device: string) => {
        const deviceLower = device.toLowerCase();

        if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
                </svg>
            );
        }
        if (deviceLower.includes('tablet')) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            );
        }
        return (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        );
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload?.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: data.color }}
                        ></div>
                        <span className="font-medium text-gray-900 dark:text-white">{data.device}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        <div>Clicks: {data.clicks.toLocaleString()}</div>
                        <div>Percentage: {data.percentage.toFixed(1)}%</div>
                    </div>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
                    <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                    <div className="flex justify-center gap-4">
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Add colors to data if not present
    const dataWithColors = data.map((item, index) => ({
        ...item,
        color: item.color || COLORS[index % COLORS.length]
    }));

    const totalClicks = data.reduce((sum, item) => sum + item.clicks, 0);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Device Breakdown</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {totalClicks.toLocaleString()} total clicks
                </div>
            </div>

            {data.length > 0 ? (
                <>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dataWithColors}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="clicks"
                                >
                                    {dataWithColors.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {dataWithColors.map((item, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                ></div>
                                <span className="text-gray-700 dark:text-gray-300">{item.device}</span>
                            </div>
                        ))}
                    </div>

                    {/* Detailed breakdown */}
                    <div className="mt-6 space-y-3">
                        {dataWithColors.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    ></div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                        {getDeviceIcon(item.device)}
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white">{item.device}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {item.clicks.toLocaleString()}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
                                        {item.percentage.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p>No device data available</p>
                </div>
            )}
        </div>
    );
};

export default DeviceBreakdownChart;