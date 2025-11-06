import React, { useState } from 'react';
import { useRegisterMutation } from '../../services/api';
import Modal from '../common/Modal';
import { useToast } from '../../contexts/ToastContext';

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void;
}

const RegisterModal: React.FC<RegisterModalProps> = ({
    isOpen,
    onClose,
    onSwitchToLogin,
}) => {
    const [register, { isLoading, error }] = useRegisterMutation();
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
    });

    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear validation errors when user starts typing
        if (validationErrors[name]) {
            setValidationErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!formData.email) {
            errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Please enter a valid email';
        }

        if (!formData.password) {
            errors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            errors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            errors.password = 'Password must contain uppercase, lowercase, and number';
        }

        if (!formData.confirmPassword) {
            errors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Passwords do not match';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            const { confirmPassword, ...userData } = formData;
            await register(userData).unwrap();
            onClose();
            setFormData({
                email: '',
                password: '',
                confirmPassword: '',
                firstName: '',
                lastName: '',
            });
            showToast({
                type: 'success',
                title: 'User registered',
                message: 'You are registered successfully',
                duration: 2000
            });
        } catch (err: any) {
            // Error is handled by RTK Query
            console.error('Registration failed:', err);
            showToast({
                type: 'error',
                title: 'Register failed!',
                message: `${err?.data?.message}`,
                duration: 2000
            });
        }
    };

    const handleClose = () => {
        onClose();
        setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            firstName: '',
            lastName: '',
        });
        setValidationErrors({});
    };

    const getErrorMessage = (error: any): string => {
        if (error?.data?.error) {
            return error.data.message;
        }
        return 'Registration failed. Please try again.';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Create Account"
            size="md"
            closeOnOverlayClick={true}
            closeOnEscape={true}
        >
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{getErrorMessage(error)}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                        </label>
                        <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-colors"
                            placeholder="First name"
                        />
                    </div>

                    <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                        </label>
                        <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md 
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         transition-colors"
                            placeholder="Last name"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Enter your email"
                    />
                    {validationErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password *
                    </label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${validationErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Create a password"
                    />
                    {validationErrors.password && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                    )}
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password *
                    </label>
                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${validationErrors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Confirm your password"
                    />
                    {validationErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2.5 px-4 rounded-md 
                     hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 
                     focus:ring-blue-500 focus:ring-offset-2 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200 font-medium"
                >
                    {isLoading ? (
                        <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating Account...
                        </div>
                    ) : (
                        'Create Account'
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <span className="text-sm text-gray-600">Already have an account? </span>
                <button
                    onClick={onSwitchToLogin}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                    Sign in
                </button>
            </div>
        </Modal>
    );
};

export default RegisterModal;