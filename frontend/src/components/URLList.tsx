import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGetUserUrlsQuery } from '../services/api';
import Button from './common/Button';
import Input from './common/Input';
import Card from './common/Card';
import URLCard from './URLCard';
import type { URLListParams, URLMapping } from '../types/url.types';
import { useDebouncedCallback } from '../hooks/useDebounce';
import { LoadingOverlay, Select, type SelectOption } from './common';

interface URLListProps {
    onUrlSelect?: (url: URLMapping) => void;
    onAnalyticsClick?: (url: URLMapping) => void;
    onEditClick?: (url: URLMapping) => void;
    onShareClick?: (url: URLMapping) => void;
    selectedUrls?: Set<string>;
    onUrlSelectionChange?: (shortCode: string, selected: boolean) => void;
    showCheckboxes?: boolean;
}

// Constants
const SORT_OPTIONS: SelectOption[] = [
    { value: 'created_at-desc', label: 'Newest First' },
    { value: 'created_at-asc', label: 'Oldest First' },
    { value: 'access_count-desc', label: 'Most Clicks' },
    { value: 'access_count-asc', label: 'Least Clicks' },
    { value: 'last_accessed_at-desc', label: 'Recently Accessed' },
] as const;

const ALIAS_OPTIONS: SelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'true', label: 'Custom Alias' },
    { value: 'false', label: 'Generated' },
] as const;

const STATUS_OPTIONS: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'false', label: 'Active' },
    { value: 'true', label: 'Expired' },
] as const;

const DEFAULT_PARAMS: URLListParams = {
    page: 1,
    pageSize: 10,
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
};

const POLLING_INTERVAL = 30000;
const DEBOUNCE_DELAY = 500;
const MAX_PAGE_NUMBERS = 7;

// Memoized Empty State Component
const EmptyState = React.memo<{ hasFilters: boolean; onClearFilters: () => void }>(
    ({ hasFilters, onClearFilters }) => (
        <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 mb-6">
                <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {hasFilters ? 'No URLs Found' : 'No URLs Yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                {hasFilters
                    ? 'Try adjusting your search or filters to find what you\'re looking for'
                    : 'Create your first shortened URL to get started with tracking and analytics'}
            </p>
            {hasFilters && (
                <Button variant="primary" size="sm" onClick={onClearFilters}>
                    Clear All Filters
                </Button>
            )}
        </div>
    )
);
EmptyState.displayName = 'EmptyState';

// Memoized Error State Component
const ErrorState = React.memo<{ error: any }>(({ error }) => (
    <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Failed to Load URLs</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error?.data?.message || 'Something went wrong. Please try again.'}
        </p>
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
            Retry
        </Button>
    </div>
));
ErrorState.displayName = 'ErrorState';

// Skeleton Loading Component
const URLListSkeleton = React.memo(() => (
    <div className="space-y-6">
        <Card>
            <div className="p-5">
                <div className="flex flex-col gap-4">
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="flex gap-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        </Card>
        <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
                <Card key={i} className="animate-pulse">
                    <div className="p-5 space-y-3">
                        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                        <div className="flex gap-4">
                            {[1, 2, 3].map(j => (
                                <div key={j} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                            ))}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    </div>
));
URLListSkeleton.displayName = 'URLListSkeleton';

// Pagination Component
const Pagination = React.memo<{ meta: any; onPageChange: (page: number) => void }>(
    ({ meta, onPageChange }) => {
        const pageNumbers = useMemo(
            () => generatePageNumbers(meta.currentPage, meta.totalPages),
            [meta.currentPage, meta.totalPages]
        );

        if (!meta || meta.totalPages <= 1) return null;

        return (
            <nav className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4" aria-label="Pagination">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                    <strong className="font-semibold">{(meta.currentPage - 1) * meta.pageSize + 1}</strong>–
                    <strong className="font-semibold">{Math.min(meta.currentPage * meta.pageSize, meta.totalItems)}</strong> of{' '}
                    <strong className="font-semibold">{meta.totalItems}</strong> results
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={!meta.hasPrevPage}
                        onClick={() => onPageChange(meta.currentPage - 1)}
                        aria-label="Previous page"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </Button>

                    <div className="flex items-center gap-1">
                        {pageNumbers.map((pageNum, idx) =>
                            pageNum === '...' ? (
                                <span key={`ellipsis-${idx}`} className="px-3 py-1 text-gray-400" aria-hidden="true">
                                    ...
                                </span>
                            ) : (
                                <Button
                                    key={pageNum}
                                    variant={pageNum === meta.currentPage ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => onPageChange(pageNum as number)}
                                    className="min-w-[2.5rem]"
                                    aria-label={`Page ${pageNum}`}
                                    aria-current={pageNum === meta.currentPage ? 'page' : undefined}
                                >
                                    {pageNum}
                                </Button>
                            )
                        )}
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={!meta.hasNextPage}
                        onClick={() => onPageChange(meta.currentPage + 1)}
                        aria-label="Next page"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Button>
                </div>
            </nav>
        );
    }
);
Pagination.displayName = 'Pagination';

// Utility function for page number generation
function generatePageNumbers(currentPage: number, totalPages: number): (number | string)[] {
    if (totalPages <= MAX_PAGE_NUMBERS) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [1];

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
        end = 5;
    } else if (currentPage >= totalPages - 2) {
        start = totalPages - 4;
    }

    if (start > 2) pages.push('...');

    for (let i = start; i <= end; i++) {
        pages.push(i);
    }

    if (end < totalPages - 1) pages.push('...');

    pages.push(totalPages);

    return pages;
}

