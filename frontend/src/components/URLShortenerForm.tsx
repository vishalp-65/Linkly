import React, { useState, useEffect } from 'react';
import Button from './common/Button';
import Input from './common/Input';
import Select from './common/Select';
import FormField from './common/FormField';
import AliasAvailabilityChecker from './AliasAvailabilityChecker';

export interface URLShortenerFormProps {
    onSubmit: (data: URLSubmissionData) => void;
    loading?: boolean;
}

export interface URLSubmissionData {
    originalUrl: string;
    customAlias?: string;
    expiryDays?: number;
}

const URLShortenerForm: React.FC<URLShortenerFormProps> = ({
    onSubmit,
    loading = false
}) => {
    const [originalUrl, setOriginalUrl] = useState('');
    const [customAlias, setCustomAlias] = useState('');
    const [expiryDays, setExpiryDays] = useState<number | undefined>(undefined);
    const [urlError, setUrlError] = useState('');
    const [aliasAvailable, setAliasAvailable] = useState(true);

    // Expiry options
    const expiryOptions = [
        { value: '', label: 'Never expires' },
        { value: '1', label: '1 day' },
        { value: '7', label: '1 week' },
        { value: '30', label: '1 month' },
        { value: '90', label: '3 months' },
        { value: '365', label: '1 year' }
    ];

    // Real-time URL validation
    useEffect(() => {
        if (originalUrl.trim() === '') {
            setUrlError('');
            return;
        }

        const validateUrl = () => {
            try {
                const url = new URL(originalUrl);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    setUrlError('URL must use HTTP or HTTPS protocol');
                    return;
                }
                setUrlError('');
            } catch {
                setUrlError('Please enter a valid URL');
            }
        };

        const timeoutId = setTimeout(validateUrl, 300);
        return () => clearTimeout(timeoutId);
    }, [originalUrl]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!originalUrl.trim()) {
            setUrlError('URL is required');
            return;
        }

        if (urlError) {
            return;
        }

        const submissionData: URLSubmissionData = {
            originalUrl: originalUrl.trim(),
            customAlias: customAlias.trim() || undefined,
            expiryDays: expiryDays
        };

        onSubmit(submissionData);
    };

    const handleExpiryChange = (value: string) => {
        setExpiryDays(value ? parseInt(value, 10) : undefined);
    };

    const isFormValid = originalUrl.trim() !== '' && !urlError && aliasAvailable;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <FormField
                label="URL to shorten"
                error={urlError}
                required
            >
                <Input
                    type="url"
                    value={originalUrl}
                    onChange={(e) => setOriginalUrl(e.target.value)}
                    placeholder="https://example.com/very-long-url"
                    variant={urlError ? 'error' : 'default'}
                    disabled={loading}
                />
            </FormField>

            <FormField
                label="Custom alias (optional)"
                helperText="Leave empty for auto-generated short code"
            >
                <AliasAvailabilityChecker
                    value={customAlias}
                    onChange={setCustomAlias}
                    disabled={loading}
                    onAvailabilityChange={setAliasAvailable}
                />
            </FormField>

            <FormField
                label="Expiry"
                helperText="Choose when this short URL should expire"
            >
                <Select
                    options={expiryOptions}
                    value={expiryDays?.toString() || ''}
                    onChange={handleExpiryChange}
                    disabled={loading}
                />
            </FormField>

            <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                disabled={!isFormValid || loading}
                className="w-full"
            >
                {loading ? 'Creating short URL...' : 'Shorten URL'}
            </Button>
        </form>
    );
};

export default URLShortenerForm;