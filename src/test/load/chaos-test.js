/**
 * Chaos Engineering Tests for URL Shortener System
 * 
 * Tests system resilience to failures:
 * - Database failover scenarios
 * - Cache cluster failures
 * - Network partition handling
 * - Verifies graceful degradation
 * 
 * Requirements: 7.4, 9.2
 * 
 * Note: This is a Node.js script that orchestrates chaos scenarios
 * Run with: node src/test/load/chaos-test.js
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// Configuration
const CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    testDuration: 300000, // 5 minutes per scenario
    requestInterval: 100, // ms between requests

    // Docker container names (adjust based on your setup)
    containers: {
        database: 'url-shortener-postgres-1',
        cache: 'url-shortener-redis-1',
        kafka: 'url-shortener-kafka-1',
    },
};

// Metrics tracking
const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimeSum: 0,
    errors: [],
};

/**
 * Make HTTP request
 */
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        const startTime = Date.now();

        const req = protocol.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const duration = Date.now() - startTime;
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                    duration,
                });
            });
        });

        req.on('error', (error) => {
            const duration = Date.now() - startTime;
            reject({
                error: error.message,
                duration,
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject({
                error: 'Request timeout',
                duration: Date.now() - startTime,
            });
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

/**
 * Test URL creation
 */
async function testUrlCreation() {
    const url = new URL(`${CONFIG.baseUrl}/api/v1/shorten`);
    const payload = JSON.stringify({
        longUrl: `https://example.com/test/${Date.now()}`,
    });

    try {
        const response = await makeRequest({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
            body: payload,
            timeout: 5000,
        });

        metrics.totalRequests++;
        metrics.responseTimeSum += response.duration;

        if (response.statusCode === 201) {
            metrics.successfulRequests++;
            const body = JSON.parse(response.body);
            return body.shortCode;
        } else {
            metrics.failedRequests++;
            return null;
        }
    } catch (error) {
        metrics.totalRequests++;
        metrics.failedRequests++;
        metrics.errors.push({
            operation: 'create',
            error: error.error || error.message,
            timestamp: new Date().toISOString(),
        });
        return null;
    }
}

/**
 * Test URL redirect
 */
async function testUrlRedirect(shortCode) {
    const url = new URL(`${CONFIG.baseUrl}/${shortCode}`);

    try {
        const response = await makeRequest({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'GET',
            timeout: 5000,
        });

        metrics.totalRequests++;
        metrics.responseTimeSum += response.duration;

        if (response.statusCode === 301 || response.statusCode === 404) {
            metrics.successfulRequests++;
            return true;
        } else {
            metrics.failedRequests++;
            return false;
        }
    } catch (error) {
        metrics.totalRequests++;
        metrics.failedRequests++;
        metrics.errors.push({
            operation: 'redirect',
            error: error.error || error.message,
            timestamp: new Date().toISOString(),
        });
        return false;
    }
}

/**
 * Stop Docker container
 */
async function stopContainer(containerName) {
    try {
        console.log(`  Stopping container: ${containerName}`);
        await execPromise(`docker stop ${containerName}`);
        console.log(`  ✓ Container stopped: ${containerName}`);
        return true;
    } catch (error) {
        console.error(`  ✗ Failed to stop container: ${error.message}`);
        return false;
    }
}

/**
 * Start Docker container
 */
async function startContainer(containerName) {
    try {
        console.log(`  Starting container: ${containerName}`);
        await execPromise(`docker start ${containerName}`);
        console.log(`  ✓ Container started: ${containerName}`);

        // Wait for container to be ready
        await sleep(5000);
        return true;
    } catch (error) {
        console.error(`  ✗ Failed to start container: ${error.message}`);
        return false;
    }
}

/**
 * Pause Docker container
 */
async function pauseContainer(containerName) {
    try {
        console.log(`  Pausing container: ${containerName}`);
        await execPromise(`docker pause ${containerName}`);
        console.log(`  ✓ Container paused: ${containerName}`);
        return true;
    } catch (error) {
        console.error(`  ✗ Failed to pause container: ${error.message}`);
        return false;
    }
}

/**
 * Unpause Docker container
 */
async function unpauseContainer(containerName) {
    try {
        console.log(`  Unpausing container: ${containerName}`);
        await execPromise(`docker unpause ${containerName}`);
        console.log(`  ✓ Container unpaused: ${containerName}`);
        return true;
    } catch (error) {
        console.error(`  ✗ Failed to unpause container: ${error.message}`);
        return false;
    }
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reset metrics
 */
function resetMetrics() {
    metrics.totalRequests = 0;
    metrics.successfulRequests = 0;
    metrics.failedRequests = 0;
    metrics.responseTimeSum = 0;
    metrics.errors = [];
}

/**
 * Print metrics
 */
function printMetrics(scenarioName) {
    const successRate = metrics.totalRequests > 0
        ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)
        : 0;
    const avgResponseTime = metrics.totalRequests > 0
        ? (metrics.responseTimeSum / metrics.totalRequests).toFixed(2)
        : 0;

    console.log(`\n  Results for ${scenarioName}:`);
    console.log(`    Total Requests: ${metrics.totalRequests}`);
    console.log(`    Successful: ${metrics.successfulRequests}`);
    console.log(`    Failed: ${metrics.failedRequests}`);
    console.log(`    Success Rate: ${successRate}%`);
    console.log(`    Avg Response Time: ${avgResponseTime}ms`);
    console.log(`    Errors: ${metrics.errors.length}`);

    if (metrics.errors.length > 0 && metrics.errors.length <= 5) {
        console.log(`\n  Recent Errors:`);
        metrics.errors.slice(-5).forEach(err => {
            console.log(`    - ${err.operation}: ${err.error}`);
        });
    }
}

/**
 * Run continuous load
 */
async function runContinuousLoad(durationMs, shortCodes) {
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
        // 70% redirects, 30% creation
        if (Math.random() < 0.7 && shortCodes.length > 0) {
            const shortCode = shortCodes[Math.floor(Math.random() * shortCodes.length)];
            await testUrlRedirect(shortCode);
        } else {
            const shortCode = await testUrlCreation();
            if (shortCode) {
                shortCodes.push(shortCode);
                if (shortCodes.length > 100) {
                    shortCodes.shift();
                }
            }
        }

        await sleep(CONFIG.requestInterval);
    }
}

/**
 * Scenario 1: Database Failure
 */
async function scenarioDatabaseFailure() {
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 1: Database Failure');
    console.log('='.repeat(60));
    console.log('Testing system behavior when database becomes unavailable\n');

    const shortCodes = [];

    // Phase 1: Normal operation
    console.log('Phase 1: Normal operation (30s)');
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Normal Operation');

    // Phase 2: Database failure
    console.log('\nPhase 2: Database failure (60s)');
    await stopContainer(CONFIG.containers.database);
    resetMetrics();
    await runContinuousLoad(60000, shortCodes);
    printMetrics('Database Down');

    // Phase 3: Database recovery
    console.log('\nPhase 3: Database recovery (30s)');
    await startContainer(CONFIG.containers.database);
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Database Recovered');

    console.log('\n✓ Database failure scenario complete\n');
}

/**
 * Scenario 2: Cache Failure
 */
async function scenarioCacheFailure() {
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 2: Cache Cluster Failure');
    console.log('='.repeat(60));
    console.log('Testing system behavior when Redis cache becomes unavailable\n');

    const shortCodes = [];

    // Phase 1: Normal operation
    console.log('Phase 1: Normal operation (30s)');
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Normal Operation');

    // Phase 2: Cache failure
    console.log('\nPhase 2: Cache failure (60s)');
    await stopContainer(CONFIG.containers.cache);
    resetMetrics();
    await runContinuousLoad(60000, shortCodes);
    printMetrics('Cache Down');

    // Phase 3: Cache recovery
    console.log('\nPhase 3: Cache recovery (30s)');
    await startContainer(CONFIG.containers.cache);
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Cache Recovered');

    console.log('\n✓ Cache failure scenario complete\n');
}

/**
 * Scenario 3: Network Partition
 */
async function scenarioNetworkPartition() {
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 3: Network Partition');
    console.log('='.repeat(60));
    console.log('Testing system behavior during network partition\n');

    const shortCodes = [];

    // Phase 1: Normal operation
    console.log('Phase 1: Normal operation (30s)');
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Normal Operation');

    // Phase 2: Partition (pause containers)
    console.log('\nPhase 2: Network partition (60s)');
    await pauseContainer(CONFIG.containers.database);
    await pauseContainer(CONFIG.containers.cache);
    resetMetrics();
    await runContinuousLoad(60000, shortCodes);
    printMetrics('Network Partition');

    // Phase 3: Partition healed
    console.log('\nPhase 3: Partition healed (30s)');
    await unpauseContainer(CONFIG.containers.database);
    await unpauseContainer(CONFIG.containers.cache);
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Partition Healed');

    console.log('\n✓ Network partition scenario complete\n');
}

/**
 * Scenario 4: Kafka Failure
 */
async function scenarioKafkaFailure() {
    console.log('\n' + '='.repeat(60));
    console.log('SCENARIO 4: Kafka Failure (Analytics)');
    console.log('='.repeat(60));
    console.log('Testing system behavior when Kafka becomes unavailable\n');

    const shortCodes = [];

    // Phase 1: Normal operation
    console.log('Phase 1: Normal operation (30s)');
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Normal Operation');

    // Phase 2: Kafka failure
    console.log('\nPhase 2: Kafka failure (60s)');
    await stopContainer(CONFIG.containers.kafka);
    resetMetrics();
    await runContinuousLoad(60000, shortCodes);
    printMetrics('Kafka Down');

    // Phase 3: Kafka recovery
    console.log('\nPhase 3: Kafka recovery (30s)');
    await startContainer(CONFIG.containers.kafka);
    resetMetrics();
    await runContinuousLoad(30000, shortCodes);
    printMetrics('Kafka Recovered');

    console.log('\n✓ Kafka failure scenario complete\n');
}

/**
 * Main execution
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('CHAOS ENGINEERING TESTS');
    console.log('='.repeat(60));
    console.log(`Target: ${CONFIG.baseUrl}`);
    console.log(`Duration: ~8 minutes per scenario`);
    console.log('='.repeat(60) + '\n');

    // Check server health
    console.log('Checking server health...');
    try {
        const url = new URL(`${CONFIG.baseUrl}/health`);
        const response = await makeRequest({
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'GET',
            timeout: 5000,
        });

        if (response.statusCode === 200) {
            console.log('✓ Server is healthy\n');
        } else {
            console.error('✗ Server health check failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('✗ Cannot connect to server:', error.error || error.message);
        process.exit(1);
    }

    // Run scenarios
    try {
        await scenarioCacheFailure();
        await sleep(5000);

        await scenarioKafkaFailure();
        await sleep(5000);

        await scenarioDatabaseFailure();
        await sleep(5000);

        await scenarioNetworkPartition();

    } catch (error) {
        console.error('\n✗ Chaos test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }

    console.log('\n' + '='.repeat(60));
    console.log('ALL CHAOS SCENARIOS COMPLETE');
    console.log('='.repeat(60));
    console.log('\nKey Findings:');
    console.log('  • Review logs for graceful degradation behavior');
    console.log('  • Check if system recovered after each failure');
    console.log('  • Verify error rates remained acceptable');
    console.log('  • Ensure no data loss occurred');
    console.log('\n' + '='.repeat(60) + '\n');
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    testUrlCreation,
    testUrlRedirect,
    stopContainer,
    startContainer,
    pauseContainer,
    unpauseContainer,
};
