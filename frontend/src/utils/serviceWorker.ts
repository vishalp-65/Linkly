// Service Worker registration and management
export class ServiceWorkerManager {
    private static instance: ServiceWorkerManager;
    private registration: ServiceWorkerRegistration | null = null;

    static getInstance(): ServiceWorkerManager {
        if (!ServiceWorkerManager.instance) {
            ServiceWorkerManager.instance = new ServiceWorkerManager();
        }
        return ServiceWorkerManager.instance;
    }

    // Register service worker
    async register(): Promise<void> {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            console.log('Service Worker not supported');
            return;
        }

        try {
            this.registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            // console.log('Service Worker registered successfully:', this.registration);

            // Handle updates
            this.registration.addEventListener('updatefound', () => {
                const newWorker = this.registration?.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New content is available, notify user
                            this.notifyUpdate();
                        }
                    });
                }
            });

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleMessage(event.data);
            });

        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    // Unregister service worker
    async unregister(): Promise<void> {
        if (this.registration) {
            await this.registration.unregister();
            this.registration = null;
            console.log('Service Worker unregistered');
        }
    }

    // Update service worker
    async update(): Promise<void> {
        if (this.registration) {
            await this.registration.update();
            console.log('Service Worker update triggered');
        }
    }

    // Skip waiting and activate new service worker
    async skipWaiting(): Promise<void> {
        if (this.registration?.waiting) {
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    }

    // Check if app is running offline
    isOffline(): boolean {
        return !navigator.onLine;
    }

    // Preload critical resources
    async preloadCriticalResources(urls: string[]): Promise<void> {
        if (!this.registration) return;

        try {
            const cache = await caches.open('linkly-critical-v1');
            await cache.addAll(urls);
            console.log('Critical resources preloaded');
        } catch (error) {
            console.error('Failed to preload critical resources:', error);
        }
    }

    // Clear all caches
    async clearCaches(): Promise<void> {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
            console.log('All caches cleared');
        } catch (error) {
            console.error('Failed to clear caches:', error);
        }
    }

    // Get cache usage
    async getCacheUsage(): Promise<{ used: number; quota: number }> {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                quota: estimate.quota || 0,
            };
        }
        return { used: 0, quota: 0 };
    }

    private notifyUpdate(): void {
        // Dispatch custom event for app to handle
        window.dispatchEvent(new CustomEvent('sw-update-available'));
    }

    private handleMessage(data: any): void {
        switch (data.type) {
            case 'CACHE_UPDATED':
                console.log('Cache updated:', data.url);
                break;
            case 'OFFLINE_READY':
                console.log('App ready for offline use');
                // Dispatch event for UI components
                window.dispatchEvent(new CustomEvent('sw-offline-ready'));
                break;
            case 'NETWORK_ONLINE':
                console.log('Network request succeeded:', data.url);
                break;
            case 'SERVING_FROM_CACHE':
                console.log('Serving from cache (offline):', data.url);
                // Dispatch event to notify UI that we're offline
                window.dispatchEvent(new CustomEvent('sw-serving-from-cache', {
                    detail: { url: data.url }
                }));
                break;
            case 'SYNC_COMPLETE':
                console.log(`Background sync complete: ${data.successCount}/${data.totalCount} succeeded`);
                // Dispatch event for UI notification
                window.dispatchEvent(new CustomEvent('sw-sync-complete', {
                    detail: {
                        successCount: data.successCount,
                        totalCount: data.totalCount,
                        remainingCount: data.remainingCount
                    }
                }));
                break;
            default:
                console.log('Unknown message from service worker:', data);
        }
    }

    // Request background sync manually
    async requestBackgroundSync(): Promise<void> {
        if (this.registration && 'sync' in this.registration) {
            try {
                // @ts-ignore - sync API is not fully typed in TypeScript
                await this.registration.sync.register('sync-failed-requests');
                console.log('Background sync requested');
            } catch (error) {
                console.error('Failed to request background sync:', error);
            }
        } else {
            console.warn('Background sync not supported');
        }
    }

    // Check if background sync is supported
    isBackgroundSyncSupported(): boolean {
        return 'sync' in ServiceWorkerRegistration.prototype;
    }
}

// Hook for using service worker in React components
export const useServiceWorker = () => {
    const sw = ServiceWorkerManager.getInstance();

    const register = () => sw.register();
    const unregister = () => sw.unregister();
    const update = () => sw.update();
    const skipWaiting = () => sw.skipWaiting();
    const isOffline = () => sw.isOffline();
    const clearCaches = () => sw.clearCaches();
    const getCacheUsage = () => sw.getCacheUsage();
    const requestBackgroundSync = () => sw.requestBackgroundSync();
    const isBackgroundSyncSupported = () => sw.isBackgroundSyncSupported();

    return {
        register,
        unregister,
        update,
        skipWaiting,
        isOffline,
        clearCaches,
        getCacheUsage,
        requestBackgroundSync,
        isBackgroundSyncSupported,
    };
};