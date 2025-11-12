import type { URLItem } from '../types/url.types';

export const isExpired = (url: URLItem) => url.expires_at && new Date(url.expires_at) < new Date();

export const exportToCSV = (urls: URLItem[], includeAnalytics: boolean): void => {
    const headers = includeAnalytics
        ? ['Short Code', 'Original URL', 'Custom Alias', 'Clicks', 'Created At', 'Expires At', 'Last Accessed', 'Status']
        : ['Short Code', 'Original URL', 'Custom Alias', 'Created At', 'Expires At', 'Status'];

    const rows = urls.map(url => {
        const baseRow = [
            url.short_code,
            url.long_url,
            url.is_custom_alias ? 'Yes' : 'No',
        ];

        if (includeAnalytics) {
            baseRow.push(
                url.access_count?.toString() || '0',
                new Date(url.created_at).toLocaleString(),
                url.expires_at ? new Date(url.expires_at).toLocaleString() : 'Never',
                url.last_accessed_at ? new Date(url.last_accessed_at).toLocaleString() : 'Never',
                isExpired(url) ? 'Expired' : 'Active'
            );
        } else {
            baseRow.push(
                new Date(url.created_at).toLocaleString(),
                url.expires_at ? new Date(url.expires_at).toLocaleString() : 'Never',
                isExpired(url) ? 'Expired' : 'Active'
            );
        }

        return baseRow;
    });

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    downloadFile(csvContent, `urls-export-${Date.now()}.csv`, 'text/csv');
};

export const exportToJSON = (urls: URLItem[], includeAnalytics: boolean): void => {
    const exportData = urls.map(url => {
        const data: any = {
            shortCode: url.short_code,
            originalUrl: url.long_url,
            customAlias: url.is_custom_alias,
            createdAt: url.created_at,
            expiresAt: url.expires_at,
            status: isExpired(url) ? 'expired' : 'active'
        };

        if (includeAnalytics) {
            data.analytics = {
                clicks: url.access_count || 0,
                lastAccessed: url.last_accessed_at
            };
        }

        return data;
    });

    const jsonContent = JSON.stringify(
        {
            urls: exportData,
            exportedAt: new Date().toISOString(),
            totalCount: urls.length
        },
        null,
        2
    );

    downloadFile(jsonContent, `urls-export-${Date.now()}.json`, 'application/json');
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};