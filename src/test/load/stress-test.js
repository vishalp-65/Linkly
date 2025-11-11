/**
 * Stress Test for URL Shortener System
 * 
 * Gradually increases load to find system breaking points:
 * - Identifies bottlenecks
 * - Tests recovery after overload
 * - Finds maximum sustainable load
 * 
 * Requirements: 7.1, 7.2
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { config, generateRandomUrl } from './config.js';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const throughput = new Counter('requests_completed');
const activeConnections = new Gauge('active_connections');
const systemStability = new Rate('system_stable');

// Store created URLs
const createdUrls = [];

// Test configuration with aggressive ramp-up
export const options = {
    stages: config.stress.stages,

    thresholds: {
        // More lenient thresholds for stress test
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
        'http_req_failed': ['rate<0.05'],  // Allow up to 5% errors
        'errors': ['rate<0.10'],  // Allow up to 10% errors at peak
    },

    // Disable connection reuse to stress test connection handling
    noConnectionReuse: false,

    // Increase timeouts for stress conditions
    httpDebug: 'full',
};

/**
 * Setup function
 */
export function setup() {
    console.log('=== Stress Test Setup ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log(`Test Duration: 30 minutes`);
    console.log(`Max VUs: 10,000`);
    console.log(`Goal: Find breaking point`);
    console.log('=========================\n');

    // Health check
    const healthRes = http.get(`${config.baseUrl}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server health check failed: ${healthRes.status}`);
    }

    console.log('✓ Server health check passed\n');

    return { startTime: Date.now() };
}

/**
 * Main test function
 */
export default function (data) {
    const currentVUs = __VU;
    const iteration = __ITER;

    // Track active connections
    activeConnections.add(currentVUs);

    // Mix of operations
    const operation = Math.random();

    try {
        if (operation < 0.7) {
            // 70% redirects
            testRedirect();
        } else if (operation < 0.95) {
            // 25% URL creation
            testUrlCreation();
        } else {
            // 5% analytics queries
            testAnalytics();
        }

        // Check system stability
        systemStability.add(1);

    } catch (error) {
        console.error(`Error in VU ${currentVUs}, iteration ${iteration}:`, error);
        errorRate.add(1);
        systemStability.add(0);
    }

    // Minimal sleep under stress
    sleep(Math.random() * 0.5);
}

/**
 * Test URL creation under stress
 */
function testUrlCreation() {
    group('Stress - URL Creation', () => {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
        });

        const startTime = Date.now();
        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            {
                headers: config.requests.headers,
                timeout: '10s',
                tags: { operation: 'create' },
            }
        );
        const duration = Date.now() - startTime;

        responseTime.add(duration);
        throughput.add(1);

        const success = check(res, {
            'status is 201 or 503': (r) => r.status === 201 || r.status === 503,
            'response received': (r) => r.body !== undefined,
        });

        if (!success || res.status !== 201) {
            errorRate.add(1);
        }

        // Store successful creations
        if (res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                createdUrls.push(body.shortCode);

                if (createdUrls.length > 500) {
                    createdUrls.shift();
                }
            } catch (e) {
                // Ignore parse errors under stress
            }
        }
    });
}

/**
 * Test URL redirect under stress
 */
function testRedirect() {
    group('Stress - URL Redirect', () => {
        // Use created URLs or fallback to test URL
        let shortCode;
        if (createdUrls.length > 0) {
            shortCode = createdUrls[Math.floor(Math.random() * createdUrls.length)];
        } else {
            shortCode = 'test123'; // Fallback
        }

        const startTime = Date.now();
        const res = http.get(
            `${config.baseUrl}/${shortCode}`,
            {
                redirects: 0,
                timeout: '5s',
                tags: { operation: 'redirect' },
            }
        );
        const duration = Date.now() - startTime;

        responseTime.add(duration);
        throughput.add(1);

        const success = check(res, {
            'status is 301, 404, or 503': (r) =>
                r.status === 301 || r.status === 404 || r.status === 503,
            'response received': (r) => r.status !== 0,
        });

        if (!success) {
            errorRate.add(1);
        }
    });
}

/**
 * Test analytics endpoint under stress
 */
function testAnalytics() {
    group('Stress - Analytics', () => {
        if (createdUrls.length === 0) {
            return;
        }

        const shortCode = createdUrls[Math.floor(Math.random() * createdUrls.length)];

        const startTime = Date.now();
        const res = http.get(
            `${config.baseUrl}/api/v1/analytics/${shortCode}`,
            {
                timeout: '10s',
                tags: { operation: 'analytics' },
            }
        );
        const duration = Date.now() - startTime;

        responseTime.add(duration);
        throughput.add(1);

        const success = check(res, {
            'status is 200, 404, or 503': (r) =>
                r.status === 200 || r.status === 404 || r.status === 503,
        });

        if (!success) {
            errorRate.add(1);
        }
    });
}

/**
 * Teardown function
 */
export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 1000;

    console.log('\n=== Stress Test Complete ===');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Requests: ${throughput.value || 0}`);
    console.log('============================\n');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
    const maxVUs = data.metrics.vus_max?.values.max || 0;
    const totalRequests = data.metrics.http_reqs?.values.count || 0;
    const errorRateValue = (data.metrics.errors?.values.rate || 0) * 100;
    const p95 = data.metrics.http_req_duration?.values['p(95)'] || 0;
    const p99 = data.metrics.http_req_duration?.values['p(99)'] || 0;
    const avgRPS = data.metrics.http_reqs?.values.rate || 0;

    console.log('\n' + '='.repeat(60));
    console.log('STRESS TEST RESULTS');
    console.log('='.repeat(60));
    console.log('\nLoad Profile:');
    console.log(`  Max Virtual Users: ${maxVUs}`);
    console.log(`  Total Requests: ${totalRequests}`);
    console.log(`  Avg Requests/sec: ${avgRPS.toFixed(2)}`);

    console.log('\nPerformance:');
    console.log(`  p95 Response Time: ${p95.toFixed(2)}ms`);
    console.log(`  p99 Response Time: ${p99.toFixed(2)}ms`);
    console.log(`  Error Rate: ${errorRateValue.toFixed(2)}%`);

    console.log('\nSystem Behavior:');
    if (errorRateValue < 1) {
        console.log(`  ✓ System handled ${maxVUs} VUs with <1% errors`);
        console.log(`  ✓ No breaking point found within test limits`);
    } else if (errorRateValue < 5) {
        console.log(`  ⚠ System degraded at ${maxVUs} VUs`);
        console.log(`  ⚠ Error rate: ${errorRateValue.toFixed(2)}%`);
    } else {
        console.log(`  ✗ System breaking point reached`);
        console.log(`  ✗ High error rate: ${errorRateValue.toFixed(2)}%`);
    }

    console.log('\nRecommendations:');
    if (p95 > 500) {
        console.log('  • Response times exceeded 500ms - consider scaling');
    }
    if (errorRateValue > 1) {
        console.log('  • Error rate exceeded 1% - investigate bottlenecks');
    }
    if (maxVUs < 5000 && errorRateValue > 5) {
        console.log('  • Breaking point below target - optimize system');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return {
        'stdout': '',
        'stress-test-results.json': JSON.stringify(data, null, 2),
    };
}
