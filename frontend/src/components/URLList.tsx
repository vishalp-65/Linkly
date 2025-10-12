import React, { useState, useEffect, useCallback } from 'react';
import { useGetUserUrlsQuery } from '../services/api';
import type { URLListParams, URLItem } from '../services/api';
import Button from './common/Button';
import Input from './common/Input';
import URLCard from './URLCard';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

interface URLListProps {
    onUrlSelect?: (url: URLItem) => void;
    onAnalyticsClick?: (url: URLItem) => void;
    onEditClick?: (url: URLItem) => void;
    onShareClick?: (url: URLItem) => void;
}

const URLList: React.FC<URLListProps> = ({
    onAnalyticsClick,
    onEditClick,
    onShareClick
}) => {
    const [params, setParams] = useState<URLListParams>({
        page: 1,
        limit: 10,
        search: '',
        status: 'all',
        sortBy: 'date',
        sortOrder: 'desc'
    });

    const [searchInput, setSearchInput] = useState('');

    const { data, isLoading, error } = useGetUserUrlsQuery(params);

    // Debounced search
    const debouncedSearch = useCallback(
        debounce((searchTerm: string) => {
            setParams(prev => ({ ...prev, search: searchTerm, page: 1 }));
        }, 300),
        []
    );

    useEffect(() => {
        debouncedSearch(searchInput);
    }, [searchInput, debouncedSearch]);

    const handlePageChange = (newPage: number) => {
        setParams(prev => ({ ...prev, page: newPage }));
    };

    const handleSearchChange = (search: string) => {
        setSearchInput(search);
    };

    const handleStatusFilter = (status: 'all' | 'active' | 'expired') => {
        setParams(prev => ({ ...prev, status, page: 1 }));
    };



    const clearFilters = () => {
        setSearchInput('');
        setParams({
            page: 1,
            limit: 10,
            search: '',
            status: 'all',
            sortBy: 'date',
            sortOrder: 'desc'
        });
    };

    const hasActiveFilters = searchInput || params.status !== 'all' || params.sortBy !== 'date';

    if (isLoading) {
        return <URLListSkeleton />;
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600">Failed to load URLs. Please try again.</p>
            </div>
        );
    }

    if (!data || data.urls.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-500">
                    {hasActiveFilters ? 'No URLs match your filters.' : 'No URLs found. Create your first short URL!'}
                </p>
                {hasActiveFilters && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={clearFilters}
                        className="mt-2"
                    >
                        Clear Filters
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                    <Input
                        placeholder="Search URLs by short code or original URL..."
                        value={searchInput}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        leftIcon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        }
                        rightIcon={
                            searchInput && (
                                <button
                                    onClick={() => handleSearchChange('')}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )
                        }
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <select
                        value={params.status}
                        onChange={(e) => handleStatusFilter(e.target.value as any)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active URLs</option>
                        <option value="expired">Expired URLs</option>
                    </select>

                    <select
                        value={`${params.sortBy}-${params.sortOrder}`}
                        onChange={(e) => {
                            const [sortBy, sortOrder] = e.target.value.split('-');
                            setParams(prev => ({ ...prev, sortBy: sortBy as any, sortOrder: sortOrder as any, page: 1 }));
                        }}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                        <option value="date-desc">Newest First</option>
                        <option value="date-asc">Oldest First</option>
                        <option value="clicks-desc">Most Clicks</option>
                        <option value="clicks-asc">Least Clicks</option>
                        <option value="alphabetical-asc">A to Z</option>
                        <option value="alphabetical-desc">Z to A</option>
                    </select>

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

            {/* Results summary */}
            {data && (
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                        {data.total} {data.total === 1 ? 'URL' : 'URLs'} found
                        {hasActiveFilters && ' (filtered)'}
                    </span>
                    <span>
                        Page {data.page} of {data.totalPages}
                    </span>
                </div>
            )}

            {/* URL List using URLCard components */}
            <div className="space-y-4">
                {data.urls.map((url) => (
                    <URLCard
                        key={url.id}
                        url={url}
                        onAnalyticsClick={onAnalyticsClick}
                        onEditClick={onEditClick}
                        onShareClick={onShareClick}
                    />
                ))}
            </div>

            {/* Pagination */}
            {data.totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        Showing {((data.page - 1) * params.limit!) + 1} to {Math.min(data.page * params.limit!, data.total)} of {data.total} results
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={data.page <= 1}
                            onClick={() => handlePageChange(data.page - 1)}
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                                const pageNum = Math.max(1, Math.min(data.totalPages - 4, data.page - 2)) + i;
                                return (
                                    <Button
                                        key={pageNum}
                                        variant={pageNum === data.page ? "primary" : "secondary"}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        className="min-w-[2rem]"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={data.page >= data.totalPages}
                            onClick={() => handlePageChange(data.page + 1)}
                        >
                            Next
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Loading skeleton component
const URLListSkeleton: React.FC = () => {
    return (
        <div className="space-y-6">
            {/* Search and filters skeleton */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-32 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                    <div className="w-40 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                </div>
            </div>

            {/* Results summary skeleton */}
            <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>

            {/* URL list skeleton */}
            <div className="space-y-4">
                {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                                    <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>
                                </div>
                                <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                                <div className="flex gap-4">
                                    <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                                </div>
                            </div>
                            <div className="h-8 bg-gray-200 rounded w-8 animate-pulse"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination skeleton */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
                <div className="flex items-center gap-2">
                    <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                    <div className="flex gap-1">
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={i} className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                        ))}
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-16 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};

export default URLList;