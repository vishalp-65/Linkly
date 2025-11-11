import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/common/Toast';
import type { ToastProps, ToastPosition } from '../components/common/Toast';

interface ToastContextType {
    showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
    removeToast: (id: string) => void;
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
    clearAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * useToast Hook
 * Provides toast notification functionality
 * Implements requirements 1.4 and 2.3 for user feedback
 */
export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: React.ReactNode;
    position?: ToastPosition;
    maxToasts?: number;
}

/**
 * Toast Provider Component
 * Manages toast notifications with support for multiple simultaneous toasts
 * Implements requirement 2.3 for toast notification system
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    position = 'top-right',
    maxToasts = 5
}) => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const showToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: ToastProps = {
            ...toast,
            id,
            onClose: removeToast
        };

        setToasts(prev => {
            // Limit number of simultaneous toasts
            const updatedToasts = [...prev, newToast];
            if (updatedToasts.length > maxToasts) {
                // Remove oldest toast
                return updatedToasts.slice(1);
            }
            return updatedToasts;
        });
    }, [maxToasts]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    // Convenience methods for different toast types
    const success = useCallback((message: string, title?: string, duration = 3000) => {
        showToast({
            type: 'success',
            title: title || 'Success',
            message,
            duration
        });
    }, [showToast]);

    const error = useCallback((message: string, title?: string, duration = 5000) => {
        showToast({
            type: 'error',
            title: title || 'Error',
            message,
            duration
        });
    }, [showToast]);

    const warning = useCallback((message: string, title?: string, duration = 4000) => {
        showToast({
            type: 'warning',
            title: title || 'Warning',
            message,
            duration
        });
    }, [showToast]);

    const info = useCallback((message: string, title?: string, duration = 3000) => {
        showToast({
            type: 'info',
            title: title || 'Info',
            message,
            duration
        });
    }, [showToast]);

    const clearAll = useCallback(() => {
        setToasts([]);
    }, []);

    const value = {
        showToast,
        removeToast,
        success,
        error,
        warning,
        info,
        clearAll
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer
                toasts={toasts}
                onRemove={removeToast}
                position={position}
            />
        </ToastContext.Provider>
    );
};