import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRequestPasswordResetMutation } from '../services/api';
import { Button } from '../components/common';
import Input from '../components/common/Input';
import { useToast } from '../contexts/ToastContext';

const ForgotPasswordPage: React.FC = () => {
    const { showToast } = useToast();
    const [requestPasswordReset, { isLoading }] = useRequestPasswordResetMutation();

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
        if (error) {
            setError('');
        }
    };

    const validateEmail = (): boolean => {
        if (!email) {
            setError('Email is required');
            return false;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateEmail()) return;

        try {
            await requestPasswordReset({ email }).unwrap();
            setIsSubmitted(true);
            showToast({ message: 'Password reset instructions sent to your email', type: 'success' });
        } catch (error: unknown) {
            const apiError = error as { data?: { message?: string }; status?: number };
            const errorMessage = apiError.data?.message || 'Failed to send reset email. Please try again.';
            showToast({ message: errorMessage, type: 'error' });

            if (apiError.status === 404) {
                setError('No account found with this email address');
            } else if (apiError.status === 429) {
                showToast({ message: 'Too many requests. Please try again later.', type: 'error' });
            }
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full">
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Check Your Email</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                            We've sent password reset instructions to <strong className="text-gray-900 dark:text-gray-100">{email}</strong>.
                            Please check your inbox and follow the link to reset your password.
                        </p>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Didn't receive the email? Check your spam folder or try again.
                            </p>

                            <Button
                                type="button"
                                variant="secondary"
                                className="w-full"
                                onClick={() => {
                                    setIsSubmitted(false);
                                    setEmail('');
                                }}
                            >
                                Try Different Email
                            </Button>
                        </div>

                        <div className="mt-8 pt-6 text-sm border-t border-gray-200 dark:border-gray-700">
                            <Link
                                to="/login"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                                Back to Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900 dark:to-red-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Forgot Password?</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            No worries! Enter your email address and we'll send you instructions to reset your password.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email Address"
                            type="email"
                            name="email"
                            value={email}
                            onChange={handleInputChange}
                            error={error}
                            placeholder="Enter your email address"
                            required
                            autoComplete="email"
                            autoFocus
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Instructions'}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 text-sm border-t border-gray-200 dark:border-gray-700 text-center space-y-3">
                        <p className="text-gray-600 dark:text-gray-400">
                            Remember your password?{' '}
                            <Link
                                to="/login"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                                Sign in here
                            </Link>
                        </p>
                    </div>
                </div>

                {/* <div className="text-center mt-6">
                    <Link
                        to="/"
                        className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Home
                    </Link>
                </div> */}
            </div>
        </div>
    );
};

export default ForgotPasswordPage;