import React, { useState } from 'react';
import { Card, Button, Input, FormField, Modal } from '../common';
import { useToast } from '../../contexts/ToastContext';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { useChangePasswordMutation, useDeleteAccountMutation } from '../../services/api';
import { logout } from '../../store/authSlice';
import { useNavigate } from 'react-router-dom';
// FontAwesome icons are loaded globally via CSS

// Types
interface EmailForm {
    newEmail: string;
    confirmEmail: string;
    currentPassword: string;
}

interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

interface DeleteForm {
    confirmText: string;
    password: string;
}

// Constants
const PASSWORD_MIN_LENGTH = 8;
const DELETE_CONFIRMATION_TEXT = 'DELETE';

const AccountSettings: React.FC = () => {
    const { showToast } = useToast();
    const { user } = useSelector((state: RootState) => state.auth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [changePassword] = useChangePasswordMutation();
    const [deleteAccount] = useDeleteAccountMutation();

    // Modal states
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [emailForm, setEmailForm] = useState<EmailForm>({
        newEmail: '',
        confirmEmail: '',
        currentPassword: ''
    });

    const [passwordForm, setPasswordForm] = useState<PasswordForm>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [deleteForm, setDeleteForm] = useState<DeleteForm>({
        confirmText: '',
        password: ''
    });

    // Utility functions
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const resetEmailForm = () => {
        setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' });
    };

    const resetPasswordForm = () => {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    };

    const resetDeleteForm = () => {
        setDeleteForm({ confirmText: '', password: '' });
    };

    // Email update handler
    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (emailForm.newEmail !== emailForm.confirmEmail) {
            showToast({ message: 'Email addresses do not match', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            showToast({ message: 'Email update not implemented yet', type: 'error' });
            setIsEmailModalOpen(false);
            resetEmailForm();
        } catch (error) {
            showToast({ message: 'Failed to update email', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Password change handler
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast({ message: 'Passwords do not match', type: 'error' });
            return;
        }

        if (passwordForm.newPassword.length < PASSWORD_MIN_LENGTH) {
            showToast({
                message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
                type: 'error'
            });
            return;
        }

        setIsLoading(true);
        try {
            await changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword,
            }).unwrap();

            showToast({ message: 'Password changed successfully', type: 'success' });
            setIsPasswordModalOpen(false);
            resetPasswordForm();
        } catch (error: any) {
            const errMsg = error?.data?.message ||
                'Failed to change password. Please check your current password.';
            showToast({ message: errMsg, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // Account deletion handler
    const handleAccountDeletion = async (e: React.FormEvent) => {
        e.preventDefault();

        if (deleteForm.confirmText !== DELETE_CONFIRMATION_TEXT) {
            showToast({
                message: `Please type ${DELETE_CONFIRMATION_TEXT} to confirm`,
                type: 'error'
            });
            return;
        }

        setIsLoading(true);
        try {
            await deleteAccount({
                password: deleteForm.password,
                confirmText: deleteForm.confirmText
            }).unwrap();

            showToast({
                message: 'Account deleted successfully. You will be logged out.',
                type: 'success'
            });

            setIsDeleteModalOpen(false);
            resetDeleteForm();

            // Wait a moment for the user to see the success message
            setTimeout(() => {
                dispatch(logout());
                navigate('/login');
            }, 1500);
        } catch (error: any) {
            const errMsg = error?.data?.message ||
                'Failed to delete account. Please check your password and try again.';
            showToast({ message: errMsg, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Account Information Card */}
            <Card>
                <div className="p-6">
                    <div className="flex items-center space-x-2 mb-6">
                        <i className="fas fa-shield-alt text-xl text-indigo-600 dark:text-indigo-400"></i>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            Account Information
                        </h2>
                    </div>

                    <div className="space-y-6">
                        {/* Email Section */}
                        <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start space-x-3 flex-1">
                                <i className="fas fa-envelope text-gray-500 dark:text-gray-400 mt-1"></i>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Email Address
                                    </label>
                                    <span className="text-gray-900 dark:text-white font-mono text-sm">
                                        {user?.email}
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsEmailModalOpen(true)}
                            >
                                Change
                            </Button>
                        </div>

                        {/* Password Section */}
                        <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start space-x-3 flex-1">
                                <i className="fas fa-lock text-gray-500 dark:text-gray-400 mt-1"></i>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Password
                                    </label>
                                    <span className="text-gray-900 dark:text-white font-mono text-sm">
                                        ••••••••••••
                                    </span>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setIsPasswordModalOpen(true)}
                            >
                                Change
                            </Button>
                        </div>

                        {/* Account Created Section */}
                        <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <i className="fas fa-calendar text-gray-500 dark:text-gray-400 mt-1"></i>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Account Created
                                </label>
                                <span className="text-gray-900 dark:text-white text-sm">
                                    {formatDate(user?.createdAt!)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Danger Zone Card */}
            <Card>
                <div className="p-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <i className="fas fa-exclamation-triangle text-xl text-red-600 dark:text-red-400"></i>
                        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
                            Danger Zone
                        </h2>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                        <p className="text-sm text-red-800 dark:text-red-200">
                            Once you delete your account, there is no going back. Please be certain.
                            All your data will be permanently removed.
                        </p>
                    </div>

                    <Button
                        variant="danger"
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        <i className="fas fa-trash-alt mr-2"></i>
                        Delete Account
                    </Button>
                </div>
            </Card>

            {/* Email Update Modal */}
            <Modal
                isOpen={isEmailModalOpen}
                onClose={() => {
                    setIsEmailModalOpen(false);
                    resetEmailForm();
                }}
                title="Change Email Address"
                size="md"
            >
                <form onSubmit={handleEmailUpdate} className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                            A verification email will be sent to your new email address.
                        </p>
                    </div>

                    <FormField label="New Email Address" required>
                        <Input
                            type="email"
                            value={emailForm.newEmail}
                            onChange={(e) => setEmailForm(prev => ({
                                ...prev,
                                newEmail: e.target.value
                            }))}
                            placeholder="Enter new email address"
                            required
                        />
                    </FormField>

                    <FormField label="Confirm New Email" required>
                        <Input
                            type="email"
                            value={emailForm.confirmEmail}
                            onChange={(e) => setEmailForm(prev => ({
                                ...prev,
                                confirmEmail: e.target.value
                            }))}
                            placeholder="Confirm new email address"
                            required
                        />
                    </FormField>

                    <FormField label="Current Password" required>
                        <Input
                            type="password"
                            value={emailForm.currentPassword}
                            onChange={(e) => setEmailForm(prev => ({
                                ...prev,
                                currentPassword: e.target.value
                            }))}
                            placeholder="Enter current password"
                            required
                        />
                    </FormField>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsEmailModalOpen(false);
                                resetEmailForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={isLoading}>
                            Update Email
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Password Change Modal */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => {
                    setIsPasswordModalOpen(false);
                    resetPasswordForm();
                }}
                title="Change Password"
                size="md"
            >
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                        <div className="flex items-start space-x-2">
                            <i className="fas fa-check-circle text-amber-600 dark:text-amber-400 mt-0.5"></i>
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-medium mb-1">Password Requirements:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>At least {PASSWORD_MIN_LENGTH} characters long</li>
                                    <li>Mix of letters, numbers, and symbols recommended</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <FormField label="Current Password" required>
                        <Input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm(prev => ({
                                ...prev,
                                currentPassword: e.target.value
                            }))}
                            placeholder="Enter current password"
                            required
                        />
                    </FormField>

                    <FormField label="New Password" required>
                        <Input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({
                                ...prev,
                                newPassword: e.target.value
                            }))}
                            placeholder={`Enter new password (min ${PASSWORD_MIN_LENGTH} characters)`}
                            required
                            minLength={PASSWORD_MIN_LENGTH}
                        />
                    </FormField>

                    <FormField label="Confirm New Password" required>
                        <Input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({
                                ...prev,
                                confirmPassword: e.target.value
                            }))}
                            placeholder="Confirm new password"
                            required
                        />
                    </FormField>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsPasswordModalOpen(false);
                                resetPasswordForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" loading={isLoading}>
                            Change Password
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Account Deletion Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    resetDeleteForm();
                }}
                title="Delete Account"
                size="md"
            >
                <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400"></i>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                                    This action cannot be undone
                                </h3>
                                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                                    <p className="mb-2">
                                        This will permanently delete your account and all associated data, including:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1">
                                        <li>All shortened URLs</li>
                                        <li>Analytics data</li>
                                        <li>Account preferences</li>
                                        <li>API keys</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleAccountDeletion} className="space-y-4">
                        <FormField
                            label={`Type "${DELETE_CONFIRMATION_TEXT}" to confirm`}
                            required
                            helperText="This confirmation is required to proceed with account deletion"
                        >
                            <Input
                                type="text"
                                value={deleteForm.confirmText}
                                onChange={(e) => setDeleteForm(prev => ({
                                    ...prev,
                                    confirmText: e.target.value
                                }))}
                                placeholder={`Type ${DELETE_CONFIRMATION_TEXT}`}
                                required
                            />
                        </FormField>

                        <FormField label="Enter your password" required>
                            <Input
                                type="password"
                                value={deleteForm.password}
                                onChange={(e) => setDeleteForm(prev => ({
                                    ...prev,
                                    password: e.target.value
                                }))}
                                placeholder="Enter your password"
                                required
                            />
                        </FormField>

                        <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    resetDeleteForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                loading={isLoading}
                            >
                                <i className="fas fa-trash-alt mr-2"></i>
                                Delete Account
                            </Button>
                        </div>
                    </form>
                </div>
            </Modal>
        </div>
    );
};

export default AccountSettings;