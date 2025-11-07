import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { api } from '../../../services/api';
import NotificationSettingsComponent from '../NotificationSettings';
import { ToastProvider } from '../../../contexts/ToastContext';

// Mock the API
const mockStore = configureStore({
    reducer: {
        [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
});

// Mock notification settings data
const mockNotificationSettings = {
    emailNotifications: {
        urlExpiring: true,
        urlExpired: true,
        highTraffic: false,
        weeklyReport: true,
        monthlyReport: false,
    },
    webhooks: {
        enabled: false,
        url: '',
        secret: '',
        events: {
            urlCreated: false,
            urlClicked: false,
            urlExpired: true,
            urlDeleted: false,
        },
    },
};

// Mock API responses
vi.mock('../../../services/api', () => ({
    ...vi.importActual('../../../services/api'),
    useGetNotificationSettingsQuery: () => ({
        data: { data: { notifications: mockNotificationSettings } },
        isLoading: false,
        error: null,
    }),
    useUpdateNotificationSettingsMutation: () => [
        vi.fn().mockResolvedValue({ unwrap: () => Promise.resolve() }),
        { isLoading: false },
    ],
    useTestWebhookMutation: () => [
        vi.fn().mockResolvedValue({
            unwrap: () => Promise.resolve({
                data: { success: true, responseTime: 150 }
            })
        }),
    ],
}));

const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <Provider store={mockStore}>
            <ToastProvider>
                {component}
            </ToastProvider>
        </Provider>
    );
};

describe('NotificationSettings', () => {
    test('renders notification settings sections', () => {
        renderWithProviders(<NotificationSettingsComponent />);

        expect(screen.getByText('Email Notifications')).toBeInTheDocument();
        expect(screen.getByText('Webhook Configuration')).toBeInTheDocument();
    });

    test('displays email notification toggles', () => {
        renderWithProviders(<NotificationSettingsComponent />);

        expect(screen.getByText('URL Expiring Soon')).toBeInTheDocument();
        expect(screen.getByText('URL Expired')).toBeInTheDocument();
        expect(screen.getByText('High Traffic Alerts')).toBeInTheDocument();
        expect(screen.getByText('Weekly Analytics Report')).toBeInTheDocument();
        expect(screen.getByText('Monthly Analytics Report')).toBeInTheDocument();
    });

    test('shows webhook configuration when enabled', async () => {
        renderWithProviders(<NotificationSettingsComponent />);

        const webhookToggle = screen.getByLabelText('Enable Webhooks');
        fireEvent.click(webhookToggle);

        await waitFor(() => {
            expect(screen.getByText('Webhook URL')).toBeInTheDocument();
            expect(screen.getByText('Webhook Secret (Optional)')).toBeInTheDocument();
            expect(screen.getByText('Test Webhook')).toBeInTheDocument();
        });
    });

    test('validates webhook URL format', async () => {
        renderWithProviders(<NotificationSettingsComponent />);

        const webhookToggle = screen.getByLabelText('Enable Webhooks');
        fireEvent.click(webhookToggle);

        await waitFor(() => {
            const urlInput = screen.getByPlaceholderText('https://your-app.com/webhooks/url-shortener');
            fireEvent.change(urlInput, { target: { value: 'invalid-url' } });

            expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
        });
    });

    test('enables save button when changes are made', async () => {
        renderWithProviders(<NotificationSettingsComponent />);

        const toggle = screen.getByLabelText('High Traffic Alerts');
        fireEvent.click(toggle);

        await waitFor(() => {
            const saveButton = screen.getByText('Save Notification Settings');
            expect(saveButton).not.toBeDisabled();
        });
    });
});