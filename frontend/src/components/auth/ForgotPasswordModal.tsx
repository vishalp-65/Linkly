import React, { useState } from 'react';
import { apiClient, getErrorMessage } from '../../utils/api';
import Modal from '../common/Modal';
import { useToast } from '../../contexts/ToastContext';

interface ForgotPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToLogin: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
    isOpen,
    onClose,
    onSwitchToLogin,
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await apiClient.post('/auth/request-password-reset', { email });
            setSuccess(true);
            showToast({
                type: 'success',
                title: 'OTP sent',
                message: 'A OTP is sent on your mail',
                duration: 5000
            });
        } catch (error) {
            setError(getErrorMessage(error));
            showToast({
                type: 'error',
                title: 'OTP failed',
                message: 'Failed to send OTP',
                duration: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose();
        setEmail('');
        setSuccess(false);
        setError('');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Reset Password"
            size="sm"
            closeOnOverlayClick
            closeOnEscape
        >
            {success ? (
                <div className="text-center">
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                        <p className="text-sm text-green-600">
                            If an account with that email exists, a password reset link has been sent.
                        </p>
                    </div>
                    <button
                        onClick={onSwitchToLogin}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Back to Sign In
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-sm text-gray-600 mb-4">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
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
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md 
                                           focus:outline-none focus:ring-2 focus:ring-blue-500 
                                           focus:border-transparent"
                                placeholder="Enter your email"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md 
                                       hover:bg-blue-700 focus:outline-none focus:ring-2 
                                       focus:ring-blue-500 focus:ring-offset-2 
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button
                            onClick={onSwitchToLogin}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Back to Sign In
                        </button>
                    </div>
                </>
            )}
        </Modal>
    );
};

export default ForgotPasswordModal;
