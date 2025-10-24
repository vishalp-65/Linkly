import React, { useState, useCallback, useMemo } from 'react';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import Input from './Input';

interface SearchInputProps {
    placeholder?: string;
    onSearch: (value: string) => void;
    debounceMs?: number;
    className?: string;
    initialValue?: string;
}

const SearchInput: React.FC<SearchInputProps> = React.memo(({
    placeholder = 'Search...',
    onSearch,
    debounceMs = 300,
    className = '',
    initialValue = '',
}) => {
    const [value, setValue] = useState(initialValue);

    // Debounced search callback
    const debouncedSearch = useDebouncedCallback(onSearch, debounceMs);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        debouncedSearch(newValue);
    }, [debouncedSearch]);

    const handleClear = useCallback(() => {
        setValue('');
        onSearch('');
    }, [onSearch]);

    // Memoize the search icon
    const searchIcon = useMemo(() => (
        <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
        </svg>
    ), []);

    // Memoize the clear button
    const clearButton = useMemo(() =>
        value ? (
            <button
                onClick={handleClear}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                type="button"
                aria-label="Clear search"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        ) : null,
        [value, handleClear]
    );

    return (
        <Input
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            leftIcon={searchIcon}
            rightIcon={clearButton}
            className={className}
        />
    );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;