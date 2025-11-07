import { useState, useEffect, useCallback, useRef } from 'react';

// Custom hook for debouncing values
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Custom hook for debouncing callbacks
export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): T {
    const debounceTimer = useRef<number | null>(null);

    const debouncedCallback = useCallback(
        (...args: Parameters<T>) => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }

            debounceTimer.current = setTimeout(() => {
                callback(...args);
                debounceTimer.current = null;
            }, delay);
        },
        [callback, delay]
    ) as T;

    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, []);

    return debouncedCallback;
}