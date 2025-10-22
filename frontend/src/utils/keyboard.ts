/**
 * Keyboard navigation utilities for accessibility
 */

export const FOCUSABLE_ELEMENTS = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
].join(', ');

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll(FOCUSABLE_ELEMENTS)) as HTMLElement[];
}

/**
 * Trap focus within a container (useful for modals)
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements(container);
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
}

/**
 * Handle escape key to close modals/dropdowns
 */
export function handleEscape(event: KeyboardEvent, callback: () => void): void {
    if (event.key === 'Escape') {
        callback();
    }
}

/**
 * Handle arrow key navigation for lists/menus
 */
export function handleArrowNavigation(
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onIndexChange: (index: number) => void
): void {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();

    let newIndex = currentIndex;

    switch (event.key) {
        case 'ArrowUp':
            newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            break;
        case 'ArrowDown':
            newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            break;
        case 'Home':
            newIndex = 0;
            break;
        case 'End':
            newIndex = items.length - 1;
            break;
    }

    onIndexChange(newIndex);
    items[newIndex]?.focus();
}

/**
 * Create a roving tabindex for a group of elements
 */
export function createRovingTabindex(elements: HTMLElement[], activeIndex: number = 0): void {
    elements.forEach((element, index) => {
        element.tabIndex = index === activeIndex ? 0 : -1;
    });
}

/**
 * Skip to main content functionality
 */
export function skipToMainContent(): void {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView();
    }
}

/**
 * Announce content to screen readers
 */
export function announceToScreenReader(message: string): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Focus management for single page applications
 */
export class FocusManager {
    private focusHistory: HTMLElement[] = [];

    /**
     * Save current focus and move to new element
     */
    saveFocusAndMoveTo(element: HTMLElement): void {
        const currentFocus = document.activeElement as HTMLElement;
        if (currentFocus && currentFocus !== document.body) {
            this.focusHistory.push(currentFocus);
        }
        element.focus();
    }

    /**
     * Restore previous focus
     */
    restoreFocus(): void {
        const previousFocus = this.focusHistory.pop();
        if (previousFocus) {
            previousFocus.focus();
        }
    }

    /**
     * Clear focus history
     */
    clearHistory(): void {
        this.focusHistory = [];
    }
}

export const focusManager = new FocusManager();