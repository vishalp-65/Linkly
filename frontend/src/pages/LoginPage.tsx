import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLoginMutation } from '../services/api';
import { Button } from '../components/common';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import { useToast } from '../contexts/ToastContext';
import type { RootState } from '../store';

interface FormData {
    email: string;
    password: string;
}

interface FormErrors {
    email?: string;
    password?: string;
}

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);

    const [login, { isLoading }] = useLoginMutation();

    const [formData, setFormData] = useState<FormData>({
        email: '',
        password: '',
    });
    const [errors, setErrors] = useState<FormErrors>({});

    useEffect(() => {
        if (isAuthenticated) {
            const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        }
    }, [isAuthenticated, navigate, location]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        try {
            await login(formData).unwrap();
            showToast({ message: 'Welcome back! You have been successfully logged in.', type: 'success' });

            const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
        } catch (error: unknown) {
            const apiError = error as { data?: { message?: string }; status?: number };
            const errorMessage = apiError.data?.message || 'Login failed. Please try again.';
            showToast({ message: errorMessage, type: 'error' });

            if (apiError.status === 401) {
                setErrors({ password: 'Invalid email or password' });
            } else if (apiError.status === 429) {
                showToast({ message: 'Too many login attempts. Please try again later.', type: 'error' });
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <Card padding="lg" className="dark:bg-gray-800 dark:border-gray-700">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Welcome Back</h1>
                        <p className="text-gray-600 dark:text-gray-400">Sign in to your account to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email Address"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            error={errors.email}
                            placeholder="Enter your email"
                            required
                            autoComplete="email"
                        />

                        <Input
                            label="Password"
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            error={errors.password}
                            placeholder="Enter your password"
                            required
                            autoComplete="current-password"
                        />

                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <input
                                    id="remember-me"
                                    name="remember-me"
                                    type="checkbox"
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                />
                                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                                    Remember me
                                </label>
                            </div>

                            <Link
                                to="/forgot-password"
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing In...' : 'Sign In'}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                            Don't have an account?{' '}
                            <Link
                                to="/register"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                                Sign up here
                            </Link>
                        </p>
                    </div>
                </Card>

                <div className="text-center mt-6">
                    <Link
                        to="/"
                        className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;