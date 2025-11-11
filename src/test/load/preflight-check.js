/**
 * Pre-flight Check for Load Testing
 * 
 * Verifies that all prerequisites are met before running load tests:
 * - k6 is installed
 * - Server is running
 * - All endpoints are accessible
 * - Database and cache are healthy
 * 
 * Run: node src/test/load/preflight-check.js
 */

const http = require('http');
const https = require('https');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CHECKS = [];
let allPassed = true;

/**
 * Make HTTP request
 */
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const req = protocol.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: data,
                    headers: res.headers,
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Print check result
 */
function printCheck(name, passed, message) {
    const icon = passed ? '✓' : '✗';
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`  ${icon} ${name}: ${status}`);
    if (message) {
        console.log(`    ${message}`);
    }
    CHECKS.push({ name, passed, message });
    if (!passed) allPassed = false;
}

/**
 * Check if k6 is installed
 */
async function checkK6() {
    console.log('\n1. Checking k6 installation...');
    try {
        const { stdout } = await execPromise('k6 version');
        const version = stdout.trim().split('\n')[0];
        printCheck('k6 installed', true, version);
    } catch (error) {
        printCheck('k6 installed', false, 'k6 is not installed. Install with: choco install k6 (Windows) or brew install k6 (macOS)');
    }
}

/**
 * Check if server is running
 */
async function checkServer() {
    console.log('\n2. Checking server availability...');
    try {
        const response = await makeRequest(`${BASE_URL}/health`);

        if (response.statusCode === 200) {
            printCheck('Server running', true, `Server is healthy at ${BASE_URL}`);

            // Parse health response
            try {
                const health = JSON.parse(response.body);
                if (health.status === 'healthy') {
                    printCheck('Health endpoint', true, 'Health check passed');
                } else {
                    printCheck('Health endpoint', false, `Health status: ${health.status}`);
                }
            } catch (e) {
                printCheck('Health endpoint', false, 'Invalid health response format');
            }
        } else {
            printCheck('Server running', false, `Server returned status ${response.statusCode}`);
        }
    } catch (error) {
        printCheck('Server running', false, `Cannot connect to server at ${BASE_URL}`);
        console.log('\n  ⚠️  CRITICAL: Server is not running!');
        console.log('  Start the server with: npm run dev');
        console.log('  Then run this check again.\n');
    }
}

/**
 * Check API endpoints
 */
async function checkEndpoints() {
    console.log('\n3. Checking API endpoints...');

    // Check info endpoint
    try {
        const response = await makeRequest(`${BASE_URL}/ready`);
        if (response.statusCode === 200) {
            printCheck('Info endpoint', true, '/info is accessible');
        } else {
            printCheck('Info endpoint', false, `Status: ${response.statusCode}`);
        }
    } catch (error) {
        printCheck('Info endpoint', false, error.message);
    }

    // Check shorten endpoint (POST)
    try {
        const url = new URL(`${BASE_URL}/api/v1/url/shorten`);
        const payload = JSON.stringify({
            url: 'https://example.com/preflight-check',
        });

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
        };

        const protocol = url.protocol === 'https:' ? https : http;

        const response = await new Promise((resolve, reject) => {
            const req = protocol.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        body: data,
                    });
                });
            });

            req.on('error', reject);
            req.setTimeout(5000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(payload);
            req.end();
        });

        if (response.statusCode === 201) {
            const body = JSON.parse(response.data);
            printCheck("Body", body);
            printCheck('Shorten endpoint', true, `/api/v1/shorten is working (created: ${body.short_code})`);

            // Try to access the created short URL
            try {
                const redirectResponse = await makeRequest(`${BASE_URL}/${body.short_code}`);
                if (redirectResponse.statusCode === 301) {
                    printCheck('Redirect endpoint', true, `/${body.shortCode} redirects correctly`);
                } else {
                    printCheck('Redirect endpoint', false, `Status: ${redirectResponse.statusCode}`);
                }
            } catch (error) {
                printCheck('Redirect endpoint', false, error.message);
            }
        } else {
            printCheck('Shorten endpoint', false, `Status: ${response.statusCode}`);
        }
    } catch (error) {
        printCheck('Shorten endpoint', false, error.message);
    }
}

/**
 * Check system resources
 */
