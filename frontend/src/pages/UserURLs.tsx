import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import URLList from '../components/URLList';
import type { URLItem } from '../types/url.types';
import { Button } from '../components/common';
import PageHeader from '../components/common/PageHeader';

const UserURLs: React.FC = () => {
    const navigate = useNavigate();
    const { isGuest } = useSelector((state: RootState) => state.auth);

    const handleAnalyticsClick = (url: URLItem) => {
        navigate(`/analytics/${url.short_code}`);
    };

    const handleEditClick = (url: URLItem) => {
        console.log('Edit URL:', url.short_code);
        // TODO: Implement edit functionality
    };

    const handleShareClick = (url: URLItem) => {
        console.log('Share URL:', url.short_code);
        // TODO: Implement share functionality
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 dark:bg-blue-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 animate-pulse" />
            </div>

            <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
                {!isGuest && (
                    <div className="animate-fade-in">
                        {/* Header Section */}
                        <div className="flex flex-col gap-4">
                            {/* Title and Action Buttons Row */}
                            <div className="flex flex-col sm:flex-row sm:mx-2 sm:items-start sm:justify-between gap-4">
                                {/* Page Header */}
                                <div className="flex-1 min-w-0">
                                    <PageHeader
                                        title="Your URLs"
                                        subtitle="Manage and track your shortened links"
                                        showBackButton
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-row gap-2 sm:gap-3 justify-end sm:pt-0">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="flex-1 sm:flex-initial whitespace-nowrap border border-gray-300 dark:border-gray-600 text-xs sm:text-sm px-3 sm:px-4"
                                    >
                                        <svg
                                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        <span>Export</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="flex-1 sm:flex-initial whitespace-nowrap text-xs sm:text-sm px-3 sm:px-4"
                                    >
                                        <svg
                                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                            />
                                        </svg>
                                        <span>Bulk Actions</span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* URL List Section */}
                        <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 sm:p-4 lg:p-6">
                            <URLList
                                onAnalyticsClick={handleAnalyticsClick}
                                onEditClick={handleEditClick}
                                onShareClick={handleShareClick}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserURLs;