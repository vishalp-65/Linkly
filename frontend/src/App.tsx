import React, { Suspense, useEffect } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { initializeStore, setupPersistence } from './store/persistence';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import RedirectHandler from './components/RedirectHandler';
import { LoadingFallback, SkipLink, OfflineIndicator } from './components/common';
import { ResourcePreloader } from './utils/preloader';
import { ServiceWorkerManager } from './utils/serviceWorker';
import { useKeyboardDetection } from './hooks/useKeyboardNavigation';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { Analytics } from "@vercel/analytics/react"

// Lazy load page components
const HomePage = React.lazy(() => import('./pages/HomePage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const UserURLs = React.lazy(() => import('./pages/UserURLs'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = React.lazy(
  () => import('./pages/ForgotPasswordPage')
);
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage'));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

// Initialize store with persisted data
initializeStore();
setupPersistence();

function App() {
  // Initialize keyboard detection for accessibility
  useKeyboardDetection();

  useEffect(() => {
    // Initialize critical resource preloading
    ResourcePreloader.preloadCriticalResources();

    // Register service worker only if caching is enabled
    const enableCache = import.meta.env.VITE_ENABLE_CACHE === 'true';

    if (enableCache) {
      const swManager = ServiceWorkerManager.getInstance();
      swManager.register();

      // Preload critical resources in service worker
      swManager.preloadCriticalResources([
        '/',
        '/dashboard',
        '/analytics',
        '/settings',
      ]);
    } else {
      // Unregister any existing service workers in development
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
            console.log('Service Worker unregistered for development');
          });
        });
      }
    }
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider position="top-right">
            <Router>
              <div className="App min-h-screen bg-slate-100 dark:bg-gray-900 transition-colors duration-200">
                <SkipLink href="#main-content">Skip to main content</SkipLink>
                <OfflineIndicator />
                <Suspense
                  fallback={
                    <LoadingFallback message="Loading application..." />
                  }
                >
                  <Routes>
                    {/* Public Routes */}
                    <Route
                      path="/"
                      element={
                        <>
                          <Navbar />
                          <Suspense
                            fallback={
                              <LoadingFallback message="Loading home page..." />
                            }
                          >
                            <HomePage />
                          </Suspense>
                        </>
                      }
                    />

                    {/* Authentication Routes */}
                    <Route
                      path="/login"
                      element={
                        <>
                          <Navbar />
                          <Suspense
                            fallback={
                              <LoadingFallback message="Loading login..." />
                            }
                          >
                            <LoginPage />
                          </Suspense>
                        </>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <>
                          <Navbar />
                          <Suspense
                            fallback={
                              <LoadingFallback message="Loading registration..." />
                            }
                          >
                            <RegisterPage />
                          </Suspense>
                        </>
                      }
                    />
                    <Route
                      path="/forgot-password"
                      element={
                        <>
                          <Navbar />
                          <Suspense
                            fallback={<LoadingFallback message="Loading..." />}
                          >
                            <ForgotPasswordPage />
                          </Suspense>
                        </>
                      }
                    />
                    <Route
                      path="/reset-password"
                      element={
                        <>
                          <Navbar />
                          <Suspense
                            fallback={<LoadingFallback message="Loading..." />}
                          >
                            <ResetPasswordPage />
                          </Suspense>
                        </>
                      }
                    />

                    {/* Protected Routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <>
                          <Navbar />
                          <ProtectedRoute requireAuth={true}>
                            <Suspense
                              fallback={
                                <LoadingFallback message="Loading dashboard..." />
                              }
                            >
                              <DashboardPage />
                            </Suspense>
                          </ProtectedRoute>
                        </>
                      }
                    />

                    <Route
                      path="/analytics"
                      element={
                        <>
                          <Navbar />
                          <ProtectedRoute requireAuth={true}>
                            <Suspense
                              fallback={
                                <LoadingFallback message="Loading analytics..." />
                              }
                            >
                              <AnalyticsPage />
                            </Suspense>
                          </ProtectedRoute>
                        </>
                      }
                    />

                    <Route
                      path="/analytics/:shortCode"
                      element={
                        <>
                          <Navbar />
                          <ProtectedRoute requireAuth={true}>
                            <Suspense
                              fallback={
                                <LoadingFallback message="Loading analytics..." />
                              }
                            >
                              <AnalyticsPage />
                            </Suspense>
                          </ProtectedRoute>
                        </>
                      }
                    />

                    <Route
                      path="/urls"
                      element={
                        <>
                          <Navbar />
                          <ProtectedRoute requireAuth={true}>
                            <Suspense
                              fallback={
                                <LoadingFallback message="Loading URLs..." />
                              }
                            >
                              <UserURLs />
                            </Suspense>
                          </ProtectedRoute>
                        </>
                      }
                    />

                    <Route
                      path="/settings"
                      element={
                        <>
                          <Navbar />
                          <ProtectedRoute requireAuth={true}>
                            <Suspense
                              fallback={
                                <LoadingFallback message="Loading settings..." />
                              }
                            >
                              <SettingsPage />
                            </Suspense>
                          </ProtectedRoute>
                        </>
                      }
                    />

                    {/* Short Code Redirect Route - Must be near the end */}
                    <Route path="/:shortCode" element={<RedirectHandler />} />

                    {/* 404 Route - Must be last */}
                    <Route
                      path="/404"
                      element={
                        <Suspense
                          fallback={<LoadingFallback message="Loading..." />}
                        >
                          <NotFoundPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="*"
                      element={
                        <Suspense
                          fallback={<LoadingFallback message="Loading..." />}
                        >
                          <NotFoundPage />
                        </Suspense>
                      }
                    />
                  </Routes>
                </Suspense>
              </div>
              <Analytics />
            </Router>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
