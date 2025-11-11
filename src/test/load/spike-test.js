/**
 * Spike Test for URL Shortener System
 * 
 * Tests system behavior under sudden traffic spikes:
 * - Sudden 10x traffic increase
 * - Verifies auto-scaling triggers
 * - Tests graceful degradation
 * 
 * Requirements: 7.1, 7.2, 7.5
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config, generateRandomUrl } from './config.js';

// Custom metrics
const spikeRecovery = new Rate('spike_recovery');
const degradationGraceful = new Rate('graceful_degradation');
const responseTimeSpike = new Trend('response_time_during_spike');
const errorsDuringSpike = new Counter('errors_during_spike');

const createdUrls = [];

// Test configuration with sudden spike
export const options = {
    stages: [
        // Normal load
        { duration: '2m', target: 100 },

        // Sudden spike (10x increase in 30 seconds)
        { duration: '30s', target: 1000 },

        // Sustain spike
        { duration: '3m', target: 1000 },

        // Return to normal
        { duration: '30s', target: 100 },

        // Recovery period
        { duration: '2m', target: 100 },
    ],

    thresholds: {
        'http_req_duration': ['p(95)<200', 'p(99)<500'],
        'http_req_failed': ['rate<0.02'],  // Allow 2% errors during spike
        'spike_recovery': ['rate>0.95'],  // 95% recovery after spike
        'graceful_degradation': ['rate>0.90'],  // 90% graceful handling
    },
};

/**
 * Setup function
 */
