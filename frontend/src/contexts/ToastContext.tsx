import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer } from '../components/common/Toast';
import type { ToastProps } from '../components/common/Toast';

interface ToastContextType {
    showToast: (toast: Omit<ToastProps, 'id' | 'onClose'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: React.ReactNode;
    position?: ToastProps['position'];
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
    children,
    position = 'top-right'
}) => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const showToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast: ToastProps = {
            ...toast,
            id,
            onClose: removeToast
        };
        setToasts(prev => [...prev, newToast]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const value = {
        showToast,
        removeToast
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