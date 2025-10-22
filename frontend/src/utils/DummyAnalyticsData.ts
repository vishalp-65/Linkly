// Preset date ranges
export const presets = [
    {
        key: 'today',
        label: 'Today',
        getValue: () => {
            const today = new Date().toISOString().split('T')[0];
            return { start: today, end: today, label: 'Today' };
        }
    },
    {
        key: 'yesterday',
        label: 'Yesterday',
        getValue: () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            return { start: yesterday, end: yesterday, label: 'Yesterday' };
        }
    },
    {
        key: 'last7days',
        label: 'Last 7 days',
        getValue: () => ({
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            label: 'Last 7 days'
        })
    },
    {
        key: 'last30days',
        label: 'Last 30 days',
        getValue: () => ({
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            label: 'Last 30 days'
        })
    },
    {
        key: 'last90days',
        label: 'Last 90 days',
        getValue: () => ({
            start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            label: 'Last 90 days'
        })
    },
    {
        key: 'thisMonth',
        label: 'This month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const end = new Date().toISOString().split('T')[0];
            return { start, end, label: 'This month' };
        }
    },
    {
        key: 'lastMonth',
        label: 'Last month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
            const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
            return { start, end, label: 'Last month' };
        }
    }
];

export const getCountryFlag = (countryCode: string) => {
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

// Sample data for demonstration
export const clicksData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clicks: Math.floor(Math.random() * 500) + 100,
    uniqueVisitors: Math.floor(Math.random() * 300) + 50
}));

export const geoData = [
    { country: 'United States', countryCode: 'US', clicks: 4500, percentage: 36.0 },
    { country: 'United Kingdom', countryCode: 'GB', clicks: 2100, percentage: 16.8 },
    { country: 'Canada', countryCode: 'CA', clicks: 1800, percentage: 14.4 },
    { country: 'Germany', countryCode: 'DE', clicks: 1200, percentage: 9.6 },
    { country: 'France', countryCode: 'FR', clicks: 900, percentage: 7.2 },
    { country: 'Australia', countryCode: 'AU', clicks: 700, percentage: 5.6 },
    { country: 'Japan', countryCode: 'JP', clicks: 600, percentage: 4.8 },
    { country: 'India', countryCode: 'IN', clicks: 700, percentage: 5.6 }
];

export const deviceData = [
    { device: 'Desktop', clicks: 7500, percentage: 60.0, color: '#3b82f6' },
    { device: 'Mobile', clicks: 3750, percentage: 30.0, color: '#10b981' },
    { device: 'Tablet', clicks: 1250, percentage: 10.0, color: '#f59e0b' }
];

export const referrerData = [
    { referrer: 'google.com', clicks: 3500, percentage: 28.0 },
    { referrer: 'facebook.com', clicks: 2100, percentage: 16.8 },
    { referrer: 'twitter.com', clicks: 1800, percentage: 14.4 },
    { referrer: '(direct)', clicks: 1500, percentage: 12.0 },
    { referrer: 'linkedin.com', clicks: 1200, percentage: 9.6 },
    { referrer: 'reddit.com', clicks: 900, percentage: 7.2 },
    { referrer: 'youtube.com', clicks: 800, percentage: 6.4 },
    { referrer: 'github.com', clicks: 700, percentage: 5.6 }
];