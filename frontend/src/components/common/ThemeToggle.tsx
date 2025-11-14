import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  iconClass?: string;
}

/**
 * Theme toggle component for switching between light and dark modes
 */
const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
  showIcon = true,
  iconClass = "h-4 w-4",
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleThemeChange = () => {
    if (theme === 'system') {
      // If currently system, switch to opposite of resolved theme
      setTheme(resolvedTheme === 'light' ? 'dark' : 'light');
    } else {
      // If currently light/dark, switch to opposite
      setTheme(theme === 'light' ? 'dark' : 'light');
    }
  };

  const getIcon = () => {
    if (resolvedTheme === 'dark') {
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    }
    return (
      <svg
        className={iconClass}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    );
  };

  const getLabel = () => {
    return resolvedTheme === 'light'
      ? 'Switch to dark mode'
      : 'Switch to light mode';
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={handleThemeChange}
        className={`cursor-pointer ${className}`}
        aria-label={getLabel()}
        title={getLabel()}
      >
        {showIcon && getIcon()}
        {showLabel && (
          <span>
            {resolvedTheme === 'light' ? 'Dark' : 'Light'}
          </span>
        )}
      </button>
    </div>
  );
};

export default ThemeToggle;
