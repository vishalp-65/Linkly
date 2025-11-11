import { useState, useEffect } from 'react';

interface OfflineStatus {
    isOnline: boolean;
    isServingFromCache: boolean;
    lastCacheServedUrl: string | null;
}

/**
 * Hook to track online/offline status and cache serving status
 */
export const useOfflineStatus = (): OfflineStatus => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isServingFromCache, setIsServingFromCache] = useState(false);
    const [lastCacheServedUrl, setLastCacheServedUrl] = useState<string | null>(null);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setIsServingFromCache(false);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        const handleServingFromCache = (event: Event) => {
            const customEvent = event as CustomEvent;
            setIsServingFromCache(true);
            setLastCacheServedUrl(customEvent.detail?.url || null);

            // Reset after a short delay
            setTimeout(() => {
                setIsServingFromCache(false);
            }, 3000);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('sw-serving-from-cache', handleServingFromCache);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('sw-serving-from-cache', handleServingFromCache);
        };
    }, []);

    return {
        isOnline,
        isServingFromCache,
        lastCacheServedUrl,
    };
};
