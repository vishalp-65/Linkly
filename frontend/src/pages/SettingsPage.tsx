import React, { useState, useMemo } from 'react';
import URLPreferencesComponent from '../components/settings/URLPreferences';
import NotificationSettingsComponent from '../components/settings/NotificationSettings';

type TabId = 'account' | 'preferences' | 'api' | 'notifications';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'preferences', label: 'URL Preferences', icon: '⚙️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('account');

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'account':
        return <AccountSettings />;
      case 'preferences':
        return <URLPreferences />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <AccountSettings />;
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 shrink-0">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              <nav className="p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-left text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-700 dark:text-blue-300 border-l-4 border-blue-700 dark:border-blue-500 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
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
          <div className="flex-1">{renderContent}</div>
        </div>
      </div>
    </div>
  );
};

const AccountSettings: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Account Settings
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Manage your account information and security settings.
      </p>
    </div>
  );
};

const URLPreferences: React.FC = () => {
  return <URLPreferencesComponent />;
};

const NotificationSettings: React.FC = () => {
  return <NotificationSettingsComponent />;
};

export default SettingsPage;