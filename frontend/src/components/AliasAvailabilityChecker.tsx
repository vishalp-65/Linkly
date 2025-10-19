import React, { useState, useEffect, useCallback } from 'react';
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
    const [validationError, setValidationError] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Validate alias format
    const validateAlias = useCallback((alias: string): boolean => {
        if (!alias) {
            setValidationError('');
            return true;
        }

        // Check for valid characters (alphanumeric, hyphens, underscores)
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(alias)) {
            setValidationError('Only letters, numbers, hyphens, and underscores allowed');
            return false;
        }

        // Check minimum length
        if (alias.length < 3) {
            setValidationError('Alias must be at least 3 characters');
            return false;
        }

        // Check maximum length
        if (alias.length > 50) {
            setValidationError('Alias must be less than 50 characters');
            return false;
        }

        // Check for reserved words
        const reservedWords = [
            'api', 'admin', 'www', 'app', 'help', 'support', 'about', 'contact',
            'url', 'shorten', 'analytics', 'dashboard', 'login', 'register',
            'logout', 'profile', 'settings', 'terms', 'privacy', 'docs', 'redirect',
            'getall', 'resolve', 'stats', 'health'
        ];
        if (reservedWords.includes(alias.toLowerCase())) {
            setValidationError('This alias is reserved');
            return false;
        }

        setValidationError('');
        return true;
    }, []);

    // Validate on value change
    useEffect(() => {
        const isValid = validateAlias(value);

        if (onAvailabilityChange) {
            // We can't check server-side availability here since the endpoint
            // only returns availability on actual URL creation attempt
            // So we only report client-side validation
            onAvailabilityChange(isValid);
        }
    }, [value, validateAlias, onAvailabilityChange]);

    const getHelperText = (): string => {
        if (validationError) return validationError;
        if (!value) return 'Enter a custom alias (3-50 characters)';

        // Since we can't check availability in real-time,
        // we just indicate that the format is valid
        if (value.length >= 3) {
            return '✓ Format is valid - availability will be checked on submission';
        }

        return '';
    };

    const getHelperTextColor = (): string => {
        if (validationError) return 'text-red-600';
        if (value.length >= 3 && !validationError) return 'text-green-600';
        return 'text-gray-500';
    };

    const getRightIcon = () => {
        if (isValidating) {
            return (
                <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
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

        if (value && !validationError) {
            if (value.length >= 3) {
                return (
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
            }
        }

        if (validationError) {
            return (
                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                    onChange(cleaned);
                }}
                placeholder="my-custom-alias"
                helperText={getHelperText()}
                className={getHelperTextColor()}
                disabled={disabled}
                rightIcon={getRightIcon()}
                leftIcon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                }
            />

            {/* Tips */}
            {!value && (
                <div className="text-xs text-gray-500 space-y-1">
                    <p className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Tips for choosing an alias:
                    </p>
                    <ul className="list-disc list-inside ml-5 space-y-0.5">
                        <li>Use 3-50 characters</li>
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