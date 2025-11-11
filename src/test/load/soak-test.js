/**
 * Soak Test for URL Shortener System
 * 
 * Tests system stability over extended periods:
 * - Moderate load for 2 hours
 * - Identifies memory leaks
 * - Tests resource exhaustion
 * - Verifies long-term stability
 * 
 * Requirements: 7.1, 7.2, 7.5
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { config, generateRandomUrl } from './config.js';

// Custom metrics for soak test
const memoryLeakIndicator = new Trend('memory_leak_indicator');
const responseTimeDrift = new Trend('response_time_drift');
const errorRateOverTime = new Rate('error_rate_over_time');
const resourceExhaustion = new Counter('resource_exhaustion_events');
const systemStability = new Gauge('system_stability_score');

const createdUrls = [];
let baselineResponseTime = 0;
let iterationCount = 0;

// Soak test configuration - 2 hours of sustained load
export const options = {
    stages: config.soak.stages,

    thresholds: {
        'http_req_duration': ['p(95)<150', 'p(99)<300'],
        'http_req_failed': ['rate<0.01'],  // Very strict for soak test
        'error_rate_over_time': ['rate<0.01'],
        'response_time_drift': ['p(95)<50'],  // Response time shouldn't drift more than 50ms
    },

    // Extended timeouts for long-running test
    setupTimeout: '60s',
    teardownTimeout: '60s',
};

/**
 * Setup function
 */
export function setup() {
    console.log('=== Soak Test Setup ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log(`Test Duration: 2 hours 10 minutes`);
    console.log(`Sustained Load: 500 VUs`);
    console.log(`Goal: Identify memory leaks and resource exhaustion`);
    console.log('=======================\n');

    // Health check
    const healthRes = http.get(`${config.baseUrl}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server health check failed: ${healthRes.status}`);
    }

    console.log('✓ Server health check passed');

    // Pre-create URLs
    const preCreatedUrls = [];
    console.log('Pre-creating URLs for soak testing...');

    for (let i = 0; i < 200; i++) {
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

    console.log(`✓ Pre-created ${preCreatedUrls.length} URLs`);

    // Establish baseline
    console.log('Establishing baseline performance...');
    let totalTime = 0;
    let successCount = 0;

    for (let i = 0; i < 10; i++) {
        const shortCode = preCreatedUrls[Math.floor(Math.random() * preCreatedUrls.length)];
        const res = http.get(`${config.baseUrl}/${shortCode}`, { redirects: 0 });

        if (res.status === 301) {
            totalTime += res.timings.duration;
            successCount++;
        }
    }

    const baseline = successCount > 0 ? totalTime / successCount : 50;
    console.log(`✓ Baseline response time: ${baseline.toFixed(2)}ms\n`);

    return {
        preCreatedUrls,
        baselineResponseTime: baseline,
        startTime: Date.now(),
    };
}

/**
 * Main test function
 */
export default function (data) {
    iterationCount++;

    // Calculate elapsed time
    const elapsedMinutes = (Date.now() - data.startTime) / 60000;

    // Vary traffic pattern over time
    const operation = Math.random();

    try {
        if (operation < 0.75) {
            // 75% redirects
            testRedirect(data.preCreatedUrls, data.baselineResponseTime);
        } else if (operation < 0.95) {
            // 20% URL creation
            testUrlCreation(data.baselineResponseTime);
        } else {
            // 5% analytics
            testAnalytics();
        }

        // Calculate stability score (decreases with errors and drift)
        const currentStability = 100 - (errorRateOverTime.rate * 100);
        systemStability.add(currentStability);

    } catch (error) {
        errorRateOverTime.add(1);

        // Check for resource exhaustion indicators
        if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
            resourceExhaustion.add(1);
        }
    }

    // Log progress every 10 minutes
    if (iterationCount % 1000 === 0) {
        console.log(`Soak test progress: ${elapsedMinutes.toFixed(1)} minutes elapsed`);
    }

    // Realistic user think time
    sleep(Math.random() * 3);
}

/**
 * Test URL creation
 */
function testUrlCreation(baselineResponseTime) {
    group('Soak - URL Creation', () => {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
        });

        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            {
                headers: config.requests.headers,
                timeout: '20s',
                tags: { operation: 'create' },
            }
        );

        // Check for response time drift
        const drift = res.timings.duration - (baselineResponseTime * 2); // Allow 2x baseline for creation
        if (drift > 0) {
            responseTimeDrift.add(drift);
        }

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
            'no timeout': (r) => r.timings.duration < 10000,
        });

        if (!success) {
            errorRateOverTime.add(1);
        }

        // Store created URL
        if (res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                createdUrls.push(body.shortCode);

                // Maintain reasonable array size
                if (createdUrls.length > 500) {
                    createdUrls.shift();
                }
            } catch (e) {
                // Ignore
            }
        }
    });
}

/**
 * Test URL redirect
 */
