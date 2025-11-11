/**
 * Smoke Test for URL Shortener System
 * 
 * Quick validation test to ensure system is ready for load testing:
 * - Verifies all endpoints are accessible
 * - Tests basic functionality
 * - Runs in under 1 minute
 * 
 * Run this before full load tests to catch configuration issues early
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { config, generateRandomUrl } from './config.js';

// Minimal load for smoke test
export const options = {
    vus: 5,
    duration: '30s',

    thresholds: {
        'http_req_duration': ['p(95)<500'],
        'http_req_failed': ['rate<0.01'],
        'checks': ['rate>0.95'],
    },
};

/**
 * Setup function
 */
export function setup() {
    console.log('=== Smoke Test ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log('==================\n');

    // Test 1: Health endpoint
    console.log('Testing health endpoint...');
    const healthRes = http.get(`${config.baseUrl}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Health check failed: ${healthRes.status}`);
    }
    console.log('✓ Health endpoint OK');

    // Test 2: Info endpoint
    console.log('Testing info endpoint...');
    const infoRes = http.get(`${config.baseUrl}/info`);
    if (infoRes.status !== 200) {
        throw new Error(`Info endpoint failed: ${infoRes.status}`);
    }
    console.log('✓ Info endpoint OK');

    // Test 3: Create URL
    console.log('Testing URL creation...');
    const createPayload = JSON.stringify({
        longUrl: generateRandomUrl(),
    });

    const createRes = http.post(
        `${config.baseUrl}/api/v1/shorten`,
        createPayload,
        { headers: config.requests.headers }
    );

    if (createRes.status !== 201) {
        throw new Error(`URL creation failed: ${createRes.status}`);
    }

    const createBody = JSON.parse(createRes.body);
    if (!createBody.shortCode) {
        throw new Error('URL creation response missing shortCode');
    }
    console.log('✓ URL creation OK');

    // Test 4: Redirect
    console.log('Testing URL redirect...');
    const redirectRes = http.get(
        `${config.baseUrl}/${createBody.shortCode}`,
        { redirects: 0 }
    );

    if (redirectRes.status !== 301) {
        throw new Error(`URL redirect failed: ${redirectRes.status}`);
    }
    console.log('✓ URL redirect OK');

    // Test 5: Analytics (optional)
    console.log('Testing analytics endpoint...');
    const analyticsRes = http.get(
        `${config.baseUrl}/api/v1/analytics/${createBody.shortCode}`
    );

    if (analyticsRes.status !== 200 && analyticsRes.status !== 404) {
        console.log(`⚠ Analytics endpoint returned ${analyticsRes.status}`);
    } else {
        console.log('✓ Analytics endpoint OK');
    }

    console.log('\n✓ All smoke tests passed\n');

    return { testShortCode: createBody.shortCode };
}

/**
 * Main test function
 */
export default function (data) {
    // Test URL creation
    group('Smoke - URL Creation', () => {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
        });

        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            { headers: config.requests.headers }
        );

        check(res, {
            'status is 201': (r) => r.status === 201,
            'has shortCode': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.shortCode !== undefined;
                } catch {
                    return false;
                }
            },
            'response time OK': (r) => r.timings.duration < 500,
        });
    });

    // Test URL redirect
    group('Smoke - URL Redirect', () => {
        const res = http.get(
            `${config.baseUrl}/${data.testShortCode}`,
            { redirects: 0 }
        );

        check(res, {
            'status is 301': (r) => r.status === 301,
            'has Location header': (r) => r.headers['Location'] !== undefined,
            'response time OK': (r) => r.timings.duration < 200,
        });
    });

    sleep(1);
}

/**
 * Teardown function
 */
export function teardown(data) {
    console.log('\n=== Smoke Test Complete ===');
    console.log('System is ready for load testing');
    console.log('===========================\n');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values.count || 0;
    const errorRate = (data.metrics.http_req_failed?.values.rate || 0) * 100;
    const checkRate = (data.metrics.checks?.values.rate || 0) * 100;
    const avgResponseTime = data.metrics.http_req_duration?.values.avg || 0;

    console.log('\n' + '='.repeat(60));
    console.log('SMOKE TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`\nTotal Requests: ${totalRequests}`);
    console.log(`Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`Check Success Rate: ${checkRate.toFixed(2)}%`);
    console.log(`Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);

    if (errorRate < 1 && checkRate > 95) {
        console.log('\n✓ SMOKE TEST PASSED');
        console.log('System is ready for load testing\n');
    } else {
        console.log('\n✗ SMOKE TEST FAILED');
        console.log('Fix issues before running load tests\n');
    }

    console.log('='.repeat(60) + '\n');

    return {
        'stdout': '',
    };
}
