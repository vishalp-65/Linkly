import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import URLList from '../components/URLList';
import type { URLItem } from '../types/url.types';
import { Button } from '../components/common';

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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* URL List */}
                {!isGuest && (

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
                                {!isGuest && (
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='sm'
                                            className='w-auto text-nowrap border border-r-2 border-gray-300'
                                        >
                                            Export
                                        </Button>
                                        <Button
                                            type='button'
                                            size='sm'
                                            className='w-auto text-nowrap'
                                        >
                                            Bulk Actions
                                        </Button>
                                    </div>
                                )}
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
                )}
            </div>
        </div>
    );
};

export default UserURLs;