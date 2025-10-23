import { useEffect, useCallback, useRef } from 'react';
import { trapFocus, handleArrowNavigation } from '../utils/keyboard';

interface UseKeyboardNavigationOptions {
    trapFocus?: boolean;
    handleEscape?: () => void;
    handleArrowKeys?: boolean;
    items?: HTMLElement[];
    onIndexChange?: (index: number) => void;
}

/**
 * Hook for managing keyboard navigation within a component
 */
export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
    const containerRef = useRef<HTMLElement>(null);
    const currentIndexRef = useRef(0);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        const { trapFocus: shouldTrapFocus, handleEscape: onEscape, handleArrowKeys, items, onIndexChange } = options;

        // Handle escape key
        if (onEscape && event.key === 'Escape') {
            onEscape();
            return;
        }

        // Handle focus trapping
        if (shouldTrapFocus && containerRef.current && event.key === 'Tab') {
            trapFocus(containerRef.current, event);
            return;
        }

        // Handle arrow key navigation
        if (handleArrowKeys && items && onIndexChange) {
            handleArrowNavigation(event, items, currentIndexRef.current, (newIndex) => {
                currentIndexRef.current = newIndex;
                onIndexChange(newIndex);
            });
        }
    }, [options]);

    useEffect(() => {
        if (options.trapFocus || options.handleEscape || options.handleArrowKeys) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown, options.trapFocus, options.handleEscape, options.handleArrowKeys]);

    return {
        containerRef,
        setCurrentIndex: (index: number) => {
            currentIndexRef.current = index;
        },
        getCurrentIndex: () => currentIndexRef.current,
    };
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore(isOpen: boolean) {
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Save current focus
            previousFocusRef.current = document.activeElement as HTMLElement;
        } else {
            // Restore focus when closing
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
                previousFocusRef.current = null;
            }
        }
    }, [isOpen]);

    return {
        restoreFocus: () => {
            if (previousFocusRef.current) {
                previousFocusRef.current.focus();
                previousFocusRef.current = null;
            }
        }
    };
}

/**
 * Hook for detecting keyboard navigation mode
 */
export function useKeyboardDetection() {
    const isKeyboardUserRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Tab') {
                isKeyboardUserRef.current = true;
                document.body.classList.add('keyboard-navigation');
            }
        };

        const handleMouseDown = () => {
            isKeyboardUserRef.current = false;
            document.body.classList.remove('keyboard-navigation');
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleMouseDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    return {
        isKeyboardUser: () => isKeyboardUserRef.current
    };
}