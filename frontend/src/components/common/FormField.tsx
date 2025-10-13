import React from 'react';

export interface FormFieldProps {
    children: React.ReactNode;
    label?: string;
    error?: string;
    helperText?: string;
    required?: boolean;
    className?: string;
    id?: string;
}

const FormField: React.FC<FormFieldProps> = ({
    children,
    label,
    error,
    helperText,
    required = false,
    className = '',
    id,
}) => {
    const fieldId = id || `field-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div className={`w-full ${className}`}>
            {label && (
                <label
                    htmlFor={fieldId}
                    className="block text-sm font-medium leading-6 text-gray-900 mb-2"
                >
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                {React.isValidElement(children)
                    ? React.cloneElement(children, {
                        id: fieldId,
                        'aria-describedby': error
                            ? `${fieldId}-error`
                            : helperText
                                ? `${fieldId}-description`
                                : undefined,
                        'aria-invalid': error ? 'true' : 'false',
                    } as any)
                    : children
                }
            </div>

            {error && (
                <p
                    className="mt-2 text-sm text-red-600"
                    id={`${fieldId}-error`}
                    role="alert"
                >
                    {error}
                </p>
            )}

            {helperText && !error && (
                <p
                    className="mt-2 text-sm text-gray-500"
                    id={`${fieldId}-description`}
                >
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default FormField;