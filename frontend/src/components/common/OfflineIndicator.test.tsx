import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { OfflineIndicator } from './OfflineIndicator';

describe('OfflineIndicator', () => {
    let onlineGetter: any;

    beforeEach(() => {
        // Mock navigator.onLine
        onlineGetter = vi.spyOn(window.navigator, 'onLine', 'get');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not show indicator when online initially', () => {
        onlineGetter.mockReturnValue(true);
        const { container } = render(<OfflineIndicator />);
        expect(container.firstChild).toBeNull();
    });

    it('should show offline indicator when offline', () => {
        onlineGetter.mockReturnValue(false);
        render(<OfflineIndicator />);
        const offlineText = screen.getByText(/currently offline/i);
        expect(offlineText).toBeDefined();
    });

    it('should show back online message when connection restored', async () => {
        onlineGetter.mockReturnValue(true);
        render(<OfflineIndicator />);

        // Simulate going online
        await act(async () => {
            window.dispatchEvent(new Event('online'));
        });

        await waitFor(() => {
            const onlineText = screen.getByText(/back online/i);
            expect(onlineText).toBeDefined();
        });
    });

    it('should show offline message when connection lost', async () => {
        onlineGetter.mockReturnValue(true);
        render(<OfflineIndicator />);

        // Simulate going offline
        await act(async () => {
            onlineGetter.mockReturnValue(false);
            window.dispatchEvent(new Event('offline'));
        });

        await waitFor(() => {
            const offlineText = screen.getByText(/currently offline/i);
            expect(offlineText).toBeDefined();
        });
    });

    it('should render with correct accessibility attributes', () => {
        onlineGetter.mockReturnValue(false);
        render(<OfflineIndicator />);

        const alert = screen.getByRole('alert');
        expect(alert).toBeDefined();
        expect(alert.getAttribute('aria-live')).toBe('polite');
    });
});
