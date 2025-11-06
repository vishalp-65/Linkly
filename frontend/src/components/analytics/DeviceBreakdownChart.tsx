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

const DeviceBreakdownChart: React.FC<DeviceBreakdownChartProps> = ({ data, loading = false }) => {
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    const getDeviceIcon = (device: string) => {
        const deviceLower = device.toLowerCase();

        if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
                </svg>
            );
        } else if (deviceLower.includes('tablet')) {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            );
        } else {
            return (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
            );
        }
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: data.color }}
                        ></div>
                        <span className="font-medium text-gray-900">{data.device}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                        <div>Clicks: {data.clicks.toLocaleString()}</div>
                        <div>Percentage: {data.percentage.toFixed(1)}%</div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const CustomLegend = ({ payload }: any) => {
        return (
            <div className="flex flex-wrap justify-center gap-4 mt-4">
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        ></div>
                        <span className="text-gray-700">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                    <div className="h-64 bg-gray-200 rounded mb-4"></div>
                    <div className="flex justify-center gap-4">
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                                <div className="w-16 h-4 bg-gray-200 rounded"></div>
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

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Device Breakdown</h3>
                <div className="text-sm text-gray-500">
                    {data.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()} total clicks
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

                    <CustomLegend payload={dataWithColors.map(item => ({ value: item.device, color: item.color }))} />

                    {/* Detailed breakdown */}
                    <div className="mt-6 space-y-3">
                        {dataWithColors.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    ></div>
                                    <div className="text-gray-600">
                                        {getDeviceIcon(item.device)}
                                    </div>
                                    <span className="font-medium text-gray-900">{item.device}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="font-semibold text-gray-900">
                                        {item.clicks.toLocaleString()}
                                    </span>
                                    <span className="text-gray-500 min-w-[3rem] text-right">
                                        {item.percentage.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p>No device data available</p>
                </div>
            )}
        </div>
    );
};

export default DeviceBreakdownChart;