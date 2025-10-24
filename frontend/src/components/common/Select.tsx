import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps {
    options: SelectOption[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    error?: boolean;
    className?: string;
    id?: string;
    name?: string;
}

const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select an option',
    disabled = false,
    error = false,
    className = '',
    id,
    name,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const selectRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedOption = options.find(option => option.value === value);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const scrollToOption = useCallback((index: number) => {
        const listElement = listRef.current;
        const optionElement = listElement?.children[index] as HTMLElement;

        if (optionElement && listElement) {
            const listRect = listElement.getBoundingClientRect();
            const optionRect = optionElement.getBoundingClientRect();

            if (optionRect.bottom > listRect.bottom) {
                optionElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
            } else if (optionRect.top < listRect.top) {
                optionElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
            }
        }
    }, []);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (disabled) return;

        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen && focusedIndex >= 0) {
                    const option = options[focusedIndex];
                    if (!option.disabled) {
                        onChange(option.value);
                        setIsOpen(false);
                        setFocusedIndex(-1);
                    }
                } else {
                    setIsOpen(true);
                }
                break;

            case 'Escape':
                setIsOpen(false);
                setFocusedIndex(-1);
                break;

            case 'ArrowDown':
                event.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                } else {
                    const nextIndex = Math.min(focusedIndex + 1, options.length - 1);
                    setFocusedIndex(nextIndex);
                    scrollToOption(nextIndex);
                }
                break;

            case 'ArrowUp':
                event.preventDefault();
                if (isOpen) {
                    const prevIndex = Math.max(focusedIndex - 1, 0);
                    setFocusedIndex(prevIndex);
                    scrollToOption(prevIndex);
                }
                break;

            case 'Home':
                event.preventDefault();
                if (isOpen) {
                    setFocusedIndex(0);
                    scrollToOption(0);
                }
                break;

            case 'End':
                event.preventDefault();
                if (isOpen) {
                    const lastIndex = options.length - 1;
                    setFocusedIndex(lastIndex);
                    scrollToOption(lastIndex);
                }
                break;
        }
    }, [disabled, isOpen, focusedIndex, options, onChange, scrollToOption]);

    const handleOptionClick = useCallback((option: SelectOption) => {
        if (!option.disabled) {
            onChange(option.value);
            setIsOpen(false);
            setFocusedIndex(-1);
        }
    }, [onChange]);

    const toggleDropdown = useCallback(() => {
        if (!disabled) {
            setIsOpen(prev => !prev);
        }
    }, [disabled]);

    const baseClasses = 'relative w-full cursor-default rounded-md border-0 py-1.5 pl-3 pr-10 text-left shadow-sm ring-1 ring-inset focus:outline-none focus:ring-2 sm:text-sm sm:leading-6 transition-all';

    const stateClasses = error
        ? 'ring-red-300 focus:ring-red-500 dark:ring-red-600 dark:focus:ring-red-400'
        : 'ring-gray-300 focus:ring-blue-600 dark:ring-gray-600 dark:focus:ring-blue-400';

    const disabledClasses = disabled
        ? 'cursor-not-allowed bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
        : 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100';

    const buttonClasses = `${baseClasses} ${stateClasses} ${disabledClasses} ${className}`;

    return (
        <div className="relative" ref={selectRef}>
            <button
                type="button"
                className={buttonClasses}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-labelledby={id}
                disabled={disabled}
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
                id={id}
                name={name}
            >
                <span className="block truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <svg
                        className={`h-5 w-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                        />
                    </svg>
                </span>
            </button>

            {isOpen && (
                <ul
                    ref={listRef}
                    className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 focus:outline-none sm:text-sm"
                    role="listbox"
                    aria-labelledby={id}
                >
                    {options.map((option, index) => {
                        const isSelected = value === option.value;
                        const isFocused = focusedIndex === index;

                        return (
                            <li
                                key={option.value}
                                className={`
                                    relative cursor-default select-none py-2 pl-3 pr-9 transition-colors
                                    ${option.disabled
                                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                        : isFocused
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }
                                `}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => handleOptionClick(option)}
                                onMouseEnter={() => !option.disabled && setFocusedIndex(index)}
                            >
                                <span className={`block truncate ${isSelected ? 'font-semibold' : 'font-normal'}`}>
                                    {option.label}
                                </span>

                                {isSelected && (
                                    <span className={`
                                        absolute inset-y-0 right-0 flex items-center pr-4
                                        ${isFocused ? 'text-white' : 'text-blue-600 dark:text-blue-400'}
                                    `}>
                                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path
                                                fillRule="evenodd"
                                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default Select;