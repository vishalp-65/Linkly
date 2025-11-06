import React from 'react';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
    icon?: React.ReactNode;
    subtitle?: string;
    loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    change,
    changeType = 'neutral',
    icon,
    subtitle,
    loading = false
}) => {
    const formatValue = (val: string | number): string => {
        if (typeof val === 'number') {
            if (val >= 1000000) {
                return `${(val / 1000000).toFixed(1)}M`;
            } else if (val >= 1000) {
                return `${(val / 1000).toFixed(1)}K`;
            }
            return val.toLocaleString();
        }
        return val;
    };

    const getChangeColor = () => {
        switch (changeType) {
            case 'positive':
                return 'text-green-600';
            case 'negative':
                return 'text-red-600';
            default:
                return 'text-gray-600';
        }
    };

    const getChangeIcon = () => {
        if (!change) return null;

        if (changeType === 'positive') {
            return (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
            );
        } else if (changeType === 'negative') {
            return (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                </svg>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-500 truncate">{title}</h3>
                {icon && (
                    <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                        {icon}
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900">
                    {formatValue(value)}
                </div>

                <div className="flex items-center justify-between">
                    {change && (
                        <div className={`flex items-center gap-1 text-xs font-medium ${getChangeColor()}`}>
                            {getChangeIcon()}
                            <span>{change}</span>
                        </div>
                    )}

                    {subtitle && (
                        <div className="text-xs text-gray-500 truncate">
                            {subtitle}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MetricCard;