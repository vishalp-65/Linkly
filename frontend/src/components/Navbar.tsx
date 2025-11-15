import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { useLogoutMutation } from '../services/api';
import { ThemeToggle } from './common';
import { useRoutePreloader } from '../utils/preloader';

const Navbar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isGuest } = useSelector(
        (state: RootState) => state.auth
    );
    const [logout] = useLogoutMutation();
    const { preloadOnHover } = useRoutePreloader();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const userMenuRef = useRef<HTMLDivElement>(null);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

    // --- Close menus on outside click ---
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
            }
            if (
                mobileMenuRef.current &&
                !mobileMenuRef.current.contains(e.target as Node) &&
                mobileMenuButtonRef.current &&
                !mobileMenuButtonRef.current.contains(e.target as Node)
            ) {
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
            if (path === '/analytics') {
                return location.pathname === '/analytics' || location.pathname.startsWith('/analytics/');
            }
            return location.pathname === path;
        },
        [location.pathname]
    );

    const handleLogoClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isGuest) {
            navigate('/dashboard');
        } else {
            navigate('/');
        }
    };

    return (
        <>
            <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-all duration-300" role="navigation" aria-label="Main navigation">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">

                        <div className='flex justify-start items-center gap-8'>

                            {/* --- Logo --- */}
                            <Link
                                to={!isGuest ? "/dashboard" : "/"}
                                onClick={handleLogoClick}
                                className="flex items-center group"
                                aria-label="Linkly - Go to homepage"
                            >
                                <img
                                    src="/favicon.svg"
                                    alt="Logo"
                                    className="w-7 h-7 text-white"
                                />

                                <div className="ml-2">
                                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                                        Linkly
                                    </h1>
                                </div>
                            </Link>

                            {/* --- Desktop Navigation Links (Logged In) --- */}
                            {!isGuest && (
                                <nav className="hidden md:flex items-baseline space-x-1" aria-label="Primary navigation">
                                    {[
                                        { path: '/dashboard', label: 'Dashboard', icon: 'home' },
                                        { path: '/analytics', label: 'Analytics', icon: 'chart' },
                                        { path: '/urls', label: 'Your URLs', icon: 'url' },
                                        { path: '/settings', label: 'Settings', icon: 'settings' },
                                    ].map((link: any) => (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            {...preloadOnHover(link.path.substring(1))}
                                            className={`relative flex text-nowrap items-center px-4 py-2 text-sm font-medium transition-colors duration-200 ${isActiveRoute(link.path)
                                                ? 'text-blue-600 dark:text-blue-400 after:content-[""] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-b-2 after:border-blue-600 dark:after:border-blue-400 after:transition-all after:duration-300 after:w-[70%]'
                                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 after:content-[""] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-b after:border-gray-300 dark:after:border-gray-600 after:transition-all after:duration-300 after:w-0 hover:after:w-[70%]'
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

                        {/* --- Desktop Right Section --- */}
                        <div className="hidden md:flex items-center space-x-3">
                            {/* Guest User - Show Login/Signup */}
                            {isGuest && (
                                <>
                                    <ThemeToggle iconClass='w-5 h-5' />
                                    <Link
                                        to="/login"
                                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                                    >
                                        Sign Up
                                    </Link>
                                </>
                            )}

                            {/* Logged In User - Show User Menu */}
                            {!isGuest && (
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setShowUserMenu((prev) => !prev)}
                                        className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group cursor-pointer"
                                    >
                                        <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-200">
                                            <span className="text-white text-sm font-semibold">
                                                {getInitials(user?.firstName, user?.lastName)}
                                            </span>
                                        </div>
                                        <svg
                                            className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''
                                                }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {showUserMenu && (
                                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-2 z-50">
                                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'User'}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
                                            </div>

                                            <div onClick={() => setShowUserMenu(false)} className="py-1">
                                                <ThemeToggle
                                                    showLabel
                                                    className="flex items-center gap-3 w-full justify-start text-sm px-4 py-2.5
                                                            text-gray-700 dark:text-gray-300 rounded-none 
                                                            hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors 
                                                            focus:outline-none focus:ring-transparent focus:ring-offset-0"
                                                />

                                                <Link
                                                    to="/settings"
                                                    onClick={() => setShowUserMenu(false)}
                                                    className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Account Settings
                                                </Link>

                                                <button
                                                    onClick={handleLogout}
                                                    className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
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
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* --- Mobile menu button --- */}
                        <div className="md:hidden flex items-center space-x-2">
                            {isGuest && <ThemeToggle iconClass='w-5 h-5' />}
                            <button
                                ref={mobileMenuButtonRef}
                                onClick={() => setShowMobileMenu(!showMobileMenu)}
                                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors"
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
                    </div>
                </div>

                {/* --- Mobile Menu Panel --- */}
                {showMobileMenu && (
                    <div className="md:hidden" ref={mobileMenuRef} id="mobile-menu">
                        <nav className="px-4 pt-2 pb-4 space-y-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-lg" aria-label="Mobile navigation">
                            {/* Guest User - Show Login/Signup */}
                            {isGuest && (
                                <div className="space-y-2 py-2">
                                    <Link
                                        to="/login"
                                        onClick={() => setShowMobileMenu(false)}
                                        className="flex items-center justify-center bg-gray-300/60 dark:bg-gray-800 px-4 py-3 rounded-lg text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setShowMobileMenu(false)}
                                        className="flex items-center justify-center px-4 py-3 rounded-lg text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                                    >
                                        Sign Up
                                    </Link>
                                </div>
                            )}

                            {/* Logged In User Navigation */}
                            {!isGuest && (
                                <>
                                    {/* Navigation Links */}
                                    <div className="space-y-1">
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
                                                {...preloadOnHover(link.path.substring(1))}
                                                className={`flex items-center px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActiveRoute(link.path)
                                                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
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
                                    </div>

                                    {/* User Section - Separated */}
                                    <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4 space-y-1">
                                        <div className="flex items-center px-4 py-3 mb-2">
                                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                                                <span className="text-white text-sm font-semibold">
                                                    {getInitials(user?.firstName, user?.lastName)}
                                                </span>
                                            </div>
                                            <div className="ml-3 flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                                    {user?.firstName && user?.lastName
                                                        ? `${user.firstName} ${user.lastName}`
                                                        : user?.email}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                                            </div>
                                        </div>

                                        <div onClick={() => setShowMobileMenu(false)}>
                                            <ThemeToggle
                                                showLabel
                                                iconClass='w-5 h-5'
                                                className="flex items-center gap-3 w-full justify-start text-base font-medium px-4 py-2.5
                                                            text-gray-700 dark:text-gray-300 rounded-none 
                                                            hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors 
                                                            focus:outline-none focus:ring-transparent focus:ring-offset-0"
                                            />
                                        </div>

                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setShowMobileMenu(false);
                                            }}
                                            className="flex items-center w-full px-4 py-3 rounded-lg text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                            </svg>
                                            Sign Out
                                        </button>
                                    </div>
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