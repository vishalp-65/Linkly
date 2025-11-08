/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd() + '/frontend', '');
  const enableCache = env.VITE_ENABLE_CACHE === 'true';
  const isProduction = mode === 'production';

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
      // Output directory
      outDir: 'dist',
      // Enable minification in production
      minify: isProduction ? 'esbuild' : false,
      // Generate source maps for debugging (hidden in production)
      sourcemap: isProduction ? 'hidden' : true,
      // Target modern browsers for better optimization
      target: 'es2020',
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      // Enable asset compression
      assetsInlineLimit: enableCache ? 4096 : 0,
      // Optimize CSS
      cssCodeSplit: enableCache,
      // CSS minification
      cssMinify: isProduction,
      rollupOptions: {
        output: enableCache ? {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'redux-vendor': ['@reduxjs/toolkit', 'react-redux'],
            'charts-vendor': ['recharts'],
            'utils-vendor': ['date-fns', 'socket.io-client'],
          },
          // Optimize asset file names with content hashing
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
        // Tree-shaking optimization
        treeshake: isProduction ? {
          moduleSideEffects: 'no-external',
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
        } : false,
      },
    },
  };
});