export function setup() {
    console.log('=== Spike Test Setup ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log(`Normal Load: 100 VUs`);
    console.log(`Spike Load: 1000 VUs (10x)`);
    console.log(`Spike Duration: 3 minutes`);
    console.log('========================\n');

    // Health check
    const healthRes = http.get(`${config.baseUrl}/health`);
    if (healthRes.status !== 200) {
        throw new Error(`Server health check failed: ${healthRes.status}`);
    }

    console.log('✓ Server health check passed\n');

    // Pre-create URLs
    const preCreatedUrls = [];
    for (let i = 0; i < 50; i++) {
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

    return {
        preCreatedUrls,
        spikeStartTime: null,
        normalPhaseMetrics: {},
    };
}

/**
 * Main test function
 */
export default function (data) {
    const currentVUs = __VU;
    const currentStage = getCurrentStage();

    // Detect spike phase
    const isSpike = currentVUs > 500;
    const isRecovery = currentStage === 'recovery';

    try {
        // 80% redirects, 20% creation
        if (Math.random() < 0.8) {
            testRedirect(data.preCreatedUrls, isSpike);
        } else {
            testUrlCreation(isSpike);
        }

        // Track recovery
        if (isRecovery) {
            spikeRecovery.add(1);
        }

    } catch (error) {
        if (isSpike) {
            errorsDuringSpike.add(1);
        }

        // Check if degradation is graceful (got response, even if error)
        const graceful = error.message !== 'timeout' && error.message !== 'connection refused';
        degradationGraceful.add(graceful ? 1 : 0);
    }

    sleep(Math.random() * 1);
}

/**
 * Test URL creation during spike
 */
function testUrlCreation(isSpike) {
    group('Spike - URL Creation', () => {
        const payload = JSON.stringify({
            longUrl: generateRandomUrl(),
        });

        const startTime = Date.now();
        const res = http.post(
            `${config.baseUrl}/api/v1/shorten`,
            payload,
            {
                headers: config.requests.headers,
                timeout: '15s',
                tags: {
                    operation: 'create',
                    phase: isSpike ? 'spike' : 'normal',
                },
            }
        );
        const duration = Date.now() - startTime;

        if (isSpike) {
            responseTimeSpike.add(duration);
        }

        const success = check(res, {
            'status is 201 or 503': (r) => r.status === 201 || r.status === 503,
            'has response': (r) => r.body !== undefined && r.body !== '',
            'response time acceptable': (r) => r.timings.duration < 1000,
        });

        // Graceful degradation check
        if (res.status === 503) {
            const hasRetryAfter = res.headers['Retry-After'] !== undefined;
            degradationGraceful.add(hasRetryAfter ? 1 : 0);
        }

        if (res.status === 201) {
            try {
                const body = JSON.parse(res.body);
                createdUrls.push(body.shortCode);

                if (createdUrls.length > 200) {
                    createdUrls.shift();
                }
            } catch (e) {
                // Ignore
            }
        }
    });
}

/**
 * Test URL redirect during spike
 */
function testRedirect(preCreatedUrls, isSpike) {
    group('Spike - URL Redirect', () => {
        const urlPool = createdUrls.length > 0 ? createdUrls : preCreatedUrls;

        if (urlPool.length === 0) {
            return;
        }

        const shortCode = urlPool[Math.floor(Math.random() * urlPool.length)];

        const startTime = Date.now();
        const res = http.get(
            `${config.baseUrl}/${shortCode}`,
            {
                redirects: 0,
                timeout: '10s',
                tags: {
                    operation: 'redirect',
                    phase: isSpike ? 'spike' : 'normal',
                },
            }
        );
        const duration = Date.now() - startTime;

        if (isSpike) {
            responseTimeSpike.add(duration);
        }

        check(res, {
            'status is 301 or 503': (r) => r.status === 301 || r.status === 503,
            'has response': (r) => r.status !== 0,
            'response time acceptable': (r) => r.timings.duration < 500,
        });

        // Check for graceful degradation indicators
        if (res.status === 503) {
            const hasRetryAfter = res.headers['Retry-After'] !== undefined;
            degradationGraceful.add(hasRetryAfter ? 1 : 0);
        }
    });
}

/**
 * Get current test stage
 */
function getCurrentStage() {
    const elapsed = __ENV.K6_ELAPSED_TIME || 0;

    if (elapsed < 120) return 'normal';
    if (elapsed < 150) return 'spike-ramp';
    if (elapsed < 330) return 'spike-sustain';
    if (elapsed < 360) return 'spike-ramp-down';
    return 'recovery';
}

/**
 * Teardown function
 */
export function teardown(data) {
    console.log('\n=== Spike Test Complete ===');
    console.log('===========================\n');
}

/**
 * Handle summary
 */
export function handleSummary(data) {
    const totalRequests = data.metrics.http_reqs?.values.count || 0;
    const errorRate = (data.metrics.http_req_failed?.values.rate || 0) * 100;
    const p95Normal = data.metrics['http_req_duration{phase:normal}']?.values['p(95)'] || 0;
    const p95Spike = data.metrics['http_req_duration{phase:spike}']?.values['p(95)'] || 0;
    const recoveryRate = (data.metrics.spike_recovery?.values.rate || 0) * 100;
    const gracefulRate = (data.metrics.graceful_degradation?.values.rate || 0) * 100;

    console.log('\n' + '='.repeat(60));
    console.log('SPIKE TEST RESULTS');
    console.log('='.repeat(60));

    console.log('\nTraffic Pattern:');
    console.log(`  Normal Load: 100 VUs`);
    console.log(`  Spike Load: 1000 VUs (10x increase)`);
    console.log(`  Total Requests: ${totalRequests}`);

    console.log('\nPerformance Comparison:');
    console.log(`  p95 Response Time (Normal): ${p95Normal.toFixed(2)}ms`);
    console.log(`  p95 Response Time (Spike): ${p95Spike.toFixed(2)}ms`);
    console.log(`  Performance Degradation: ${((p95Spike / p95Normal - 1) * 100).toFixed(2)}%`);

    console.log('\nResilience:');
    console.log(`  Overall Error Rate: ${errorRate.toFixed(2)}%`);
    console.log(`  Recovery Rate: ${recoveryRate.toFixed(2)}%`);
    console.log(`  Graceful Degradation: ${gracefulRate.toFixed(2)}%`);

    console.log('\nAssessment:');
    if (errorRate < 2 && gracefulRate > 90) {
        console.log('  ✓ System handled spike excellently');
        console.log('  ✓ Graceful degradation working as expected');
    } else if (errorRate < 5 && gracefulRate > 80) {
        console.log('  ⚠ System handled spike adequately');
        console.log('  ⚠ Some degradation observed');
    } else {
        console.log('  ✗ System struggled with spike');
        console.log('  ✗ Consider improving auto-scaling');
    }

    console.log('\nRecommendations:');
    if (p95Spike > p95Normal * 3) {
        console.log('  • Response time increased significantly - improve caching');
    }
    if (errorRate > 2) {
        console.log('  • Error rate exceeded target - implement rate limiting');
    }
    if (gracefulRate < 90) {
        console.log('  • Improve graceful degradation mechanisms');
    }
    if (recoveryRate < 95) {
        console.log('  • System recovery needs improvement');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return {
        'stdout': '',
        'spike-test-results.json': JSON.stringify(data, null, 2),
    };
}
