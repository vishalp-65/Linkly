import React, { useState } from 'react';
import { useLoginMutation } from '../../services/api';
import Modal from '../common/Modal';
import { useToast } from '../../contexts/ToastContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({
    isOpen,
    onClose,
    onSwitchToRegister,
    onSwitchToForgotPassword,
}) => {
    const [login, { isLoading, error }] = useLoginMutation();
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(formData).unwrap();
            onClose();
            setFormData({ email: '', password: '' });
            showToast({
                type: 'success',
                title: 'Login successfull',
                message: 'You are successfully logged in',
                duration: 2000
            });
        } catch (err: any) {
            // Error is handled by RTK Query
            console.error('Login failed:', err);
            showToast({
                type: 'error',
                title: 'Login failed',
                message: `${err?.data?.message}`,
                duration: 2000
            });
        }
    };

    const handleClose = () => {
        onClose();
        setFormData({ email: '', password: '' });
    };

    const getErrorMessage = (error: any): string => {
        if (error?.data?.error) {
            return error.data.message;
        }
        return 'Login failed. Please try again.';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Sign In"
            size="sm"
            closeOnOverlayClick={true}
            closeOnEscape={true}
        >
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{getErrorMessage(error)}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Email
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors"
                        placeholder="Enter your email"
                    />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-700 mb-1"
                    >
                        Password
                    </label>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       transition-colors"
                        placeholder="Enter your password"
                    />
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
                            Signing In...
                        </div>
                    ) : (
                        'Sign In'
                    )}
                </button>
            </form>

            <div className="mt-6 text-center">
                <button
                    onClick={onSwitchToForgotPassword}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                    Forgot your password?
                </button>
            </div>

            <div className="mt-4 text-center">
                <span className="text-sm text-gray-600">Don't have an account? </span>
                <button
                    onClick={onSwitchToRegister}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                    Sign up
                </button>
            </div>
        </Modal>
    );
};

export default LoginModal;