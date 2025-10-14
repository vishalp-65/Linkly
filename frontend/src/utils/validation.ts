// Validation utility functions for forms

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateField = (value: any, rules: ValidationRule): ValidationResult => {
  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return { isValid: false, error: 'This field is required' };
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return { isValid: true };
  }

  const stringValue = String(value);

  // Min length validation
  if (rules.minLength && stringValue.length < rules.minLength) {
    return {
      isValid: false,
      error: `Must be at least ${rules.minLength} characters long`
    };
  }

  // Max length validation
  if (rules.maxLength && stringValue.length > rules.maxLength) {
    return {
      isValid: false,
      error: `Must be no more than ${rules.maxLength} characters long`
    };
  }

  // Pattern validation
  if (rules.pattern && !rules.pattern.test(stringValue)) {
    return { isValid: false, error: 'Invalid format' };
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { isValid: false, error: customError };
    }
  }

  return { isValid: true };
};

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/.+/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  numbersOnly: /^\d+$/,
  noSpecialChars: /^[a-zA-Z0-9\s\-_]+$/,
};

// Common validation rules
export const commonRules = {
  required: { required: true },
  email: {
    required: true,
    pattern: validationPatterns.email,
    custom: (value: string) => {
      if (value && !validationPatterns.email.test(value)) {
        return 'Please enter a valid email address';
      }
      return null;
    }
  },
  url: {
    required: true,
    pattern: validationPatterns.url,
    maxLength: 2048,
    custom: (value: string) => {
      if (value && !validationPatterns.url.test(value)) {
        return 'Please enter a valid URL starting with http:// or https://';
      }
      return null;
    }
  },
  password: {
    required: true,
    minLength: 8,
    custom: (value: string) => {
      if (value && value.length >= 8) {
        const hasUpperCase = /[A-Z]/.test(value);
        const hasLowerCase = /[a-z]/.test(value);
        const hasNumbers = /\d/.test(value);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

        if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
          return 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character';
        }
      }
      return null;
    }
  },
  customAlias: {
    minLength: 3,
    maxLength: 50,
    pattern: validationPatterns.alphanumeric,
    custom: (value: string) => {
      if (value && !validationPatterns.alphanumeric.test(value)) {
        return 'Custom alias can only contain letters and numbers';
      }
      return null;
    }
  }
};

// Form validation helper
export interface FormData {
  [key: string]: any;
}

export interface FormRules {
  [key: string]: ValidationRule;
}

export interface FormErrors {
  [key: string]: string;
}

export const validateForm = (data: FormData, rules: FormRules): { isValid: boolean; errors: FormErrors } => {
  const errors: FormErrors = {};
  let isValid = true;

  Object.keys(rules).forEach(field => {
    const result = validateField(data[field], rules[field]);
    if (!result.isValid) {
      errors[field] = result.error!;
      isValid = false;
    }
  });

  return { isValid, errors };
};

// Debounced validation for real-time feedback
export const createDebouncedValidator = (
  validator: (value: any) => ValidationResult,
  delay: number = 300
) => {
  let timeoutId: number;

  return (value: any, callback: (result: ValidationResult) => void) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      const result = validator(value);
      callback(result);
    }, delay);
  };
};

// URL-specific validation for the URL shortener
export const validateURL = (url: string): ValidationResult => {
  if (!url || url.trim() === '') {
    return { isValid: false, error: 'URL is required' };
  }

  if (url.length > 2048) {
    return { isValid: false, error: 'URL must be less than 2048 characters' };
  }

  if (!validationPatterns.url.test(url)) {
    return { isValid: false, error: 'Please enter a valid URL starting with http:// or https://' };
  }

  // Check for potentially malicious patterns
  const maliciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /@/,  // Prevent open redirect attacks
  ];

  for (const pattern of maliciousPatterns) {
    if (pattern.test(url)) {
      return { isValid: false, error: 'URL contains invalid or potentially unsafe content' };
    }
  }

  return { isValid: true };
};

// Custom alias validation for URL shortener
export const validateCustomAlias = (alias: string): ValidationResult => {
  if (!alias || alias.trim() === '') {
    return { isValid: true }; // Optional field
  }

  if (alias.length < 3) {
    return { isValid: false, error: 'Custom alias must be at least 3 characters long' };
  }

  if (alias.length > 50) {
    return { isValid: false, error: 'Custom alias must be no more than 50 characters long' };
  }

  if (!validationPatterns.alphanumeric.test(alias)) {
    return { isValid: false, error: 'Custom alias can only contain letters and numbers' };
  }

  // Reserved words that shouldn't be used as aliases
  const reservedWords = [
    'api', 'www', 'admin', 'root', 'user', 'login', 'signup', 'dashboard',
    'analytics', 'settings', 'help', 'about', 'contact', 'terms', 'privacy',
    'app', 'mobile', 'web', 'static', 'assets', 'public', 'private'
  ];

  if (reservedWords.includes(alias.toLowerCase())) {
    return { isValid: false, error: 'This alias is reserved and cannot be used' };
  }

  return { isValid: true };
};