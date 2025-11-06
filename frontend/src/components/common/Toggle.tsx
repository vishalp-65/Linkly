import React from 'react';

export interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    description?: string;
    className?: string;
    id?: string;
    name?: string;
}

const Toggle: React.FC<ToggleProps> = ({
    checked,
    onChange,
    disabled = false,
    size = 'md',
    label,
    description,
    className = '',
    id,
    name,
}) => {
    const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

    const sizeConfig = {
        sm: {
            switch: 'h-5 w-9',
            thumb: 'h-4 w-4',
            translate: checked ? 'translate-x-4' : 'translate-x-0'
        },
        md: {
            switch: 'h-6 w-11',
            thumb: 'h-5 w-5',
            translate: checked ? 'translate-x-5' : 'translate-x-0'
        },
        lg: {
            switch: 'h-7 w-12',
            thumb: 'h-6 w-6',
            translate: checked ? 'translate-x-5' : 'translate-x-0'
        }
    };

    const config = sizeConfig[size];

    const handleToggle = () => {
        if (!disabled) {
            onChange(!checked);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            handleToggle();
        }
    };

    const switchClasses = `
    ${config.switch}
    relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
    transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2
    ${checked
            ? 'bg-blue-600'
            : 'bg-gray-200'
        }
    ${disabled
            ? 'cursor-not-allowed opacity-50'
            : ''
        }
  `;

    const thumbClasses = `
    ${config.thumb} ${config.translate}
    pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 
    transition duration-200 ease-in-out
  `;

    return (
        <div className={`flex items-start ${className}`}>
            <button
                type="button"
                className={switchClasses}
                role="switch"
                aria-checked={checked}
                aria-labelledby={label ? `${toggleId}-label` : undefined}
                aria-describedby={description ? `${toggleId}-description` : undefined}
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                id={toggleId}
                name={name}
            >
                <span className="sr-only">
                    {label || 'Toggle switch'}
                </span>
                <span className={thumbClasses} />
            </button>

            {(label || description) && (
                <div className="ml-3 flex-1">
                    {label && (
                        <label
                            htmlFor={toggleId}
                            className={`text-sm font-medium text-gray-900 cursor-pointer ${disabled ? 'cursor-not-allowed opacity-50' : ''
                                }`}
                            id={`${toggleId}-label`}
                        >
                            {label}
                        </label>
                    )}
                    {description && (
                        <p
                            className={`text-sm text-gray-500 ${disabled ? 'opacity-50' : ''
                                }`}
                            id={`${toggleId}-description`}
                        >
                            {description}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Toggle;