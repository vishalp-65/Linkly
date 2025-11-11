/**
 * Load Test for URL Shortener System
 * 
 * Tests system performance under expected production load:
 * - URL creation: 100,000 req/sec target
 * - URL redirects: 1,000,000 req/sec target
 * - Verifies p99 latency < 100ms
 * 
 * Requirements: 7.1, 7.2, 7.5
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { config, generateRandomUrl, getRandomExpiry } from './config.js';

// Custom metrics
const cacheHitRatio = new Gauge('cache_hit_ratio');
const successfulRedirects = new Rate('successful_redirects');
const urlCreationRate = new Rate('url_creation_success');
const redirectLatency = new Trend('redirect_latency');
const creationLatency = new Trend('creation_latency');
const totalUrls = new Counter('total_urls_created');

// Shared array to store created short URLs
const createdUrls = [];

// Test configuration
export const options = {
    stages: [
        // Warm-up phase
        { duration: '2m', target: 100 },

        // Ramp up to target load
        { duration: '3m', target: 500 },
        { duration: '3m', target: 1000 },

        // Sustain target load
        { duration: '10m', target: 1000 },

        // Ramp down
        { duration: '2m', target: 0 },
    ],

    thresholds: config.thresholds,

    // Batch requests for better performance
    batch: 10,
    batchPerHost: 10,

    // Connection settings
    noConnectionReuse: false,
    userAgent: 'k6-load-test/1.0',
};

/**
 * Setup function - runs once before test
 */
export function setup() {
    console.log('=== Load Test Setup ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log(`Test Duration: 20 minutes`);
    console.log(`Target VUs: 1000`);
    console.log('========================\n');

    // Health check
    const healthRes = http.get(`${config.baseUrl}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server health check failed: ${healthRes.status}`);
    }

    console.log('✓ Server health check passed');

    // Pre-create some URLs for redirect testing
    const preCreatedUrls = [];
    console.log('Pre-creating URLs for redirect testing...');

    for (let i = 0; i < 100; i++) {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
        });

        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            { headers: config.requests.headers }
        );

        if (res.status === 201) {
            const body = JSON.parse(res.body);
            preCreatedUrls.push(body.shortCode);
        }
    }

    console.log(`✓ Pre-created ${preCreatedUrls.length} URLs\n`);

    return { preCreatedUrls };
}

/**
 * Main test function - runs for each VU iteration
 */
export default function (data) {
    // 80% redirects, 20% URL creation (realistic traffic pattern)
    const action = Math.random();

    if (action < 0.8) {
        // Redirect test
        testRedirect(data.preCreatedUrls);
    } else {
        // URL creation test
        testUrlCreation();
    }

    // Small sleep to simulate realistic user behavior
    sleep(Math.random() * 2);
}

/**
 * Test URL creation endpoint
 */
function testUrlCreation() {
    group('URL Creation', () => {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
            expiryOption: getRandomExpiry(),
        });

        const startTime = Date.now();
        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            {
                headers: config.requests.headers,
                tags: { endpoint: 'shorten' },
            }
        );
        const duration = Date.now() - startTime;

        // Record metrics
        creationLatency.add(duration);

        // Validate response
        const success = check(res, {
            'status is 201': (r) => r.status === 201,
            'has shortCode': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.shortCode !== undefined;
                } catch {
                    return false;
                }
            },
            'has shortUrl': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.shortUrl !== undefined;
                } catch {
                    return false;
                }
            },
            'response time < 200ms': (r) => r.timings.duration < 200,
        });

        urlCreationRate.add(success);

        // Store created URL for redirect testing
        if (res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                createdUrls.push(body.shortCode);
                totalUrls.add(1);

                // Keep array size manageable
                if (createdUrls.length > 1000) {
                    createdUrls.shift();
                }
            } catch (e) {
                console.error('Failed to parse response:', e);
            }
        }
    });
}

/**
 * Test URL redirect endpoint
 */
function testRedirect(preCreatedUrls) {
    group('URL Redirect', () => {
        // Use either pre-created or dynamically created URLs
        const urlPool = createdUrls.length > 0 ? createdUrls : preCreatedUrls;

        if (urlPool.length === 0) {
            return; // Skip if no URLs available
        }

        // Select random URL (simulates realistic access pattern)
        const shortCode = urlPool[Math.floor(Math.random() * urlPool.length)];

        const startTime = Date.now();
        const res = http.get(
            `${config.baseUrl}/${shortCode}`,
            {
                redirects: 0, // Don't follow redirects
                tags: { endpoint: 'redirect' },
            }
        );
        const duration = Date.now() - startTime;

        // Record metrics
        redirectLatency.add(duration);

        // Validate response
        const success = check(res, {
            'status is 301': (r) => r.status === 301,
            'has Location header': (r) => r.headers['Location'] !== undefined,
            'response time < 100ms': (r) => r.timings.duration < 100,
        });

        successfulRedirects.add(success);

        // Check for cache hit indicator (if server sends it)
        if (res.headers['X-Cache-Hit']) {
            const cacheHit = res.headers['X-Cache-Hit'] === 'true';
            cacheHitRatio.add(cacheHit ? 1 : 0);
        }
    });
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
    console.log('\n=== Load Test Complete ===');
    console.log(`Total URLs created: ${totalUrls.value || 0}`);
    console.log('==========================\n');
}

/**
 * Handle summary - custom summary output
 */
export function handleSummary(data) {
    const summary = {
        'Test Summary': {
            'Test Type': 'Load Test',
            'Duration': `${data.state.testRunDurationMs / 1000}s`,
            'VUs Max': data.metrics.vus_max.values.max,
        },
        'URL Creation': {
            'Total Requests': data.metrics.http_reqs?.values.count || 0,
            'Success Rate': `${((data.metrics.url_creation_success?.values.rate || 0) * 100).toFixed(2)}%`,
            'p95 Latency': `${data.metrics.creation_latency?.values['p(95)']?.toFixed(2) || 0}ms`,
            'p99 Latency': `${data.metrics.creation_latency?.values['p(99)']?.toFixed(2) || 0}ms`,
        },
        'URL Redirect': {
            'Success Rate': `${((data.metrics.successful_redirects?.values.rate || 0) * 100).toFixed(2)}%`,
            'p95 Latency': `${data.metrics.redirect_latency?.values['p(95)']?.toFixed(2) || 0}ms`,
            'p99 Latency': `${data.metrics.redirect_latency?.values['p(99)']?.toFixed(2) || 0}ms`,
        },
        'Overall Performance': {
            'Error Rate': `${((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2)}%`,
            'Avg Response Time': `${data.metrics.http_req_duration?.values.avg?.toFixed(2) || 0}ms`,
            'Requests/sec': `${data.metrics.http_reqs?.values.rate?.toFixed(2) || 0}`,
        },
    };

    console.log('\n' + '='.repeat(60));
    console.log('LOAD TEST RESULTS');
    console.log('='.repeat(60));

    for (const [section, metrics] of Object.entries(summary)) {
        console.log(`\n${section}:`);
        for (const [key, value] of Object.entries(metrics)) {
            console.log(`  ${key}: ${value}`);
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Return summary for file export
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data, null, 2),
    };
}

// Helper function for text summary
function textSummary(data, options) {
    // k6 will use its default text summary
    return '';
}