function testRedirect(preCreatedUrls, baselineResponseTime) {
    group('Soak - URL Redirect', () => {
        const urlPool = createdUrls.length > 0 ? createdUrls : preCreatedUrls;

        if (urlPool.length === 0) {
            return;
        }

        const shortCode = urlPool[Math.floor(Math.random() * urlPool.length)];

        const res = http.get(
            `${config.baseUrl}/${shortCode}`,
            {
                redirects: 0,
                timeout: '10s',
                tags: { operation: 'redirect' },
            }
        );

        // Check for response time drift (memory leak indicator)
        const drift = res.timings.duration - baselineResponseTime;
        if (drift > 0) {
            responseTimeDrift.add(drift);

            // Significant drift might indicate memory leak
            if (drift > baselineResponseTime * 2) {
                memoryLeakIndicator.add(drift);
            }
        }

        const success = check(res, {
            'status is 301': (r) => r.status === 301,
            'has Location header': (r) => r.headers['Location'] !== undefined,
            'no timeout': (r) => r.timings.duration < 5000,
            'response time stable': (r) => r.timings.duration < baselineResponseTime * 3,
        });

        if (!success) {
            errorRateOverTime.add(1);
        }
    });
}

/**
 * Test analytics endpoint
 */
function testAnalytics() {
    group('Soak - Analytics', () => {
        if (createdUrls.length === 0) {
            return;
        }

        const shortCode = createdUrls[Math.floor(Math.random() * createdUrls.length)];

        const res = http.get(
            `${config.baseUrl}/api/v1/analytics/${shortCode}`,
            {
                timeout: '15s',
                tags: { operation: 'analytics' },
            }
        );

        check(res, {
            'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
            'no timeout': (r) => r.timings.duration < 10000,
        });
    });
}

/**
 * Teardown function
 */
export function teardown(data) {
    const duration = (Date.now() - data.startTime) / 60000;

    console.log('\n=== Soak Test Complete ===');
    console.log(`Duration: ${duration.toFixed(2)} minutes`);
    console.log('==========================\n');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values.count || 0;
    const errorRate = (data.metrics.http_req_failed?.values.rate || 0) * 100;
    const avgResponseTime = data.metrics.http_req_duration?.values.avg || 0;
    const p95ResponseTime = data.metrics.http_req_duration?.values['p(95)'] || 0;
    const p99ResponseTime = data.metrics.http_req_duration?.values['p(99)'] || 0;
    const avgDrift = data.metrics.response_time_drift?.values.avg || 0;
    const maxDrift = data.metrics.response_time_drift?.values.max || 0;
    const stabilityScore = data.metrics.system_stability_score?.values.avg || 0;
    const resourceExhaustionEvents = data.metrics.resource_exhaustion_events?.values.count || 0;

    console.log('\n' + '='.repeat(60));
    console.log('SOAK TEST RESULTS');
    console.log('='.repeat(60));

    console.log('\nTest Configuration:');
    console.log(`  Duration: 2 hours`);
    console.log(`  Sustained Load: 500 VUs`);
    console.log(`  Total Requests: ${totalRequests.toLocaleString()}`);

    console.log('\nPerformance Metrics:');
    console.log(`  Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  p95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`  p99 Response Time: ${p99ResponseTime.toFixed(2)}ms`);
    console.log(`  Error Rate: ${errorRate.toFixed(3)}%`);

    console.log('\nStability Analysis:');
    console.log(`  Avg Response Time Drift: ${avgDrift.toFixed(2)}ms`);
    console.log(`  Max Response Time Drift: ${maxDrift.toFixed(2)}ms`);
    console.log(`  System Stability Score: ${stabilityScore.toFixed(2)}/100`);
    console.log(`  Resource Exhaustion Events: ${resourceExhaustionEvents}`);

    console.log('\nMemory Leak Assessment:');
    if (maxDrift < 50) {
        console.log('  ✓ No significant response time drift detected');
        console.log('  ✓ No memory leak indicators found');
    } else if (maxDrift < 200) {
        console.log('  ⚠ Moderate response time drift detected');
        console.log('  ⚠ Monitor memory usage over longer periods');
    } else {
        console.log('  ✗ Significant response time drift detected');
        console.log('  ✗ Possible memory leak - investigate immediately');
    }

    console.log('\nResource Exhaustion:');
    if (resourceExhaustionEvents === 0) {
        console.log('  ✓ No resource exhaustion detected');
    } else {
        console.log(`  ✗ ${resourceExhaustionEvents} resource exhaustion events`);
        console.log('  ✗ Review connection pools and resource limits');
    }

    console.log('\nOverall Assessment:');
    if (errorRate < 0.1 && maxDrift < 50 && stabilityScore > 95) {
        console.log('  ✓ System is stable for long-term operation');
        console.log('  ✓ No issues detected during 2-hour soak test');
    } else if (errorRate < 1 && maxDrift < 200 && stabilityScore > 90) {
        console.log('  ⚠ System is generally stable with minor issues');
        console.log('  ⚠ Monitor for degradation over longer periods');
    } else {
        console.log('  ✗ System stability concerns detected');
        console.log('  ✗ Not recommended for production without fixes');
    }

    console.log('\nRecommendations:');
    if (maxDrift > 100) {
        console.log('  • Investigate memory leaks in application code');
        console.log('  • Review garbage collection settings');
    }
    if (resourceExhaustionEvents > 0) {
        console.log('  • Increase connection pool sizes');
        console.log('  • Review resource cleanup in error paths');
    }
    if (errorRate > 0.1) {
        console.log('  • Investigate intermittent errors');
        console.log('  • Review error logs for patterns');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return {
        'stdout': '',
        'soak-test-results.json': JSON.stringify(data, null, 2),
    };
}
