// Preloader utility for critical resources
export class ResourcePreloader {
    private static preloadedRoutes = new Set<string>();
    private static preloadedComponents = new Map<string, Promise<any>>();

    // Preload route components on hover or focus
    static preloadRoute(routeName: string): Promise<any> | null {
        if (this.preloadedRoutes.has(routeName)) {
            return this.preloadedComponents.get(routeName) || null;
        }

        let importPromise: Promise<any> | null = null;

        switch (routeName) {
            case 'dashboard':
                importPromise = import('../pages/DashboardPage');
                break;
            case 'analytics':
                importPromise = import('../pages/AnalyticsPage');
                break;
            case 'settings':
                importPromise = import('../pages/SettingsPage');
                break;
            case 'urls':
                importPromise = import('../pages/UserURLs');
                break;
            case 'login':
                importPromise = import('../pages/LoginPage');
                break;
            case 'register':
                importPromise = import('../pages/RegisterPage');
                break;
            default:
                return null;
        }

        if (importPromise) {
            this.preloadedRoutes.add(routeName);
            this.preloadedComponents.set(routeName, importPromise);

            // Handle preload errors gracefully
            importPromise.catch((error) => {
                console.warn(`Failed to preload route ${routeName}:`, error);
                this.preloadedRoutes.delete(routeName);
                this.preloadedComponents.delete(routeName);
            });
        }

        return importPromise;
    }

    // Preload critical resources on app initialization
    static preloadCriticalResources(): void {
        // Preload the most likely next pages for logged-in users
        if (typeof window !== 'undefined') {
            // Use requestIdleCallback if available, otherwise setTimeout
            const schedulePreload = (callback: () => void) => {
                if ('requestIdleCallback' in window) {
                    (window as any).requestIdleCallback(callback, { timeout: 2000 });
                } else {
                    setTimeout(callback, 100);
                }
            };

            schedulePreload(() => {
                // Preload dashboard for authenticated users
                this.preloadRoute('dashboard');
            });

            schedulePreload(() => {
                // Preload login for unauthenticated users
                this.preloadRoute('login');
            });
        }
    }

    // Preload images with lazy loading
    static preloadImage(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = src;
        });
    }

    // Preload fonts
    static preloadFont(fontUrl: string, fontFamily: string): void {
        if (typeof window !== 'undefined' && 'FontFace' in window) {
            const font = new FontFace(fontFamily, `url(${fontUrl})`);
            font.load().then((loadedFont) => {
                (document as any).fonts.add(loadedFont);
            }).catch((error) => {
                console.warn(`Failed to preload font ${fontFamily}:`, error);
            });
        }
    }

    // Preload CSS files
    static preloadCSS(href: string): void {
        if (typeof window !== 'undefined') {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = href;
            link.onload = () => {
                link.rel = 'stylesheet';
            };
            document.head.appendChild(link);
        }
    }

    // Preload JavaScript modules
    static preloadScript(src: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined') {
                resolve();
                return;
            }

            const link = document.createElement('link');
            link.rel = 'modulepreload';
            link.href = src;
            link.onload = () => resolve();
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    // Optimize images by converting to WebP format
    static async convertToWebP(imageUrl: string): Promise<string> {
        if (typeof window === 'undefined' || !('createImageBitmap' in window)) {
            return imageUrl;
        }

        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return imageUrl;

            canvas.width = imageBitmap.width;
            canvas.height = imageBitmap.height;
            ctx.drawImage(imageBitmap, 0, 0);

            return new Promise((resolve) => {
                canvas.toBlob((webpBlob) => {
                    if (webpBlob) {
                        resolve(URL.createObjectURL(webpBlob));
                    } else {
                        resolve(imageUrl);
                    }
                }, 'image/webp', 0.8);
            });
        } catch (error) {
            console.warn('Failed to convert image to WebP:', error);
            return imageUrl;
        }
    }

    // Compress images for better performance
    static async compressImage(file: File, quality: number = 0.8): Promise<File> {
        if (typeof window === 'undefined' || !('createImageBitmap' in window)) {
            return file;
        }

        try {
            const imageBitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) return file;

            // Calculate new dimensions (max 1920px width)
            const maxWidth = 1920;
            const scale = Math.min(1, maxWidth / imageBitmap.width);

            canvas.width = imageBitmap.width * scale;
            canvas.height = imageBitmap.height * scale;

            ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

            return new Promise((resolve) => {
                canvas.toBlob((compressedBlob) => {
                    if (compressedBlob) {
                        const compressedFile = new File([compressedBlob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    } else {
                        resolve(file);
                    }
                }, 'image/jpeg', quality);
            });
        } catch (error) {
            console.warn('Failed to compress image:', error);
            return file;
        }
    }
}

// Hook for preloading routes on hover/focus
export const useRoutePreloader = () => {
    const preloadOnHover = (routeName: string) => ({
        onMouseEnter: () => ResourcePreloader.preloadRoute(routeName),
        onFocus: () => ResourcePreloader.preloadRoute(routeName),
    });

    return { preloadOnHover };
};