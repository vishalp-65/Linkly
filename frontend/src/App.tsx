import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { ToastProvider } from './contexts/ToastContext';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';

function App() {
    return (
        <Provider store={store}>
            <ToastProvider position="top-right">
                <Router>
                    <div className="App min-h-screen bg-gray-50">
                        <Navbar />
                        <Routes>
                            <Route path="/" element={<DashboardPage />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/analytics/:shortCode" element={<AnalyticsPage />} />
                        </Routes>
                    </div>
                </Router>
            </ToastProvider>
        </Provider>
    );
}

export default App;