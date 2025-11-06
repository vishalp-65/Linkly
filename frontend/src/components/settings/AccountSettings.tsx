import React, { useState } from 'react';
import { Card, Button, Input, FormField, Modal } from '../common';
import { useToast } from '../../contexts/ToastContext';

interface UserAccount {
    id: string;
    email: string;
    createdAt: string;
    totalUrls: number;
    totalClicks: number;
    lastLogin: string;
}

const AccountSettings: React.FC = () => {
    const { showToast } = useToast();
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Mock user data - in real app, this would come from API
    const [userAccount] = useState<UserAccount>({
        id: '1',
        email: 'user@example.com',
        createdAt: '2024-01-15T10:30:00Z',
        totalUrls: 156,
        totalClicks: 12847,
        lastLogin: '2024-11-02T14:22:00Z'
    });

    const [emailForm, setEmailForm] = useState({
        newEmail: '',
        confirmEmail: '',
        currentPassword: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [deleteForm, setDeleteForm] = useState({
        confirmText: '',
        password: ''
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleEmailUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (emailForm.newEmail !== emailForm.confirmEmail) {
            showToast({ message: 'Email addresses do not match', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            showToast({ message: 'Email updated successfully', type: 'success' });
            setIsEmailModalOpen(false);
            setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' });
        } catch (error) {
            showToast({ message: 'Failed to update email', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast({ message: 'Passwords do not match', type: 'error' });
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            showToast({ message: 'Password must be at least 8 characters long', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            showToast({ message: 'Password changed successfully', type: 'success' });
            setIsPasswordModalOpen(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            showToast({ message: 'Failed to change password', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccountDeletion = async (e: React.FormEvent) => {
        e.preventDefault();

        if (deleteForm.confirmText !== 'DELETE') {
            showToast({ message: 'Please type DELETE to confirm', type: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            // API call would go here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            showToast({ message: 'Account deletion initiated', type: 'success' });
            setIsDeleteModalOpen(false);
            // In real app, would redirect to login or goodbye page
        } catch (error) {
            showToast({ message: 'Failed to delete account', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Account Information */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Information</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-900">{userAccount.email}</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsEmailModalOpen(true)}
                                >
                                    Change Email
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-900">••••••••</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setIsPasswordModalOpen(true)}
                                >
                                    Change Password
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Created
                            </label>
                            <span className="text-gray-900">{formatDate(userAccount.createdAt)}</span>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Last Login
                            </label>
                            <span className="text-gray-900">{formatDate(userAccount.lastLogin)}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Account Statistics */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Statistics</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-3xl font-bold text-blue-600">{userAccount.totalUrls.toLocaleString()}</div>
                            <div className="text-sm text-blue-800 mt-1">Total URLs Created</div>
                        </div>

                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-3xl font-bold text-green-600">{userAccount.totalClicks.toLocaleString()}</div>
                            <div className="text-sm text-green-800 mt-1">Total Clicks</div>
                        </div>

                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-3xl font-bold text-purple-600">
                                {userAccount.totalUrls > 0 ? Math.round(userAccount.totalClicks / userAccount.totalUrls) : 0}
                            </div>
                            <div className="text-sm text-purple-800 mt-1">Average Clicks per URL</div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Danger Zone */}
            <Card>
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-red-600 mb-4">Danger Zone</h2>
                    <p className="text-gray-600 mb-4">
                        Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button
                        variant="danger"
                        onClick={() => setIsDeleteModalOpen(true)}
                    >
                        Delete Account
                    </Button>
                </div>
            </Card>

            {/* Email Update Modal */}
            <Modal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                title="Change Email Address"
                size="md"
            >
                <form onSubmit={handleEmailUpdate} className="space-y-4">
                    <FormField label="New Email Address" required>
                        <Input
                            type="email"
                            value={emailForm.newEmail}
                            onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                            placeholder="Enter new email address"
                            required
                        />
                    </FormField>

                    <FormField label="Confirm New Email" required>
                        <Input
                            type="email"
                            value={emailForm.confirmEmail}
                            onChange={(e) => setEmailForm(prev => ({ ...prev, confirmEmail: e.target.value }))}
                            placeholder="Confirm new email address"
                            required
                        />
                    </FormField>

                    <FormField label="Current Password" required>
                        <Input
                            type="password"
                            value={emailForm.currentPassword}
                            onChange={(e) => setEmailForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            placeholder="Enter current password"
                            required
                        />
                    </FormField>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEmailModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={isLoading}
                        >
                            Update Email
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Password Change Modal */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                title="Change Password"
                size="md"
            >
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <FormField label="Current Password" required>
                        <Input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                            placeholder="Enter current password"
                            required
                        />
                    </FormField>

                    <FormField label="New Password" required>
                        <Input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                            placeholder="Enter new password (min 8 characters)"
                            required
                            minLength={8}
                        />
                    </FormField>

                    <FormField label="Confirm New Password" required>
                        <Input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                            placeholder="Confirm new password"
                            required
                        />
                    </FormField>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsPasswordModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            loading={isLoading}
                        >
                            Change Password
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Account Deletion Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Account"
                size="md"
            >
                <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    This action cannot be undone
                                </h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>
                                        This will permanently delete your account and all associated data, including:
                                    </p>
                                    <ul className="list-disc list-inside mt-2">
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
                            label="Type DELETE to confirm"
                            required
                            helperText="This confirmation is required to proceed with account deletion"
                        >
                            <Input
                                type="text"
                                value={deleteForm.confirmText}
                                onChange={(e) => setDeleteForm(prev => ({ ...prev, confirmText: e.target.value }))}
                                placeholder="Type DELETE"
                                required
                            />
                        </FormField>

                        <FormField label="Enter your password" required>
                            <Input
                                type="password"
                                value={deleteForm.password}
                                onChange={(e) => setDeleteForm(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="Enter your password"
                                required
                            />
                        </FormField>

                        <div className="flex justify-end space-x-3 pt-4">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsDeleteModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="danger"
                                loading={isLoading}
                            >
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