// Main URLList Component
const URLList: React.FC<URLListProps> = ({
    onAnalyticsClick,
    onEditClick,
    onShareClick,
    selectedUrls = new Set(),
    onUrlSelectionChange,
    showCheckboxes = false
}) => {
    const [params, setParams] = useState<URLListParams>(DEFAULT_PARAMS);
    const [searchInput, setSearchInput] = useState('');

    const { data, isLoading, error, isFetching } = useGetUserUrlsQuery(params, {
        pollingInterval: POLLING_INTERVAL,
        refetchOnMountOrArgChange: true,
    });

    // Debounced search handler
    const debouncedSearch = useDebouncedCallback((searchTerm: string) => {
        setParams(prev => ({ ...prev, search: searchTerm, page: 1 }));
    }, DEBOUNCE_DELAY);

    useEffect(() => {
        debouncedSearch(searchInput);
    }, [searchInput, debouncedSearch]);

    // Memoized callbacks
    const handlePageChange = useCallback((newPage: number) => {
        setParams(prev => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    }, []);

    const handleFilterChange = useCallback((key: keyof URLListParams, value: any) => {
        setParams(prev => ({ ...prev, [key]: value, page: 1 }));
    }, []);

    const handleSortChange = useCallback((value: string) => {
        const [sortBy, sortOrder] = value.split('-') as [string, 'asc' | 'desc'];
        setParams(prev => ({ ...prev, sortBy: sortBy as any, sortOrder, page: 1 }));
    }, []);

    const clearFilters = useCallback(() => {
        setSearchInput('');
        setParams(DEFAULT_PARAMS);
    }, []);

    // Memoized computed values
    const hasActiveFilters = useMemo(
        () => Boolean(
            searchInput ||
            params.sortBy !== 'created_at' ||
            params.sortOrder !== 'desc' ||
            params.isCustomAlias !== undefined ||
            params.isExpired !== undefined
        ),
        [searchInput, params.sortBy, params.sortOrder, params.isCustomAlias, params.isExpired]
    );

    const { urlData, paginationMeta, isEmpty } = useMemo(() => {
        const responseData = data?.data as any;
        const urls = responseData?.data || [];
        const pagination = responseData?.pagination;
        return {
            urlData: urls,
            paginationMeta: pagination,
            isEmpty: urls.length === 0
        };
    }, [data]);

    const aliasFilterValue = params.isCustomAlias === undefined ? 'all' : String(params.isCustomAlias);
    const statusFilterValue = params.isExpired === undefined ? 'all' : String(params.isExpired);
    const sortValue = `${params.sortBy}-${params.sortOrder}`;

    // Loading state
    if (isLoading && !isFetching) {
        return <URLListSkeleton />;
    }

    // Error state
    if (error) {
        return <ErrorState error={error} />;
    }

    // Empty state
    if (isEmpty) {
        return <EmptyState hasFilters={hasActiveFilters} onClearFilters={clearFilters} />;
    }

    return (
        <div className="space-y-6">
            {/* Filters Card */}
            <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4">
                        {/* Search Input */}
                        <div className="w-full">
                            <Input
                                placeholder="Search by short code or URL..."
                                value={searchInput}
                                onChange={handleSearchChange}
                                leftIcon={
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                }
                                aria-label="Search URLs"
                            />
                        </div>

                        {/* Filter Controls */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[140px]">
                                <Select
                                    options={ALIAS_OPTIONS}
                                    value={aliasFilterValue}
                                    onChange={val => handleFilterChange('isCustomAlias', val === 'all' ? undefined : val === 'true')}
                                    aria-label="Filter by alias type"
                                />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <Select
                                    options={STATUS_OPTIONS}
                                    value={statusFilterValue}
                                    onChange={val => handleFilterChange('isExpired', val === 'all' ? undefined : val === 'true')}
                                    aria-label="Filter by status"
                                />
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <Select
                                    options={SORT_OPTIONS}
                                    value={sortValue}
                                    onChange={handleSortChange}
                                    aria-label="Sort URLs"
                                />
                            </div>
                            {hasActiveFilters && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={clearFilters}
                                    className="whitespace-nowrap"
                                >
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Results Summary */}
            <div className="flex items-center justify-between text-sm px-1">
                <span className="text-gray-700 dark:text-gray-300">
                    Showing <strong className="font-semibold text-gray-900 dark:text-white">{paginationMeta?.totalItems || 0}</strong> URL{paginationMeta?.totalItems !== 1 ? 's' : ''}
                    {hasActiveFilters && <span className="text-blue-600 dark:text-blue-400 ml-1">(filtered)</span>}
                </span>
                {paginationMeta && (
                    <span className="text-gray-600 dark:text-gray-400">
                        Page <strong className="text-gray-900 dark:text-white">{paginationMeta.currentPage}</strong> of <strong className="text-gray-900 dark:text-white">{paginationMeta.totalPages}</strong>
                    </span>
                )}
            </div>

            {/* URL List with Loading Overlay */}
            <div className="relative space-y-4">
                {isFetching && (
                    <LoadingOverlay
                        isLoading={isFetching}
                        blur
                        message="Loading URLs"
                    />
                )}
                {urlData.map((url: URLMapping) => (
                    <URLCard
                        key={url.short_code}
                        url={url}
                        onAnalyticsClick={onAnalyticsClick}
                        onEditClick={onEditClick}
                        onShareClick={onShareClick}
                        isSelected={selectedUrls.has(url.short_code)}
                        onSelect={onUrlSelectionChange}
                        showCheckbox={showCheckboxes}
                    />
                ))}
            </div>

            {/* Pagination */}
            <Pagination meta={paginationMeta} onPageChange={handlePageChange} />
        </div>
    );
};

URLList.displayName = 'URLList';

export default React.memo(URLList);