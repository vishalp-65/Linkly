import React, { useState, useMemo } from 'react';

interface ReferrerData {
    referrer: string;
    clicks: number;
    percentage: number;
    domain?: string;
}

interface ReferrerTableProps {
    data: ReferrerData[];
    loading?: boolean;
}

const ReferrerTable: React.FC<ReferrerTableProps> = ({ data, loading = false }) => {
    const [sortBy, setSortBy] = useState<'clicks' | 'referrer'>('clicks');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const getReferrerIcon = (referrer: string) => {
        const domain = referrer.toLowerCase();

        const iconMap: Record<string, string> = {
            google: '🔍',
            facebook: '📘',
            twitter: '🐦',
            'x.com': '🐦',
            linkedin: '💼',
            instagram: '📷',
            youtube: '📺',
            reddit: '🤖',
            github: '🐙',
            direct: '🔗',
            '(direct)': '🔗',
            email: '📧',
            mail: '📧'
        };

        for (const [key, icon] of Object.entries(iconMap)) {
            if (domain.includes(key)) return icon;
        }

        return '🌐';
    };

    const formatReferrer = (referrer: string) => {
        if (referrer === '(direct)' || referrer === 'direct') {
            return 'Direct Traffic';
        }
        if (referrer === '(none)' || referrer === 'none') {
            return 'No Referrer';
        }

        // Extract domain from URL
        try {
            const url = new URL(referrer.startsWith('http') ? referrer : `https://${referrer}`);
            return url.hostname.replace('www.', '');
        } catch {
            return referrer;
        }
    };

    const handleSort = (column: 'clicks' | 'referrer') => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder(column === 'clicks' ? 'desc' : 'asc');
        }
    };

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            let aValue: string | number, bValue: string | number;

            if (sortBy === 'clicks') {
                aValue = a.clicks;
                bValue = b.clicks;
            } else {
                aValue = formatReferrer(a.referrer).toLowerCase();
                bValue = formatReferrer(b.referrer).toLowerCase();
            }

            const comparison = aValue > bValue ? 1 : -1;
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }, [data, sortBy, sortOrder]);

    const SortIcon = ({ column }: { column: 'clicks' | 'referrer' }) => {
        if (sortBy !== column) {
            return (
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
            );
        }

        return sortOrder === 'asc' ? (
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
        ) : (
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
        );
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-200 dark:border-gray-700">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="grid grid-cols-3 gap-4 py-3">
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Top Referrers</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {data.length} referrer{data.length !== 1 ? 's' : ''}
                </div>
            </div>

            {data.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th
                                    className="text-left py-3 px-2 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                                    onClick={() => handleSort('referrer')}
                                >
                                    <div className="flex items-center gap-2">
                                        Referrer
                                        <SortIcon column="referrer" />
                                    </div>
                                </th>
                                <th
                                    className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
                                    onClick={() => handleSort('clicks')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Clicks
                                        <SortIcon column="clicks" />
                                    </div>
                                </th>
                                <th className="text-right py-3 px-2 font-medium text-gray-700 dark:text-gray-300">
                                    Percentage
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((referrer, index) => (
                                <tr
                                    key={index}
                                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <td className="py-3 px-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg">
                                                {getReferrerIcon(referrer.referrer)}
                                            </span>
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">
                                                    {formatReferrer(referrer.referrer)}
                                                </div>
                                                {referrer.domain && referrer.domain !== formatReferrer(referrer.referrer) && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                                        {referrer.domain}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            {referrer.clicks.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="bg-blue-500 dark:bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.max(referrer.percentage, 2)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem]">
                                                {referrer.percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p>No referrer data available</p>
                </div>
            )}
        </div>
    );
};

export default ReferrerTable;