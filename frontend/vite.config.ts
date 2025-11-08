/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + '/frontend', '');
  const enableCache = env.VITE_ENABLE_CACHE === 'true';

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
    },
    server: {
      port: 5173,
      host: true,
      headers: !enableCache ? {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      } : undefined,
    },
    preview: {
      port: 4173,
      host: true,
      headers: !enableCache ? {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      } : undefined,
    },
    define: {
      // Ensure environment variables are available at build time
      __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    },
    build: {
      rollupOptions: {
        output: enableCache ? {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
            'charts-vendor': ['recharts'],
            'utils-vendor': ['date-fns', 'socket.io-client'],
          },
          // Optimize asset file names
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext || '')) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        } : {
          // No chunking in development - single bundle
          manualChunks: undefined,
          assetFileNames: 'assets/[name][extname]',
          chunkFileNames: 'assets/js/[name].js',
          entryFileNames: 'assets/js/[name].js',
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable asset compression
      assetsInlineLimit: enableCache ? 4096 : 0, // Don't inline in dev
      // Optimize CSS
      cssCodeSplit: enableCache,
      // Source maps for production debugging
      sourcemap: true,
    },
  };
});
