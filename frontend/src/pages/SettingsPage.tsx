import React, { useState, useMemo } from 'react';

interface SettingsPageProps { }

type TabId = 'account' | 'preferences' | 'api' | 'notifications';

interface Tab {
    id: TabId;
    label: string;
    icon: string;
}

const tabs: Tab[] = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'preferences', label: 'URL Preferences', icon: '⚙️' },
    { id: 'api', label: 'API Settings', icon: '🔑' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

const SettingsPage: React.FC<SettingsPageProps> = () => {
    const [activeTab, setActiveTab] = useState<TabId>('account');

    const renderContent = useMemo(() => {
        switch (activeTab) {
            case 'account':
                return <AccountSettings />;
            case 'preferences':
                return <URLPreferences />;
            case 'api':
                return <APISettings />;
            case 'notifications':
                return <NotificationSettings />;
            default:
                return <AccountSettings />;
        }
    }, [activeTab]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-100 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="mt-2 text-gray-600">
                        Manage your account settings and preferences
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <div className="lg:w-64 shrink-0">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                            <nav className="p-2">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.id
                                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-700 shadow-sm'
                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        <span className="mr-3 text-lg">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1">
                        {renderContent}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Placeholder components - replace with your actual components
const AccountSettings: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Settings</h2>
            <p className="text-gray-600">Manage your account information and security settings.</p>
            {/* Add your account settings form here */}
        </div>
    );
};

const URLPreferences: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">URL Preferences</h2>
            <p className="text-gray-600">Configure default settings for URL shortening.</p>
            {/* Add your URL preferences form here */}
        </div>
    );
};

const APISettings: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">API Settings</h2>
            <p className="text-gray-600">Manage your API keys and integration settings.</p>
            {/* Add your API settings content here */}
        </div>
    );
};

const NotificationSettings: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notification Settings</h2>
            <p className="text-gray-600">Control how and when you receive notifications.</p>
            {/* Add your notification settings form here */}
        </div>
    );
};

export default SettingsPage;