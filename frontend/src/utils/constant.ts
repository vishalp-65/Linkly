// Check for reserved words
export const reservedWords = [
    'api',
    'admin',
    'www',
    'app',
    'help',
    'support',
    'about',
    'contact',
    'url',
    'shorten',
    'analytics',
    'dashboard',
    'login',
    'register',
    'logout',
    'profile',
    'settings',
    'terms',
    'privacy',
    'docs',
    'redirect',
    'getall',
    'resolve',
    'stats',
    'health',
];

// Base URL for API
export const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:3000/api/v1';
export const API_REDIRECT_BASE_URL = import.meta.env.VITE_REDIRECT_BASE_URL || 'http://localhost:3000';
export const QR_CODE_GENERATER_URL = import.meta.env.VITE_QR_CODE_GENERATER_URL || 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=';