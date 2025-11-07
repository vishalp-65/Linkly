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
}

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-3xl'
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
            <div
                className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0"
                onClick={handleOverlayClick}
            >
                <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-lg transition-opacity" />

                <FocusTrap active={isOpen} className={"w-full items-center flex justify-center"}>
                    <div
                        ref={modalRef}
                        className={`relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full ${sizeClasses[size]}`}
                        tabIndex={-1}
                    >
                        <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                                    {title && (
                                        <h3
                                            className="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4"
                                            id="modal-title"
                                        >
                                            {title}
                                        </h3>
                                    )}
                                    <div className="mt-2">
                                        {children}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="absolute right-0 top-0 m-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1 cursor-pointer"
                            onClick={onClose}
                            aria-label="Close modal"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </FocusTrap>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default Modal;