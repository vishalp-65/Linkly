import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useKeyboardNavigation, useFocusRestore } from '../../hooks/useKeyboardNavigation';
import { getFocusableElements } from '../../utils/keyboard';
import FocusTrap from './FocusTrap';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnOverlayClick?: boolean;
    closeOnEscape?: boolean;
    className?: string;
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true,
    className,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    const sizeClasses = {
        sm: 'max-w-sm sm:max-w-md',
        md: 'max-w-md sm:max-w-lg',
        lg: 'max-w-lg sm:max-w-2xl',
        xl: 'max-w-xl sm:max-w-4xl'
    };

    // Use keyboard navigation hook for focus trapping and escape handling
    const { containerRef } = useKeyboardNavigation({
        trapFocus: isOpen,
        handleEscape: closeOnEscape ? onClose : undefined,
    });

    // Use focus restore hook
    useFocusRestore(isOpen);

    useEffect(() => {
        if (isOpen) {
            // Focus the modal and prevent body scroll
            setTimeout(() => {
                const focusableElements = modalRef.current ? getFocusableElements(modalRef.current) : [];
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                } else {
                    modalRef.current?.focus();
                }
            }, 0);

            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const handleOverlayClick = (event: React.MouseEvent) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
            onClose();
        }
    };

    // Combine refs for keyboard navigation
    useEffect(() => {
        if (modalRef.current && containerRef) {
            (containerRef as React.MutableRefObject<HTMLElement | null>).current = modalRef.current;
        }
    }, [containerRef]);

    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-labelledby={title ? 'modal-title' : undefined}
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop with animation */}
            <div
                className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 dark:from-black/80 dark:via-black/70 dark:to-black/80 backdrop-blur-sm transition-all duration-300 ease-out"
                onClick={handleOverlayClick}
                aria-hidden="true"
            />

            <div
                className={`flex min-h-full items-center justify-center p-3 sm:p-4 md:p-6 ${className || ''}`}
                onClick={handleOverlayClick}
            >
                <FocusTrap active={isOpen} className="w-full flex items-center justify-center">
                    <div
                        ref={modalRef}
                        className={`relative w-full ${sizeClasses[size]} transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left shadow-2xl dark:shadow-gray-900/50 transition-all duration-300 ease-out border border-gray-200 dark:border-gray-700 animate-modal-scale`}
                        tabIndex={-1}
                    >
                        {/* Header */}
                        {title && (
                            <div className="relative bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-200 dark:border-gray-700">
                                <h3
                                    className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 pr-10"
                                    id="modal-title"
                                >
                                    {title}
                                </h3>
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                            </div>
                        )}

                        {/* Close button */}
                        <button
                            type="button"
                            className={`absolute ${title ? 'top-4 sm:top-5' : 'top-3 sm:top-4'} right-4 sm:right-5 z-10 group inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm hover:shadow-md active:scale-95 cursor-pointer`}
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <svg
                                className="h-4 w-4 sm:h-6 sm:w-6 transition-transform group-hover:rotate-90 duration-200"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth="2"
                                stroke="currentColor"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Content */}
                        <div className={`px-5 sm:px-6 ${title ? 'py-5 sm:py-6' : 'pt-12 sm:pt-14 pb-5 sm:pb-6'}`}>
                            {children}
                        </div>
                    </div>
                </FocusTrap>
            </div>

            {/* Inline styles for animation */}
            <style>{`
                @keyframes modal-scale {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .animate-modal-scale {
                    animation: modal-scale 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;