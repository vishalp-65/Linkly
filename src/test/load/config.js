/**
 * Load Testing Configuration
 * 
 * Centralized configuration for all load testing scenarios
 */

export const config = {
    // Target server configuration
    baseUrl: __ENV.BASE_URL || 'http://localhost:3000',

    // Load test targets (based on requirements)
    targets: {
        urlCreation: {
            rps: 100000,  // 100,000 requests per second
            duration: '10m',
            p99Threshold: 100,  // milliseconds
        },
        urlRedirect: {
            rps: 1000000,  // 1,000,000 requests per second
            duration: '10m',
            p99Threshold: 50,  // milliseconds
        },
    },

    // Stress test configuration
    stress: {
        stages: [
            { duration: '2m', target: 100 },      // Ramp up to 100 VUs
            { duration: '5m', target: 500 },      // Ramp up to 500 VUs
            { duration: '5m', target: 1000 },     // Ramp up to 1000 VUs
            { duration: '5m', target: 2000 },     // Ramp up to 2000 VUs
            { duration: '5m', target: 5000 },     // Ramp up to 5000 VUs (stress)
            { duration: '3m', target: 10000 },    // Ramp up to 10000 VUs (breaking point)
            { duration: '5m', target: 0 },        // Ramp down to 0 (recovery)
        ],
    },

    // Spike test configuration
    spike: {
        stages: [
            { duration: '2m', target: 100 },      // Normal load
            { duration: '1m', target: 1000 },     // Spike to 10x
            { duration: '3m', target: 1000 },     // Sustain spike
            { duration: '1m', target: 100 },      // Return to normal
            { duration: '2m', target: 100 },      // Recover
        ],
    },

    // Soak test configuration
    soak: {
        stages: [
            { duration: '5m', target: 500 },      // Ramp up
            { duration: '2h', target: 500 },      // Sustain load
            { duration: '5m', target: 0 },        // Ramp down
        ],
    },

    // Thresholds for pass/fail criteria
    thresholds: {
        // HTTP request duration
        'http_req_duration': ['p(95)<100', 'p(99)<200'],
        'http_req_duration{endpoint:redirect}': ['p(95)<50', 'p(99)<100'],
        'http_req_duration{endpoint:shorten}': ['p(95)<100', 'p(99)<200'],

        // HTTP request failure rate
        'http_req_failed': ['rate<0.01'],  // Less than 1% errors
        'http_req_failed{endpoint:redirect}': ['rate<0.01'],
        'http_req_failed{endpoint:shorten}': ['rate<0.01'],

        // Custom metrics
        'cache_hit_ratio': ['value>0.95'],  // Greater than 95%
        'successful_redirects': ['rate>0.99'],  // Greater than 99%
    },

    // Test data configuration
    testData: {
        // Number of unique URLs to create for testing
        uniqueUrls: 10000,

        // URL patterns for testing
        urlPatterns: [
            'https://example.com/page/',
            'https://test.com/article/',
            'https://demo.com/product/',
            'https://sample.com/blog/',
        ],

        // Custom alias patterns
        customAliasPrefix: 'test-',

        // Expiry options
        expiryOptions: [null, '1d', '7d', '30d'],
    },

    // Request configuration
    requests: {
        timeout: '30s',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'k6-load-test',
        },
    },

    // Monitoring configuration
    monitoring: {
        // Enable detailed logging
        verbose: __ENV.VERBOSE === 'true',

        // Sample rate for detailed logs (0-1)
        logSampleRate: 0.01,

        // Export metrics
        exportMetrics: __ENV.EXPORT_METRICS === 'true',
    },
};

/**
 * Generate a random URL for testing
 */
export function generateRandomUrl() {
    const patterns = config.testData.urlPatterns;
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    const id = Math.floor(Math.random() * 1000000);
    return `${pattern}${id}`;
}

/**
 * Generate a random custom alias
 */
export function generateCustomAlias() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let alias = config.testData.customAliasPrefix;
    for (let i = 0; i < 8; i++) {
        alias += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return alias;
}

/**
 * Get a random expiry option
 */
export function getRandomExpiry() {
    const options = config.testData.expiryOptions;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Sleep for a random duration (for realistic user behavior)
 */
export function randomSleep(min = 1, max = 5) {
    const duration = Math.random() * (max - min) + min;
    return duration;
}

export default config;
