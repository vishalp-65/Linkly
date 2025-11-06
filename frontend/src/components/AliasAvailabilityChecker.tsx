import React, { useState, useEffect, useCallback } from 'react';
import { useLazyCheckAliasAvailabilityQuery } from '../services/api';
import Input from './common/Input';

export interface AliasAvailabilityCheckerProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onAvailabilityChange?: (available: boolean) => void;
}

const AliasAvailabilityChecker: React.FC<AliasAvailabilityCheckerProps> = ({
    value,
    onChange,
    disabled = false,
    onAvailabilityChange
}) => {
    const [checkAlias, { data, isLoading, error }] = useLazyCheckAliasAvailabilityQuery();
    const [debouncedValue, setDebouncedValue] = useState(value);
    const [validationError, setValidationError] = useState('');

    // Debounce the input value
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setDebouncedValue(value);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [value]);

    // Validate alias format
    const validateAlias = useCallback((alias: string) => {
        if (!alias) {
            setValidationError('');
            return true;
        }

        // Check for valid characters (alphanumeric, hyphens, underscores)
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(alias)) {
            setValidationError('Alias can only contain letters, numbers, hyphens, and underscores');
            return false;
        }

        // Check minimum length
        if (alias.length < 3) {
            setValidationError('Alias must be at least 3 characters long');
            return false;
        }

        // Check maximum length
        if (alias.length > 50) {
            setValidationError('Alias must be less than 50 characters');
            return false;
        }

        // Check for reserved words
        const reservedWords = ['api', 'admin', 'www', 'app', 'help', 'support', 'about', 'contact'];
        if (reservedWords.includes(alias.toLowerCase())) {
            setValidationError('This alias is reserved and cannot be used');
            return false;
        }

        setValidationError('');
        return true;
    }, []);

    // Check availability when debounced value changes
    useEffect(() => {
        if (debouncedValue && validateAlias(debouncedValue)) {
            checkAlias(debouncedValue);
        }
    }, [debouncedValue, checkAlias, validateAlias]);

    // Notify parent about availability changes
    useEffect(() => {
        if (onAvailabilityChange) {
            const isAvailable = !validationError &&
                (!debouncedValue || (data?.available === true));
            onAvailabilityChange(isAvailable);
        }
    }, [data?.available, validationError, debouncedValue, onAvailabilityChange]);

    const getInputVariant = () => {
        if (validationError) return 'error';
        if (!debouncedValue) return 'default';
        if (isLoading) return 'default';
        if (data?.available === true) return 'success';
        if (data?.available === false) return 'error';
        return 'default';
    };

    const getHelperText = () => {
        if (validationError) return validationError;
        if (!debouncedValue) return 'Enter a custom alias for your short URL';
        if (isLoading) return 'Checking availability...';
        if (data?.available === true) return '✓ This alias is available';
        if (data?.available === false) {
            const suggestions = data.suggestions?.slice(0, 3).join(', ');
            return `This alias is already taken${suggestions ? `. Try: ${suggestions}` : ''}`;
        }
        if (error) return 'Unable to check availability. Please try again.';
        return '';
    };

    const getRightIcon = () => {
        if (isLoading) {
            return (
                <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
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

        if (debouncedValue && !validationError) {
            if (data?.available === true) {
                return (
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            }

            if (data?.available === false) {
                return (
                    <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            }
        }

        return null;
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
    };

    return (
        <div className="space-y-2">
            <Input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="my-custom-link"
                variant={getInputVariant()}
                helperText={getHelperText()}
                disabled={disabled}
                rightIcon={getRightIcon()}
            />

            {/* Suggestions */}
            {data?.available === false && data.suggestions && data.suggestions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Suggested alternatives:</p>
                    <div className="flex flex-wrap gap-2">
                        {data.suggestions.slice(0, 5).map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                                disabled={disabled}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AliasAvailabilityChecker;