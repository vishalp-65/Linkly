import React from 'react';

interface StateData {
    state: string;
    stateCode: string;
    clicks: number;
    percentage: number;
}

interface IndianStatesChartProps {
    data: StateData[];
    loading?: boolean;
}

const IndianStatesChart: React.FC<IndianStatesChartProps> = ({ data, loading = false }) => {
    const getBarWidth = (percentage: number) => {
        return Math.max(percentage, 2);
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }, (_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                <div className="w-12 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>🇮🇳</span>
                    Indian States Distribution
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Top {data.length} {data.length === 1 ? 'state' : 'states'}
                </div>
            </div>

            <div className="space-y-4">
                {data.map((state, index) => (
                    <div key={state.stateCode} className="group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <span className="font-medium text-gray-900 dark:text-white">{state.state}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                    #{index + 1}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {state.clicks.toLocaleString()}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 min-w-[3rem] text-right">
                                    {state.percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 h-2 rounded-full transition-all duration-500 ease-out group-hover:from-orange-600 group-hover:to-orange-700 dark:group-hover:from-orange-500 dark:group-hover:to-orange-600"
                                    style={{ width: `${getBarWidth(state.percentage)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IndianStatesChart;
