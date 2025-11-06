import React from 'react';

interface CountryData {
    country: string;
    countryCode: string;
    clicks: number;
    percentage: number;
}

interface GeographicDistributionMapProps {
    data: CountryData[];
    loading?: boolean;
}

const GeographicDistributionMap: React.FC<GeographicDistributionMapProps> = ({ data, loading = false }) => {
    const getCountryFlag = (countryCode: string) => {
        // Simple flag emoji mapping for common countries
        const flagMap: { [key: string]: string } = {
            'US': '🇺🇸',
            'GB': '🇬🇧',
            'CA': '🇨🇦',
            'DE': '🇩🇪',
            'FR': '🇫🇷',
            'JP': '🇯🇵',
            'AU': '🇦🇺',
            'IN': '🇮🇳',
            'BR': '🇧🇷',
            'CN': '🇨🇳',
            'RU': '🇷🇺',
            'IT': '🇮🇹',
            'ES': '🇪🇸',
            'NL': '🇳🇱',
            'SE': '🇸🇪',
            'NO': '🇳🇴',
            'DK': '🇩🇰',
            'FI': '🇫🇮',
            'CH': '🇨🇭',
            'AT': '🇦🇹',
            'BE': '🇧🇪',
            'IE': '🇮🇪',
            'PT': '🇵🇹',
            'GR': '🇬🇷',
            'PL': '🇵🇱',
            'CZ': '🇨🇿',
            'HU': '🇭🇺',
            'SK': '🇸🇰',
            'SI': '🇸🇮',
            'HR': '🇭🇷',
            'BG': '🇧🇬',
            'RO': '🇷🇴',
            'LT': '🇱🇹',
            'LV': '🇱🇻',
            'EE': '🇪🇪',
            'MT': '🇲🇹',
            'CY': '🇨🇾',
            'LU': '🇱🇺'
        };
        return flagMap[countryCode] || '🌍';
    };

    const getBarWidth = (percentage: number) => {
        return Math.max(percentage, 2); // Minimum 2% width for visibility
    };

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
                    <div className="space-y-3">
                        {Array.from({ length: 8 }, (_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-6 h-4 bg-gray-200 rounded"></div>
                                <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                                <div className="w-12 h-4 bg-gray-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // const maxClicks = Math.max(...data.map(item => item.clicks));

    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Geographic Distribution</h3>
                <div className="text-sm text-gray-500">
                    Top {data.length} countries
                </div>
            </div>

            <div className="space-y-4">
                {data.map((country, index) => (
                    <div key={country.countryCode} className="group">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{getCountryFlag(country.countryCode)}</span>
                                <span className="font-medium text-gray-900">{country.country}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    #{index + 1}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <span className="font-semibold text-gray-900">
                                    {country.clicks.toLocaleString()}
                                </span>
                                <span className="text-gray-500 min-w-[3rem] text-right">
                                    {country.percentage.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out group-hover:from-blue-600 group-hover:to-blue-700"
                                    style={{ width: `${getBarWidth(country.percentage)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                ))}

                {data.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No geographic data available</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GeographicDistributionMap;