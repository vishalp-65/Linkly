/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  define: {
    // Ensure environment variables are available at build time
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  build: {
    rollupOptions: {
      output: {
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
      },
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable asset compression
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // Optimize CSS
    cssCodeSplit: true,
    // Source maps for production debugging
    sourcemap: true,
  },
});
