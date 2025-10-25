import React, { useEffect, useRef } from 'react';
import { getFocusableElements } from '../../utils/keyboard';

interface FocusTrapProps {
    children: React.ReactNode;
    active: boolean;
    restoreFocus?: boolean;
    className?: string;
}

/**
 * Component that traps focus within its children when active
 */
const FocusTrap: React.FC<FocusTrapProps> = ({
    children,
    active,
    restoreFocus = true,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;

        // Store the previously focused element
        if (restoreFocus) {
            previousFocusRef.current = document.activeElement as HTMLElement;
        }

        // Focus the first focusable element in the trap
        const focusableElements = containerRef.current ? getFocusableElements(containerRef.current) : [];
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || !containerRef.current) return;

            const focusableElements = getFocusableElements(containerRef.current);
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);

            // Restore focus when the trap is deactivated
            if (restoreFocus && previousFocusRef.current) {
                previousFocusRef.current.focus();
            }
        };
    }, [active, restoreFocus]);

    return (
        <div ref={containerRef} className={className}>
            {children}
        </div>
    );
};

export default FocusTrap;