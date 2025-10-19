import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { ToastProvider } from './contexts/ToastContext';
import AuthProvider from './components/AuthProvider';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import UserURLs from './pages/UserURLs';

function App() {
    return (
        <Provider store={store}>
            <AuthProvider>
                <ToastProvider position="top-right">
                    <Router>
                        <div className="App min-h-screen bg-gray-50">
                            <Navbar />
                            <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/dashboard" element={<DashboardPage />} />
                                <Route
                                    path="/analytics/:shortCode"
                                    element={
                                        <ProtectedRoute requireAuth={true}>
                                            <AnalyticsPage />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/settings"
                                    element={
                                        <ProtectedRoute requireAuth={true}>
                                            <SettingsPage />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/urls"
                                    element={
                                        <ProtectedRoute requireAuth={true}>
                                            <UserURLs />
                                        </ProtectedRoute>
                                    }
                                />
                            </Routes>
                        </div>
                    </Router>
                </ToastProvider>
            </AuthProvider>
        </Provider>
    );
}

export default App;