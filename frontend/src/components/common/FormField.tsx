import React from 'react';

export interface FormFieldProps {
    label?: string;
    description?: string;
    helperText?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    description,
    helperText,
    error,
    required,
    children,
    className = '',
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {description && (
                <p className="text-sm text-gray-600">{description}</p>
            )}

            {children}

            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}

            {helperText && !error && (
                <p className="text-sm text-gray-500">{helperText}</p>
            )}
        </div>
    );
};

export default FormField;