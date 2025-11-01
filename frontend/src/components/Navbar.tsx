import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import type { RootState } from '../store';
import { useLogoutMutation } from '../services/api';
import { ThemeToggle } from './common';
import { useRoutePreloader } from '../utils/preloader';

const Navbar: React.FC = () => {
    const location = useLocation();
    const { user, isGuest } = useSelector(
        (state: RootState) => state.auth
    );
    const [logout] = useLogoutMutation();
    const { preloadOnHover } = useRoutePreloader();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const userMenuRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // --- Close menus on outside click ---
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
                setShowMobileMenu(false);
            }
        };
        if (showUserMenu || showMobileMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showUserMenu, showMobileMenu]);

    // --- Logout handler ---
    const handleLogout = useCallback(async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) await logout({ refreshToken }).unwrap();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setShowUserMenu(false);
        }
    }, [logout]);

    // --- Helpers ---
    const getInitials = useCallback(
        (firstName?: string, lastName?: string) => {
            if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
            if (firstName) return firstName[0].toUpperCase();
            return user?.email?.[0]?.toUpperCase() || 'G';
        },
        [user?.email]
    );

    const isActiveRoute = useCallback(
        (path: string) => {
            // Special handling for analytics route
            if (path === '/analytics') {
                return location.pathname === '/analytics' || location.pathname.startsWith('/analytics/');
            }
            return location.pathname === path;
        },
        [location.pathname]
    );

    return (
        <>
            <nav className="bg-transparent backdrop-blur-lg border-b border-gray-300 dark:border-gray-700 sticky top-0 z-40 transition-all duration-300" role="navigation" aria-label="Main navigation">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-7">
                    <div className="flex justify-between items-center h-16">

                        <div className='flex justify-start items-center gap-8'>

                            {/* --- Logo --- */}
                            <Link to="/" className="flex items-center group" aria-label="Linkly - Go to homepage">
                                <div className="w-7 h-7 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                                    <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                                <div className="ml-1.5">
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                        Linkly
                                    </h1>
                                    {/* <p className="text-xs text-gray-500 -mt-1">URL Shortener</p> */}
                                </div>
                            </Link>

                            {/* --- Links --- */}
                            {!isGuest && (
                                <nav className="hidden md:flex items-baseline space-x-1" aria-label="Primary navigation">
                                    {[
                                        { path: '/dashboard', label: 'Dashboard', icon: 'home' },
                                        { path: '/analytics', label: 'Analytics', icon: 'chart' },
                                        { path: '/urls', label: 'Your URLs', icon: 'url' },
                                        { path: '/settings', label: 'Settings', icon: 'settings' },
                                    ]
                                        .filter(Boolean)
                                        .map((link: any) => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                {...preloadOnHover(link.path.substring(1))} // Remove leading slash for route name
                                                className={`relative flex text-nowrap items-center px-4 py-2 text-sm font-medium transition-colors duration-200 ${isActiveRoute(link.path)
                                                    ? 'text-blue-600 after:content-[""] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-b-2 after:border-blue-600 after:transition-all after:duration-300 after:w-[70%]'
                                                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 after:content-[""] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-b after:border-gray-300 after:transition-all after:duration-300 after:w-0 hover:after:w-[70%]'
                                                    }`}
                                                aria-current={isActiveRoute(link.path) ? 'page' : undefined}
                                            >
                                                {link.icon === 'home' && (
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2 7-7 7 7 2 2v10a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
                                                    </svg>
                                                )}
                                                {link.icon === 'chart' && (
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V9m4 10V5m4 14V13m4 6v-4m4 4V3" />
                                                    </svg>
                                                )}
                                                {link.icon === 'url' && (
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                    </svg>
                                                )}
                                                {link.icon === 'settings' && (
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 15.4a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 007.6 5a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019 8.6a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                                                    </svg>
                                                )}
                                                {link.label}
                                            </Link>
                                        ))}
                                </nav>
                            )}

                        </div>

                        {/* --- Mobile menu button --- */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
                                aria-expanded={showMobileMenu}
                                aria-controls="mobile-menu"
                                aria-label={showMobileMenu ? "Close main menu" : "Open main menu"}
                            >
                                <span className="sr-only">{showMobileMenu ? "Close main menu" : "Open main menu"}</span>
                                {!showMobileMenu ? (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        {/* --- User Section --- */}
                        <div className="hidden md:flex items-center space-x-3">

                            {!isGuest && (
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setShowUserMenu((prev) => !prev)}
                                        className="flex items-center space-x-3 px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 group cursor-pointer"
                                    >
                                        <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
                                            <span className="text-black dark:text-white text-sm font-semibold">
                                                {getInitials(user?.firstName, user?.lastName)}
                                            </span>
                                        </div>
                                        <svg
                                            className={`w-4 h-4 text-gray-400 transform transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>


                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2 z-50">
                                            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                                <p className="text-md font-medium text-gray-900 dark:text-gray-100">
                                                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User'}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">{user?.email}</p>
                                            </div>

                                            <ThemeToggle
                                                showLabel
                                                size="md"
                                                className="w-full -ml-1 items-start justify-start 
                                                        text-gray-700 dark:text-gray-300 
                                                        hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors 
                                                        focus:outline-none focus:ring-transparent focus:ring-offset-0"
                                            />

                                            <Link
                                                to="/settings"
                                                onClick={() => setShowUserMenu(false)}
                                                className="flex items-center px-3 py-2 rounded-md text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                Account Settings
                                            </Link>

                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 cursor-pointer"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                                    />
                                                </svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Mobile Menu Panel --- */}
                {showMobileMenu && (
                    <div className="md:hidden" ref={mobileMenuRef} id="mobile-menu">
                        <nav className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg" aria-label="Mobile navigation">
                            {!isGuest && (
                                <>
                                    {/* Mobile Navigation Links */}
                                    {[
                                        { path: '/dashboard', label: 'Dashboard', icon: 'home' },
                                        { path: '/analytics', label: 'Analytics', icon: 'chart' },
                                        { path: '/urls', label: 'Your URLs', icon: 'url' },
                                        { path: '/settings', label: 'Settings', icon: 'settings' },
                                    ].map((link) => (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            onClick={() => setShowMobileMenu(false)}
                                            {...preloadOnHover(link.path.substring(1))} // Remove leading slash for route name
                                            className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${isActiveRoute(link.path)
                                                ? 'text-blue-600 bg-blue-50'
                                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            {link.icon === 'home' && (
                                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2 7-7 7 7 2 2v10a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
                                                </svg>
                                            )}
                                            {link.icon === 'chart' && (
                                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19V9m4 10V5m4 14V13m4 6v-4m4 4V3" />
                                                </svg>
                                            )}
                                            {link.icon === 'url' && (
                                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                                </svg>
                                            )}
                                            {link.icon === 'settings' && (
                                                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005 15.4a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 007.6 5a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019 8.6a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                                                </svg>
                                            )}
                                            {link.label}
                                        </Link>
                                    ))}

                                    {/* Mobile User Section */}
                                    <section className="border-t border-gray-200 pt-4 mt-4" aria-label="User account">
                                        <div className="flex items-center px-3 py-2">
                                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                                                <span className="text-white text-sm font-semibold">
                                                    {getInitials(user?.firstName, user?.lastName)}
                                                </span>
                                            </div>
                                            <div className="ml-3">
                                                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                                                    {user?.firstName && user?.lastName
                                                        ? `${user.firstName} ${user.lastName}`
                                                        : user?.email}
                                                </p>
                                                <p className="text-sm text-gray-500">{user?.email}</p>
                                            </div>
                                        </div>

                                        <ThemeToggle
                                            showLabel
                                            size="md"
                                            className="w-full items-start justify-start 
                                                        text-gray-700 dark:text-gray-400 
                                                        hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors 
                                                        focus:outline-none focus:ring-transparent focus:ring-offset-0"
                                        />

                                        <Link
                                            to="/settings"
                                            onClick={() => setShowMobileMenu(false)}
                                            className="flex items-center px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Account Settings
                                        </Link>

                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setShowMobileMenu(false);
                                            }}
                                            className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                                        >
                                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Sign Out
                                        </button>
                                    </section>
                                </>
                            )}
                        </nav>
                    </div>
                )}
            </nav>
        </>
    );
};

export default Navbar;
