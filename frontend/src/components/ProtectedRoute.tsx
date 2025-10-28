import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation, Link } from 'react-router-dom';
import type { RootState } from '../store';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requireAuth?: boolean;
    requirePermission?: keyof RootState['auth']['permissions'];
    fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    requireAuth = false,
    requirePermission,
    fallback,
}) => {
    const location = useLocation();
    const { isAuthenticated, isGuest, permissions } = useSelector((state: RootState) => state.auth);

    // Check authentication requirement
    if (requireAuth && (isGuest || !isAuthenticated)) {
        return fallback || <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check permission requirement
    if (requirePermission && permissions) {
        const hasPermission = permissions[requirePermission];

        if (!hasPermission) {
            return (
                fallback || (
                    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100">
                        <div className="max-w-md w-full bg-white rounded-xl shadow-xl border border-gray-200 p-8 text-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">Premium Feature</h2>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                {isGuest
                                    ? 'This feature requires user registration. Sign up to unlock advanced features and analytics!'
                                    : 'This feature is not available with your current plan. Upgrade to access premium features.'
                                }
                            </p>
                            {isGuest && (
                                <div className="space-y-3">
                                    <Link
                                        to="/register"
                                        state={{ from: location }}
                                        className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg text-center"
                                    >
                                        Sign Up Now
                                    </Link>
                                    <p className="text-xs text-gray-500">
                                        Already have an account?{' '}
                                        <Link
                                            to="/login"
                                            state={{ from: location }}
                                            className="text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            Sign In
                                        </Link>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )
            );
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;