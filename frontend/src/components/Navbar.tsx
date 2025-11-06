import React from 'react';

const Navbar: React.FC = () => {
    return (
        <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo and Brand */}
                    <div className="flex items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h1 className="text-xl font-bold gradient-text">ShortLink</h1>
                                <p className="text-xs text-gray-500 -mt-1">URL Shortener</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <a href="#" className="text-blue-600 bg-blue-50 px-3 py-2 rounded-md text-sm font-medium">
                                Dashboard
                            </a>
                            <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                                Analytics
                            </a>
                            <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                                Settings
                            </a>
                        </div>
                    </div>

                    {/* User Menu */}
                    <div className="flex items-center space-x-4">
                        <button className="text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 01-7.5-7.5H2.5" />
                            </svg>
                        </button>
                        <button className="text-gray-400 hover:text-gray-600 p-2 rounded-md hover:bg-gray-100 transition-colors relative">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 01-7.5-7.5H2.5" />
                            </svg>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                        </button>
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm font-medium">U</span>
                            </div>
                            <div className="hidden md:block">
                                <p className="text-sm font-medium text-gray-900">User</p>
                                <p className="text-xs text-gray-500">Free Plan</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;