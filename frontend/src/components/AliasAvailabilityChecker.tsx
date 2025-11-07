import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLazyCheckAliasAvailabilityQuery } from '../services/api';
import Input from './common/Input';
import { useToast } from '../contexts/ToastContext';
import { reservedWords } from '../utils/constant';

export interface AliasAvailabilityCheckerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onAvailabilityChange?: (available: boolean) => void;
    onSuggestionsChange?: (suggestions: string[]) => void;
}

const AliasAvailabilityChecker: React.FC<AliasAvailabilityCheckerProps> = ({
    value,
    onChange,
    disabled = false,
    onAvailabilityChange,
    onSuggestionsChange,
}) => {
    const [validationError, setValidationError] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const { showToast } = useToast();

    const [checkAlias, { isFetching }] = useLazyCheckAliasAvailabilityQuery();
    const debounceTimerRef = useRef<number | null>(null);

    // Validate alias format (client-side validation)
    const validateAlias = useCallback((alias: string): boolean => {
        if (!alias) {
            setValidationError('');
            setIsAvailable(null);
            setSuggestions([]);
            return false;
        }

        // Check for valid characters (alphanumeric, hyphens, underscores)
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(alias)) {
            setValidationError(
                'Only letters, numbers, hyphens, and underscores allowed'
            );
            setIsAvailable(false);
            setSuggestions([]);
            return false;
        }

        // Check minimum length
        if (alias.length < 3) {
            setValidationError('Alias must be at least 3 characters');
            setIsAvailable(false);
            setSuggestions([]);
            return false;
        }

        // Check maximum length
        if (alias.length > 30) {
            setValidationError('Alias must be less than 30 characters');
            setIsAvailable(false);
            setSuggestions([]);
            return false;
        }

        if (reservedWords.includes(alias.toLowerCase())) {
            setValidationError('This alias is reserved, Try another!');
            setIsAvailable(false);
            setSuggestions([]);
            return false;
        }

        setValidationError('');
        return true;
    }, []);

    // Check alias availability with debouncing
    const checkAliasAvailability = useCallback(
        async (alias: string) => {
            if (!alias || alias.length < 3) {
                return;
            }

            try {
                setIsChecking(true);
                const result = await checkAlias(alias).unwrap();

                if (result.success) {
                    const available = result.data.isAvailable;
                    const suggestions = result.data.suggestions || [];

                    setIsAvailable(available);
                    setSuggestions(suggestions);

                    if (onAvailabilityChange) {
                        onAvailabilityChange(available);
                    }

                    if (onSuggestionsChange) {
                        onSuggestionsChange(suggestions);
                    }

                    if (!available) {
                        setValidationError('This alias is already taken');
                    }
                }
            } catch (error: any) {
                console.error('Error checking alias availability:', error);
                setIsAvailable(null);
                setSuggestions([]);
                showToast({
                    type: "error",
                    title: "Error",
                    message: `${error?.data.message}`,
                    duration: 3000
                })
            } finally {
                setIsChecking(false);
            }
        },
        [checkAlias, onAvailabilityChange, onSuggestionsChange]
    );

    // Debounced alias checking
    useEffect(() => {
        // Clear previous timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Reset states
        setIsChecking(false);
        setIsAvailable(null);
        setSuggestions([]);

        // Validate format first
        const isValidFormat = validateAlias(value);

        if (!isValidFormat || !value || value.length < 3) {
            if (onAvailabilityChange) {
                onAvailabilityChange(false);
            }
            if (onSuggestionsChange) {
                onSuggestionsChange([]);
            }
            return;
        }

        // Set new timer for API check
        debounceTimerRef.current = setTimeout(() => {
            checkAliasAvailability(value);
        }, 500); // 500ms debounce

        // Cleanup
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [
        value,
        validateAlias,
        checkAliasAvailability,
        onAvailabilityChange,
        onSuggestionsChange,
    ]);

    const getHelperText = (): string => {
        if (validationError) return validationError;
        if (!value) return 'Enter a custom alias (3-30 characters)';
        if (value.length < 3) return 'Minimum 3 characters required';

        if (isChecking || isFetching) {
            return 'Checking availability...';
        }

        if (isAvailable === true) {
            return '✓ This alias is available!';
        }

        if (isAvailable === false) {
            return suggestions.length > 0
                ? 'Alias taken - see suggestions below'
                : 'This alias is already taken';
        }

        return '';
    };

    const getHelperTextColor = (): string => {
        if (validationError || isAvailable === false) return 'text-red-600 dark:text-red-400';
        if (isAvailable === true) return 'text-green-600 dark:text-green-500';
        if (isChecking || isFetching) return 'text-blue-600 dark:text-blue-500';
        return 'text-gray-500';
    };

    const getRightIcon = () => {
        if (isChecking || isFetching) {
            return (
                <svg
                    className="animate-spin h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            );
        }

        if (isAvailable === true) {
            return (
                <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            );
        }

        if (isAvailable === false || validationError) {
            return (
                <svg
                    className="h-5 w-5 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            );
        }

        return null;
    };

    return (
        <div className="space-y-2">
            <Input
                type="text"
                value={value}
                onChange={(e) => {
                    // Convert to lowercase and remove invalid characters in real-time
                    const cleaned = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, '');
                    onChange(cleaned);
                }}
                placeholder="my-custom-alias"
                helperText={getHelperText()}
                helperTextClassName={getHelperTextColor()}
                disabled={disabled}
                rightIcon={getRightIcon()}
                leftIcon={
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
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                    </svg>
                }
            />

            {/* Tips */}
            {!value && (
                <div className="text-xs text-gray-500 space-y-1">
                    <p className="flex items-center">
                        <svg
                            className="w-4 h-4 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        Tips for choosing an alias:
                    </p>
                    <ul className="list-disc list-inside ml-5 space-y-0.5">
                        <li>Use 3-30 characters</li>
                        <li>Only letters, numbers, hyphens, and underscores</li>
                        <li>Make it memorable and relevant to your content</li>
                        <li>Avoid reserved words like "api", "admin", "www"</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AliasAvailabilityChecker;
