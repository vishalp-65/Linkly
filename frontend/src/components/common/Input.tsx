import React from 'react';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | React.ReactNode;
  helperText?: string | React.ReactNode;
  error?: string | React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperTextClassName?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = '',
  id,
  helperTextClassName,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperTextId = helperText ? `${inputId}-helper` : undefined;

  const inputClasses = `
    w-full px-3 py-2 border rounded-md shadow-sm transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
    ${leftIcon ? 'pl-10' : ''}
    ${rightIcon ? 'pr-10' : ''}
    ${error
      ? 'border-red-300 bg-red-50 focus:ring-red-500 dark:border-red-600 dark:bg-red-900/20 dark:focus:ring-red-400'
      : 'border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400'
    }
    ${className}
  `;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div
            className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-gray-400">{leftIcon}</span>
          </div>
        )}

        <input
          id={inputId}
          className={inputClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            [errorId, helperTextId].filter(Boolean).join(' ') || undefined
          }
          {...props}
        />

        {rightIcon && (
          <div
            className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-gray-400">{rightIcon}</span>
          </div>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="mt-1 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}

      {helperText && !error && (
        <p
          id={helperTextId}
          className={`mt-1 text-sm text-gray-500 dark:text-gray-400 ${helperTextClassName}`}
        >
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;