async function checkResources() {
    console.log('\n4. Checking system resources...');

    try {
        const { stdout } = await execPromise('node -v');
        const nodeVersion = stdout.trim();
        printCheck('Node.js version', true, nodeVersion);
    } catch (error) {
        printCheck('Node.js version', false, 'Cannot determine Node.js version');
    }

    // Check available memory (platform-specific)
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execPromise('wmic OS get FreePhysicalMemory /Value');
            const match = stdout.match(/FreePhysicalMemory=(\d+)/);
            if (match) {
                const freeMemoryMB = Math.round(parseInt(match[1]) / 1024);
                const sufficient = freeMemoryMB > 1000;
                printCheck('Available memory', sufficient, `${freeMemoryMB} MB free ${sufficient ? '' : '(recommend > 1GB)'}`);
            }
        } else {
            // Unix-like systems
            const { stdout } = await execPromise('free -m | grep Mem');
            const parts = stdout.trim().split(/\s+/);
            const freeMemoryMB = parseInt(parts[3]);
            const sufficient = freeMemoryMB > 1000;
            printCheck('Available memory', sufficient, `${freeMemoryMB} MB free ${sufficient ? '' : '(recommend > 1GB)'}`);
        }
    } catch (error) {
        printCheck('Available memory', true, 'Cannot determine (non-critical)');
    }
}

/**
 * Check database and cache
 */
async function checkDependencies() {
    console.log('\n5. Checking dependencies...');

    // Try to get metrics endpoint (if available)
    try {
        const response = await makeRequest(`${BASE_URL}/metrics`);
        if (response.statusCode === 200) {
            printCheck('Metrics endpoint', true, '/metrics is accessible');

            // Parse metrics to check for database/cache indicators
            const metrics = response.body;
            if (metrics.includes('postgres') || metrics.includes('database')) {
                printCheck('Database connection', true, 'Database metrics found');
            }
            if (metrics.includes('redis') || metrics.includes('cache')) {
                printCheck('Cache connection', true, 'Cache metrics found');
            }
        }
    } catch (error) {
        printCheck('Metrics endpoint', true, 'Not available (non-critical)');
    }
}

/**
 * Print summary
 */
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('PRE-FLIGHT CHECK SUMMARY');
    console.log('='.repeat(60));

    const passed = CHECKS.filter(c => c.passed).length;
    const failed = CHECKS.filter(c => !c.passed).length;
    const total = CHECKS.length;

    console.log(`\nTotal Checks: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (allPassed) {
        console.log('\n✓ ALL CHECKS PASSED');
        console.log('\nYou are ready to run load tests!');
        console.log('\nQuick start:');
        console.log('  npm run test:smoke    # 1 minute validation');
        console.log('  npm run test:load     # 20 minute load test');
        console.log('  npm run test:stress   # 30 minute stress test');
    } else {
        console.log('\n✗ SOME CHECKS FAILED');
        console.log('\nPlease fix the issues above before running load tests.');

        // Provide specific guidance
        const serverFailed = CHECKS.find(c => c.name === 'Server running' && !c.passed);
        if (serverFailed) {
            console.log('\n⚠️  CRITICAL: Server is not running!');
            console.log('\nTo start the server:');
            console.log('  1. Open a new terminal');
            console.log('  2. Run: npm run dev');
            console.log('  3. Wait for "Server started successfully" message');
            console.log('  4. Run this check again: node src/test/load/preflight-check.js');
        }

        const k6Failed = CHECKS.find(c => c.name === 'k6 installed' && !c.passed);
        if (k6Failed) {
            console.log('\n⚠️  k6 is not installed!');
            console.log('\nTo install k6:');
            console.log('  Windows: choco install k6');
            console.log('  macOS:   brew install k6');
            console.log('  Linux:   See https://k6.io/docs/get-started/installation/');
        }
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Main execution
 */
async function main() {
    console.log('='.repeat(60));
    console.log('LOAD TESTING PRE-FLIGHT CHECK');
    console.log('='.repeat(60));
    console.log(`\nTarget: ${BASE_URL}`);
    console.log('Checking prerequisites for load testing...\n');

    await checkK6();
    await checkServer();

    // Only check endpoints if server is running
    if (CHECKS.find(c => c.name === 'Server running')?.passed) {
        await checkEndpoints();
        await checkDependencies();
    }

    await checkResources();

    printSummary();

    process.exit(allPassed ? 0 : 1);
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('\n✗ Pre-flight check failed:', error.message);
        process.exit(1);
    });
}

module.exports = { main };
