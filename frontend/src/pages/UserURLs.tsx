import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import URLList from '../components/URLList';
import type { URLItem } from '../types/url.types';
import { Button, Modal } from '../components/common';
import PageHeader from '../components/common/PageHeader';
import URLResult, { type URLResultData } from '../components/URLResult';
import URLEditModal from '../components/URLEditModal';
import { useToast } from '../contexts/ToastContext';
import { useGetUserUrlsQuery, useBulkDeleteUrlsMutation, useBulkUpdateExpiryMutation } from '../services/api';
import { exportToCSV, exportToJSON, isExpired } from '../utils/exportUtils';

type ModalType = 'share' | 'export' | 'bulkActions' | 'edit' | null;
type ExportFormat = 'csv' | 'json';

interface ExportOptions {
    includeAnalytics: boolean;
    includeExpired: boolean;
}

// Constants
const FETCH_ALL_PAGE_SIZE = 1000;
const EXPIRY_EXTENSION_DAYS = 30;

const INITIAL_EXPORT_OPTIONS: ExportOptions = {
    includeAnalytics: true,
    includeExpired: false,
};

// Export Modal Component
const ExportModal = React.memo<{
    isOpen: boolean;
    onClose: () => void;
    format: ExportFormat;
    options: ExportOptions;
    isLoading: boolean;
    onFormatChange: (format: ExportFormat) => void;
    onOptionsChange: (options: ExportOptions) => void;
    onExport: () => void;
}>(({ isOpen, onClose, format, options, isLoading, onFormatChange, onOptionsChange, onExport }) => (
    <Modal isOpen={isOpen} onClose={onClose} title="Export URLs" size="md">
        <div className="space-y-4">
            {/* Format Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={() => onFormatChange('csv')}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${format === 'csv'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                        aria-pressed={format === 'csv'}
                    >
                        <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-2 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="font-semibold text-gray-900 dark:text-white">CSV</span>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => onFormatChange('json')}
                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${format === 'json'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                        aria-pressed={format === 'json'}
                    >
                        <div className="text-center">
                            <svg className="w-8 h-8 mx-auto mb-2 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <span className="font-semibold text-gray-900 dark:text-white">JSON</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Export Options */}
            <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={options.includeAnalytics}
                        onChange={e => onOptionsChange({ ...options, includeAnalytics: e.target.checked })}
                        className="w-5 h-5 rounded cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        Include analytics data (clicks, last accessed)
                    </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={options.includeExpired}
                        onChange={e => onOptionsChange({ ...options, includeExpired: e.target.checked })}
                        className="w-5 h-5 rounded cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        Include expired URLs
                    </span>
                </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
                <Button variant="secondary" onClick={onClose} className="flex-1" disabled={isLoading}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={onExport} className="flex-1" loading={isLoading}>
                    Export
                </Button>
            </div>
        </div>
    </Modal>
));
ExportModal.displayName = 'ExportModal';

// Bulk Action Button Component
const BulkActionButton = React.memo<{
    onClick: () => void;
    disabled: boolean;
    icon: React.ReactNode;
    title: string;
    description: string;
    variant?: 'default' | 'danger';
}>(({ onClick, disabled, icon, title, description, variant = 'default' }) => {
    const borderColor = variant === 'danger'
        ? 'border-red-200 dark:border-red-900/30'
        : 'border-gray-200 dark:border-gray-700';
    const bgColor = variant === 'danger'
        ? 'bg-red-200/60 dark:bg-red-900/20'
        : 'bg-gray-200/90 dark:bg-gray-900/40';
    const hoverBg = variant === 'danger'
        ? 'hover:bg-red-50 dark:hover:bg-red-900/10'
        : 'hover:bg-gray-100 dark:hover:bg-gray-800/50';
    const iconColor = variant === 'danger'
        ? 'text-red-600 dark:text-red-400'
        : 'text-blue-600 dark:text-blue-400';
    const titleHoverColor = variant === 'danger'
        ? 'group-hover:text-red-800 dark:group-hover:text-red-300'
        : 'group-hover:text-blue-600 dark:group-hover:text-blue-400';

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`w-full p-4 rounded-lg border ${borderColor} ${hoverBg} ${bgColor} transition-all cursor-pointer group text-left disabled:opacity-50 disabled:cursor-not-allowed`}
        >
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <div className={`font-semibold text-gray-900 dark:text-white ${titleHoverColor} transition-colors`}>
                        {title}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {description}
                    </div>
                </div>
            </div>
        </button>
    );
});
BulkActionButton.displayName = 'BulkActionButton';

