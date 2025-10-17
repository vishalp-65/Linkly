/**
 * Environment configuration for the frontend application
 */

interface Config {
    baseUrl: string;
    apiUrl: string;
    isDevelopment: boolean;
    isProduction: boolean;
}

// Validate required environment variables
const validateEnv = () => {
    const baseUrl = import.meta.env.VITE_BASE_URL;

    if (!baseUrl) {
        throw new Error('VITE_BASE_URL environment variable is required');
    }

    return baseUrl;
};

// Create configuration object
const createConfig = (): Config => {
    const baseUrl = validateEnv();

    return {
        baseUrl,
        apiUrl: `${baseUrl}/api/v1`,
        isDevelopment: import.meta.env.DEV,
        isProduction: import.meta.env.PROD,
    };
};

export const config = createConfig();

// Export individual values for convenience
export const { baseUrl, apiUrl, isDevelopment, isProduction } = config;

export default config;