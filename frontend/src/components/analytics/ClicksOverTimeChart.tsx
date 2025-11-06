import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Brush
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ClickData {
    date: string;
    clicks: number;
    uniqueVisitors: number;
}

interface ClicksOverTimeChartProps {
    data: ClickData[];
    loading?: boolean;
}

const ClicksOverTimeChart: React.FC<ClicksOverTimeChartProps> = ({ data, loading = false }) => {
    const formatXAxisLabel = (tickItem: string) => {
        try {
            return format(parseISO(tickItem), 'MMM dd');
        } catch {
            return tickItem;
        }
    };

    const formatTooltipLabel = (label: string) => {
        try {
            return format(parseISO(label), 'MMM dd, yyyy');
        } catch {
            return label;
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Clicks Over Time</h3>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-gray-600">Total Clicks</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-gray-600">Unique Visitors</span>
                    </div>
                </div>
            </div>

            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatXAxisLabel}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip
                            labelFormatter={formatTooltipLabel}
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="clicks"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="uniqueVisitors"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                        />
                        <Brush
                            dataKey="date"
                            height={30}
                            stroke="#8884d8"
                            tickFormatter={formatXAxisLabel}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ClicksOverTimeChart;