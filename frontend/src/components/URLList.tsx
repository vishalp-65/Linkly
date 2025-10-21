/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useGetUserUrlsQuery } from '../services/api';
import Button from './common/Button';
import Input from './common/Input';
import URLCard from './URLCard';
import type { URLListParams, URLMapping } from '../types/url.types';
import { debounce } from '../utils/debounce';
import { Select } from './common';

interface URLListProps {
    onUrlSelect?: (url: URLMapping) => void;
    onAnalyticsClick?: (url: URLMapping) => void;
    onEditClick?: (url: URLMapping) => void;
    onShareClick?: (url: URLMapping) => void;
}

const URLList: React.FC<URLListProps> = ({
    onAnalyticsClick,
    onEditClick,
    onShareClick,
}) => {
    const [params, setParams] = useState<URLListParams>({
        page: 1,
        pageSize: 10,
        search: '',
        sortBy: 'created_at',
        sortOrder: 'desc',
    });

    const [searchInput, setSearchInput] = useState('');

    const { data, isLoading, error, isFetching } = useGetUserUrlsQuery(params, {
        pollingInterval: 30000,
        refetchOnMountOrArgChange: true,
    });

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((searchTerm: string) => {
            setParams((prev) => ({ ...prev, search: searchTerm, page: 1 }));
        }, 500),
        []
    );

    useEffect(() => {
        debouncedSearch(searchInput);
    }, [searchInput, debouncedSearch]);

    const handlePageChange = (newPage: number) => {
        setParams((prev) => ({ ...prev, page: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSearchChange = (search: string) => {
        setSearchInput(search);
    };

    const handleFilterChange = (key: keyof URLListParams, value: any) => {
        setParams((prev) => ({ ...prev, [key]: value, page: 1 }));
    };

    const clearFilters = () => {
        setSearchInput('');
        setParams({
            page: 1,
            pageSize: 10,
            search: '',
            sortBy: 'created_at',
            sortOrder: 'desc',
        });
    };

    const hasActiveFilters =
        searchInput ||
        params.sortBy !== 'created_at' ||
        params.isCustomAlias !== undefined ||
        params.hasExpiry !== undefined ||
        params.isExpired !== undefined;

    if (isLoading && !isFetching) {
        return <URLListSkeleton />;
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <svg
                    className="w-12 h-12 text-red-500 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <p className="text-red-600 font-medium">Failed to load URLs</p>
                <p className="text-red-500 text-sm mt-1">
                    {(error as any)?.data?.message || 'Please try again later'}
                </p>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="mt-4"
                >
                    Retry
                </Button>
            </div>
        );
    }

    const urlData = (data?.data as any)?.data;
    const paginationMeta = (data?.data as any)?.pagination;
    const isEmpty = !urlData || urlData.length === 0;

    if (isEmpty) {
        return (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <svg
                    className="w-16 h-16 text-gray-400 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {hasActiveFilters ? 'No URLs match your filters' : 'No URLs yet'}
                </h3>
                <p className="text-gray-500 mb-4">
                    {hasActiveFilters
                        ? 'Try adjusting your search or filters'
                        : 'Create your first short URL to get started!'}
                </p>
                {hasActiveFilters && (
                    <Button variant="secondary" size="sm" onClick={clearFilters}>
                        Clear Filters
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search Input */}
                    <div className="flex-1">
                        <Input
                            placeholder="Search by short code or URL..."
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            leftIcon={
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                            }
                        />
                    </div>

                    {/* Filter Controls */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        {/* ✅ Custom Alias Filter */}
                        <div className="min-w-[160px]">
                            <Select
                                options={[
                                    { value: 'all', label: 'All Types' },
                                    { value: 'true', label: 'Custom Alias' },
                                    { value: 'false', label: 'Generated' },
                                ]}
                                value={
                                    params.isCustomAlias === undefined
                                        ? 'all'
                                        : params.isCustomAlias.toString()
                                }
                                onChange={(val) =>
                                    handleFilterChange(
                                        'isCustomAlias',
                                        val === 'all' ? undefined : val === 'true'
                                    )
                                }
                            />
                        </div>

                        {/* ✅ Expiry Filter */}
                        <div className="min-w-[160px]">
                            <Select
                                options={[
                                    { value: 'all', label: 'All Status' },
                                    { value: 'false', label: 'Active' },
                                    { value: 'true', label: 'Expired' },
                                ]}
                                value={
                                    params.isExpired === undefined
                                        ? 'all'
                                        : params.isExpired.toString()
                                }
                                onChange={(val) =>
                                    handleFilterChange(
                                        'isExpired',
                                        val === 'all' ? undefined : val === 'true'
                                    )
                                }
                            />
                        </div>

                        {/* ✅ Sort Options */}
                        <div className="min-w-[200px]">
                            <Select
                                options={[
                                    { value: 'created_at-desc', label: 'Newest First' },
                                    { value: 'created_at-asc', label: 'Oldest First' },
                                    { value: 'access_count-desc', label: 'Most Clicks' },
                                    { value: 'access_count-asc', label: 'Least Clicks' },
                                    { value: 'last_accessed_at-desc', label: 'Recently Accessed' },
                                    { value: 'short_code-asc', label: 'Short Code (A–Z)' },
                                    { value: 'short_code-desc', label: 'Short Code (Z–A)' },
                                ]}
                                value={`${params.sortBy}-${params.sortOrder}`}
                                onChange={(val) => {
                                    const [sortBy, sortOrder] = val.split('-');
                                    setParams((prev) => ({
                                        ...prev,
                                        sortBy: sortBy as any,
                                        sortOrder: sortOrder as any,
                                        page: 1,
                                    }));
                                }}
                            />
                        </div>

                        {/* ✅ Clear Filters Button */}
                        {hasActiveFilters && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={clearFilters}
                                className="whitespace-nowrap"
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                </div>
            </div>


            {/* Results Summary */}
            <div className="flex items-center justify-between text-sm px-2">
                <span className="text-gray-600">
                    <strong className="text-gray-900">
                        {paginationMeta?.totalItems || 0}
                    </strong>{' '}
                    URL{paginationMeta?.totalItems !== 1 ? 's' : ''} found
                    {hasActiveFilters && ' (filtered)'}
                </span>
                <span className="text-gray-600">
                    Page{' '}
                    <strong className="text-gray-900">
                        {paginationMeta?.currentPage || 1}
                    </strong>{' '}
                    of{' '}
                    <strong className="text-gray-900">
                        {paginationMeta?.totalPages || 1}
                    </strong>
                </span>
            </div>

            {/* Loading Overlay */}
            {isFetching && (
                <div className="fixed top-20 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-slide-down">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    <span className="text-sm">Refreshing...</span>
                </div>
            )}

            {/* URL List */}
            <div className="space-y-4">
                {urlData.map((url: any) => (
                    <URLCard
                        key={url.short_code}
                        url={url}
                        onAnalyticsClick={onAnalyticsClick}
                        onEditClick={onEditClick}
                        onShareClick={onShareClick}
                    />
                ))}
            </div>

            {/* Pagination */}
            {paginationMeta && paginationMeta.totalPages > 1 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-700">
                            Showing{' '}
                            <strong>
                                {(paginationMeta.currentPage - 1) * paginationMeta.pageSize + 1}
                            </strong>{' '}
                            to{' '}
                            <strong>
                                {Math.min(
                                    paginationMeta.currentPage * paginationMeta.pageSize,
                                    paginationMeta.totalItems
                                )}
                            </strong>{' '}
                            of <strong>{paginationMeta.totalItems}</strong> results
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!paginationMeta.hasPrevPage}
                                onClick={() => handlePageChange(paginationMeta.currentPage - 1)}
                            >
                                <svg
                                    className="w-4 h-4 mr-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15 19l-7-7 7-7"
                                    />
                                </svg>
                                Previous
                            </Button>

                            <div className="flex items-center gap-1">
                                {generatePageNumbers(
                                    paginationMeta.currentPage,
                                    paginationMeta.totalPages
                                ).map((pageNum, idx) =>
                                    pageNum === '...' ? (
                                        <span
                                            key={`ellipsis-${idx}`}
                                            className="px-3 py-1 text-gray-400"
                                        >
                                            ...
                                        </span>
                                    ) : (
                                        <Button
                                            key={pageNum}
                                            variant={
                                                pageNum === paginationMeta.currentPage
                                                    ? 'primary'
                                                    : 'secondary'
                                            }
                                            size="sm"
                                            onClick={() => handlePageChange(pageNum as number)}
                                            className="min-w-[2.5rem]"
                                        >
                                            {pageNum}
                                        </Button>
                                    )
                                )}
                            </div>

                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={!paginationMeta.hasNextPage}
                                onClick={() => handlePageChange(paginationMeta.currentPage + 1)}
                            >
                                Next
                                <svg
                                    className="w-4 h-4 ml-1"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper function to generate page numbers with ellipsis
function generatePageNumbers(
    currentPage: number,
    totalPages: number
): (number | string)[] {
    const pages: (number | string)[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);

        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);

        if (currentPage <= 3) {
            end = Math.min(showPages - 1, totalPages - 1);
        }
        if (currentPage >= totalPages - 2) {
            start = Math.max(2, totalPages - (showPages - 2));
        }

        if (start > 2) {
            pages.push('...');
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (end < totalPages - 1) {
            pages.push('...');
        }

        pages.push(totalPages);
    }

    return pages;
}

// Loading skeleton component
const URLListSkeleton: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="w-32 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                        <div className="w-32 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                        <div className="w-40 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>

            <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                    <div
                        key={i}
                        className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 bg-gray-200 rounded w-40"></div>
                                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                                </div>
                                <div className="h-4 bg-gray-200 rounded w-full"></div>
                                <div className="flex gap-4">
                                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                                    <div className="h-3 bg-gray-200 rounded w-20"></div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="h-8 w-8 bg-gray-200 rounded"></div>
                                <div className="h-8 w-8 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                    <div className="flex items-center gap-2">
                        <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                        <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                                <div
                                    key={i}
                                    className="h-8 w-10 bg-gray-200 rounded animate-pulse"
                                ></div>
                            ))}
                        </div>
                        <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default URLList;
