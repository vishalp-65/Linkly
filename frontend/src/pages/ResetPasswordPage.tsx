import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useConfirmPasswordResetMutation } from '../services/api';
import { Button } from '../components/common';
import Input from '../components/common/Input';
import Card from '../components/common/Card';
import { useToast } from '../contexts/ToastContext';

interface FormData {
    newPassword: string;
    confirmPassword: string;
}

interface FormErrors {
    newPassword?: string;
    confirmPassword?: string;
}

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [confirmPasswordReset, { isLoading }] = useConfirmPasswordResetMutation();

    const [formData, setFormData] = useState<FormData>({
        newPassword: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            showToast({ message: 'Invalid or missing reset token', type: 'error' });
            navigate('/forgot-password');
        }
    }, [token, navigate, showToast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.newPassword) {
            newErrors.newPassword = 'Password is required';
        } else if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters long';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
            newErrors.newPassword = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm() || !token) return;

        try {
            await confirmPasswordReset({
                token,
                newPassword: formData.newPassword,
            }).unwrap();

            setIsSuccess(true);
            showToast({ message: 'Password reset successfully! You can now sign in with your new password.', type: 'success' });
        } catch (error: unknown) {
            const apiError = error as { data?: { message?: string }; status?: number };
            const errorMessage = apiError.data?.message || 'Failed to reset password. Please try again.';
            showToast({ message: errorMessage, type: 'error' });

            if (apiError.status === 400) {
                showToast({ message: 'Invalid or expired reset token. Please request a new password reset.', type: 'error' });
            } else if (apiError.status === 429) {
                showToast({ message: 'Too many attempts. Please try again later.', type: 'error' });
            }
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full">
                    <Card padding="lg" className="dark:bg-gray-800 dark:border-gray-700 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Password Reset Complete</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                            Your password has been successfully reset. You can now sign in to your account with your new password.
                        </p>

                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            Sign In Now
                        </Link>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <Card padding="lg" className="dark:bg-gray-800 dark:border-gray-700">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Reset Your Password</h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Enter your new password below to complete the reset process.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Input
                                label="New Password"
                                type="password"
                                name="newPassword"
                                value={formData.newPassword}
                                onChange={handleInputChange}
                                error={errors.newPassword}
                                placeholder="Enter your new password"
                                required
                                autoComplete="new-password"
                                autoFocus
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Must be at least 8 characters with uppercase, lowercase, and number
                            </p>
                        </div>

                        <Input
                            label="Confirm New Password"
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleInputChange}
                            error={errors.confirmPassword}
                            placeholder="Confirm your new password"
                            required
                            autoComplete="new-password"
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Resetting Password...' : 'Reset Password'}
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
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

export default ResetPasswordPage;