import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setTheme, initializeTheme } from '../store/uiSlice';
import type { RootState } from '../store';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);
  // Don't set initial state - let it be undefined until Redux loads
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [initialized, setInitialized] = useState(false);

  // Initialize theme on mount ONCE
  useEffect(() => {
    if (!initialized) {
      dispatch(initializeTheme());
      setInitialized(true);
    }
  }, [dispatch, initialized]);

  // Resolve theme based on current theme setting
  useEffect(() => {
    // Don't do anything until initialized
    if (!initialized) return;

    const resolveTheme = () => {
      if (theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        return mediaQuery.matches ? 'dark' : 'light';
      }
      return theme;
    };

    const newResolvedTheme = resolveTheme();
    setResolvedTheme(newResolvedTheme);

    // Listen for system theme changes only if theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const newTheme = mediaQuery.matches ? 'dark' : 'light';
        setResolvedTheme(newTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, initialized]);

  // Apply theme to document
  useEffect(() => {
    // Don't do anything until initialized
    if (!initialized) return;

    const root = document.documentElement;

    // Remove ALL possible theme classes
    root.classList.remove('light', 'dark');

    // Add the resolved theme class
    root.classList.add(resolvedTheme);

    // Set color-scheme for better browser defaults
    root.style.colorScheme = resolvedTheme;

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolvedTheme === 'dark' ? '#1f2937' : '#ffffff'
      );
    }

    // Force a reflow
    void root.offsetHeight;
  }, [resolvedTheme, initialized]);

  const handleSetTheme = (newTheme: Theme) => {
    dispatch(setTheme(newTheme));
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    handleSetTheme(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme: handleSetTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
