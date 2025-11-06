import React from 'react';
import { useNavigate } from 'react-router-dom';
import URLList from '../components/URLList';
import URLShortenerForm from '../components/URLShortenerForm';
import type { URLItem } from '../services/api';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();

    const handleAnalyticsClick = (url: URLItem) => {
        // Navigate to analytics page for this URL
        navigate(`/analytics/${url.shortCode}`);
    };

    const handleEditClick = (url: URLItem) => {
        // Open edit modal or navigate to edit page
        console.log('Edit URL:', url.shortCode);
        // TODO: Implement edit functionality
    };

    const handleShareClick = (url: URLItem) => {
        // Open share modal with social media options
        console.log('Share URL:', url.shortCode);
        // TODO: Implement share functionality
    };



    return (
        <div className="bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">URL Dashboard</h1>
                            <p className="mt-2 text-gray-600">
                                Manage and monitor your shortened URLs
                            </p>
                        </div>
                        <div className="hidden md:flex items-center space-x-4">
                            <div className="flex items-center text-sm text-gray-500">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                All systems operational
                            </div>
                        </div>
                    </div>
                </div>

                {/* URL Shortener Form */}
                <URLShortenerForm />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Total URLs
                                    </dt>
                                    <dd className="text-2xl font-bold text-gray-900 mt-1">
                                        <span className="bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                                            247
                                        </span>
                                    </dd>
                                    <dd className="text-xs text-green-600 font-medium mt-1">
                                        +12% from last month
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Total Clicks
                                    </dt>
                                    <dd className="text-2xl font-bold text-gray-900 mt-1">
                                        <span className="bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                                            12.4K
                                        </span>
                                    </dd>
                                    <dd className="text-xs text-green-600 font-medium mt-1">
                                        +23% from last month
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300 group">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Active URLs
                                    </dt>
                                    <dd className="text-2xl font-bold text-gray-900 mt-1">
                                        <span className="bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
                                            189
                                        </span>
                                    </dd>
                                    <dd className="text-xs text-green-600 font-medium mt-1">
                                        +8% from last month
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* URL List */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    Your URLs
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">Manage and track your shortened links</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                                    Export
                                </button>
                                <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                                    Bulk Actions
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <URLList
                            onAnalyticsClick={handleAnalyticsClick}
                            onEditClick={handleEditClick}
                            onShareClick={handleShareClick}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;