// Main UserURLs Component
const UserURLs: React.FC = () => {
    const navigate = useNavigate();
    const { isGuest } = useSelector((state: RootState) => state.auth);
    const { showToast } = useToast();

    // State
    const [urlResult, setUrlResult] = useState<URLResultData | undefined>();
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
    const [exportOptions, setExportOptions] = useState<ExportOptions>(INITIAL_EXPORT_OPTIONS);
    const [editingUrl, setEditingUrl] = useState<URLItem | null>(null);

    // API hooks
    const [bulkDeleteUrls, { isLoading: isDeleting }] = useBulkDeleteUrlsMutation();
    const [bulkUpdateExpiry, { isLoading: isUpdating }] = useBulkUpdateExpiryMutation();
    const { data: allUrlsData, isLoading: isLoadingAllUrls } = useGetUserUrlsQuery(
        { page: 1, pageSize: FETCH_ALL_PAGE_SIZE, sortBy: 'created_at', sortOrder: 'desc' },
        { skip: isGuest }
    );

    // Memoized all URLs
    const allUrls = useMemo(() => {
        if (!allUrlsData?.data) return [];
        const responseData = allUrlsData.data as any;
        return (responseData?.data || []) as URLItem[];
    }, [allUrlsData]);

    // Event Handlers
    const handleAnalyticsClick = useCallback((url: URLItem) => {
        navigate(`/analytics/${url.short_code}`);
    }, [navigate]);

    const handleEditClick = useCallback((url: URLItem) => {
        setEditingUrl(url);
        setActiveModal('edit');
    }, []);

    const handleShareClick = useCallback((url: URLItem) => {
        setUrlResult({
            shortUrl: `${window.location.origin}/${url.short_code}`,
            originalUrl: url.long_url,
            customAlias: url.is_custom_alias ? url.short_code : undefined,
            expiryDate: url.expires_at,
            createdAt: url.created_at,
        });
        setActiveModal('share');
    }, []);

    const handleUrlSelectionChange = useCallback((shortCode: string, selected: boolean) => {
        setSelectedUrls(prev => {
            const newSet = new Set(prev);
            selected ? newSet.add(shortCode) : newSet.delete(shortCode);
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        setSelectedUrls(new Set(allUrls.map(url => url.short_code)));
    }, [allUrls]);

    const handleDeselectAll = useCallback(() => {
        setSelectedUrls(new Set());
    }, []);

    const handleCloseModal = useCallback(() => {
        setActiveModal(null);
        setEditingUrl(null);
    }, []);

    // Export functionality
    const handleExport = useCallback(() => {
        if (isLoadingAllUrls) {
            showToast({
                type: 'info',
                title: 'Loading',
                message: 'Please wait while URLs are being loaded...'
            });
            return;
        }

        try {
            let urlsToExport = exportOptions.includeExpired
                ? [...allUrls]
                : allUrls.filter(url => !isExpired(url));

            if (urlsToExport.length === 0) {
                showToast({
                    type: 'warning',
                    title: 'No Data',
                    message: allUrls.length === 0
                        ? 'No URLs found. Please create some URLs first.'
                        : 'No active URLs available to export. Try including expired URLs.'
                });
                return;
            }

            if (exportFormat === 'csv') {
                exportToCSV(urlsToExport, exportOptions.includeAnalytics);
            } else {
                exportToJSON(urlsToExport, exportOptions.includeAnalytics);
            }

            showToast({
                type: 'success',
                title: 'Export Successful',
                message: `Exported ${urlsToExport.length} URL${urlsToExport.length !== 1 ? 's' : ''} as ${exportFormat.toUpperCase()}`
            });
            setActiveModal(null);
        } catch (error) {
            console.error('Export error:', error);
            showToast({
                type: 'error',
                title: 'Export Failed',
                message: 'Failed to export URLs. Please try again.'
            });
        }
    }, [allUrls, exportFormat, exportOptions, showToast, isLoadingAllUrls]);

    // Bulk actions
    const handleBulkDelete = useCallback(async () => {
        const selectedUrlsList = Array.from(selectedUrls);

        if (selectedUrlsList.length === 0) {
            showToast({ type: 'warning', title: 'No Selection', message: 'Please select URLs to delete' });
            return;
        }

        try {
            const result = await bulkDeleteUrls(selectedUrlsList).unwrap();
            const { deleted, failed } = result.data;

            if (deleted.length > 0) {
                showToast({
                    type: 'success',
                    title: 'Deleted',
                    message: `${deleted.length} URL${deleted.length !== 1 ? 's' : ''} deleted successfully${failed.length > 0 ? `, ${failed.length} failed` : ''
                        }`
                });
            }

            if (failed.length > 0 && deleted.length === 0) {
                showToast({
                    type: 'error',
                    title: 'Delete Failed',
                    message: `Failed to delete ${failed.length} URL${failed.length !== 1 ? 's' : ''}`
                });
            }

            setSelectedUrls(new Set());
            setActiveModal(null);
        } catch (error: any) {
            console.error('Bulk delete error:', error);
            showToast({
                type: 'error',
                title: 'Delete Failed',
                message: error?.data?.message || 'Failed to delete URLs. Please try again.'
            });
        }
    }, [selectedUrls, bulkDeleteUrls, showToast]);

    const handleBulkUpdateExpiry = useCallback(async (action: 'extend' | 'remove') => {
        const selectedUrlsList = Array.from(selectedUrls);

        if (selectedUrlsList.length === 0) {
            showToast({
                type: 'warning',
                title: 'No Selection',
                message: `Please select URLs to ${action === 'extend' ? 'extend' : 'remove'} expiry`
            });
            return;
        }

        try {
            const payload = action === 'extend'
                ? { shortCodes: selectedUrlsList, action, days: EXPIRY_EXTENSION_DAYS }
                : { shortCodes: selectedUrlsList, action };

            const result = await bulkUpdateExpiry(payload).unwrap();
            const { updated, failed } = result.data;

            if (updated.length > 0) {
                const message = action === 'extend'
                    ? `Extended expiry for ${updated.length} URL${updated.length !== 1 ? 's' : ''} by ${EXPIRY_EXTENSION_DAYS} days`
                    : `Removed expiry from ${updated.length} URL${updated.length !== 1 ? 's' : ''}`;

                showToast({
                    type: 'success',
                    title: action === 'extend' ? 'Expiry Extended' : 'Expiry Removed',
                    message: `${message}${failed.length > 0 ? `, ${failed.length} failed` : ''}`
                });
            }

            if (failed.length > 0 && updated.length === 0) {
                showToast({
                    type: 'error',
                    title: 'Update Failed',
                    message: `Failed to update ${failed.length} URL${failed.length !== 1 ? 's' : ''}`
                });
            }

            setActiveModal(null);
        } catch (error: any) {
            console.error('Bulk update expiry error:', error);
            showToast({
                type: 'error',
                title: 'Update Failed',
                message: error?.data?.message || 'Failed to update expiry. Please try again.'
            });
        }
    }, [selectedUrls, bulkUpdateExpiry, showToast]);

    const handleExportSelected = useCallback(() => {
        const urlsToExport = allUrls.filter(url => selectedUrls.has(url.short_code));

        if (urlsToExport.length === 0) {
            showToast({ type: 'warning', title: 'No Selection', message: 'Please select URLs to export' });
            return;
        }

        exportToJSON(urlsToExport, true);
        showToast({
            type: 'success',
            title: 'Exported',
            message: `Exported ${urlsToExport.length} selected URL${urlsToExport.length !== 1 ? 's' : ''}`
        });
        setActiveModal(null);
    }, [allUrls, selectedUrls, showToast]);

    if (isGuest) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 animate-pulse" />
            </div>

            <main className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                <div className="animate-fade-in">
                    {/* Header Section */}
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:mx-2 sm:items-start sm:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <PageHeader
                                    title="Your URLs"
                                    subtitle="Manage and track your shortened links"
                                    showBackButton
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-row gap-2 sm:gap-3 justify-end sm:pt-0 mx-3">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveModal('export')}
                                    className="flex-1 sm:flex-initial whitespace-nowrap border border-gray-300 dark:border-gray-600 text-xs sm:text-sm px-3 sm:px-4"
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>Export</span>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setActiveModal('bulkActions')}
                                    className="flex-1 sm:flex-initial whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                                >
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    <span>Bulk Actions</span>
                                    {selectedUrls.size > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                                            {selectedUrls.size}
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="backdrop-blur-sm rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-4 lg:p-6 mt-3">
                        {/* Selection Controls */}
                        {allUrls.length > 0 && (
                            <div className="mb-4 flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        {selectedUrls.size > 0 ? (
                                            <>{selectedUrls.size} of {allUrls.length} selected</>
                                        ) : (
                                            <>Select URLs for bulk actions</>
                                        )}
                                    </span>
                                    {selectedUrls.size < allUrls.length ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleSelectAll}
                                            className="text-xs hover:bg-blue-100 dark:hover:bg-blue-800/30"
                                        >
                                            Select All
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleDeselectAll}
                                            className="text-xs hover:bg-blue-100 dark:hover:bg-blue-800/30"
                                        >
                                            Deselect All
                                        </Button>
                                    )}
                                </div>
                                {selectedUrls.size > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDeselectAll}
                                        className="text-xs text-gray-600 dark:text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                        Clear Selection
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* URL List */}
                        <URLList
                            onAnalyticsClick={handleAnalyticsClick}
                            onEditClick={handleEditClick}
                            onShareClick={handleShareClick}
                            selectedUrls={selectedUrls}
                            onUrlSelectionChange={handleUrlSelectionChange}
                            showCheckboxes={true}
                        />
                    </div>
                </div>

                {/* Share Modal */}
                {urlResult && activeModal === 'share' && (
                    <URLResult
                        result={urlResult}
                        onShowToast={(m, t) => showToast({
                            type: t,
                            title: t === 'success' ? 'Success' : 'Error',
                            message: m
                        })}
                        modalProps={{
                            isOpen: true,
                            onClose: handleCloseModal,
                            closeOnEscape: true,
                            closeOnOverlayClick: true,
                            title: "Share it on anywhere"
                        }}
                    />
                )}

                {/* Edit Modal */}
                {editingUrl && activeModal === 'edit' && (
                    <URLEditModal
                        isOpen={true}
                        onClose={handleCloseModal}
                        url={editingUrl}
                    />
                )}

                {/* Export Modal */}
                <ExportModal
                    isOpen={activeModal === 'export'}
                    onClose={handleCloseModal}
                    format={exportFormat}
                    options={exportOptions}
                    isLoading={isLoadingAllUrls}
                    onFormatChange={setExportFormat}
                    onOptionsChange={setExportOptions}
                    onExport={handleExport}
                />

                {/* Bulk Actions Modal */}
                <Modal
                    isOpen={activeModal === 'bulkActions'}
                    onClose={handleCloseModal}
                    title="Bulk Actions"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {selectedUrls.size} URL{selectedUrls.size !== 1 ? 's' : ''} selected
                        </p>

                        <div className="space-y-2">
                            <BulkActionButton
                                onClick={handleBulkDelete}
                                disabled={isDeleting || selectedUrls.size === 0}
                                variant="danger"
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                }
                                title="Delete Selected"
                                description="Permanently delete selected URLs"
                            />

                            <BulkActionButton
                                onClick={() => handleBulkUpdateExpiry('extend')}
                                disabled={isUpdating || selectedUrls.size === 0}
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                }
                                title="Extend Expiry"
                                description={`Add ${EXPIRY_EXTENSION_DAYS} days to expiration date`}
                            />

                            <BulkActionButton
                                onClick={() => handleBulkUpdateExpiry('remove')}
                                disabled={isUpdating || selectedUrls.size === 0}
                                icon={
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                }
                                title="Remove Expiry"
                                description="Remove expiration from URLs"
                            />

                            <BulkActionButton
                                onClick={handleExportSelected}
                                disabled={selectedUrls.size === 0}
                                icon={
                                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                }
                                title="Export"
                                description='Export selected urls'
                            />
                        </div>
                    </div>
                </Modal>
            </main>
        </div>
    );
}

export default UserURLs;