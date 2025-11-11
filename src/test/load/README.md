# Load and Stress Testing

This directory contains load testing, stress testing, and chaos engineering tests for the URL Shortener system.

## ⚠️ CRITICAL: Server Must Be Running!

**Before running ANY tests, you MUST start the URL Shortener server:**

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Verify it's running
curl http://localhost:3000/health
# Expected: {"status":"healthy"}

# Then run tests in Terminal 2
npm run test:smoke
```

**Common Error:**
```
Error: "dial tcp 127.0.0.1:3000: connectex: No connection could be made"
```
This means the server is not running. Start it first!

## Prerequisites

### Install k6

**Windows:**
```powershell
choco install k6
```
Or download from: https://k6.io/docs/get-started/installation/

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Scenarios

### 1. Load Tests (`load-test.js`)
Tests system performance under expected load:
- URL creation: 100,000 req/sec target
- URL redirects: 1,000,000 req/sec target
- Verifies p99 latency < 100ms
- Duration: 10 minutes

**Run:**
```bash
k6 run src/test/load/load-test.js
```

### 2. Stress Tests (`stress-test.js`)
Gradually increases load to find breaking points:
- Ramps up from 0 to maximum load
- Identifies system bottlenecks
- Tests recovery after overload
- Duration: 30 minutes

**Run:**
```bash
k6 run src/test/load/stress-test.js
```

### 3. Spike Tests (`spike-test.js`)
Tests system behavior under sudden traffic spikes:
- Sudden 10x traffic increase
- Verifies auto-scaling triggers
- Tests graceful degradation
- Duration: 15 minutes

**Run:**
```bash
k6 run src/test/load/spike-test.js
```

### 4. Soak Tests (`soak-test.js`)
Tests system stability over extended periods:
- Moderate load for extended duration
- Identifies memory leaks
- Tests resource exhaustion
- Duration: 2 hours

**Run:**
```bash
k6 run src/test/load/soak-test.js
```

### 5. Chaos Tests (`chaos-test.js`)
Tests system resilience to failures:
- Database failover scenarios
- Cache cluster failures
- Network partitions
- Verifies graceful degradation

**Run:**
```bash
node src/test/load/chaos-test.js
```

## Configuration

Edit the `config.js` file to adjust:
- Target URL
- Load levels
- Test duration
- Thresholds

## Interpreting Results

### Key Metrics

**Response Time:**
- p95 < 50ms: Excellent
- p95 < 100ms: Good
- p95 < 200ms: Acceptable
- p95 > 200ms: Needs optimization

**Error Rate:**
- < 0.1%: Excellent
- < 1%: Good
- < 5%: Acceptable
- > 5%: Critical issue

**Throughput:**
- URL Creation: Target 100,000 req/sec
- URL Redirects: Target 1,000,000 req/sec

### Thresholds

Tests will fail if:
- Error rate > 1%
- p99 latency > 100ms for redirects
- p99 latency > 200ms for URL creation
- HTTP failures > 1%

## Reports

k6 generates detailed reports including:
- Request rate over time
- Response time percentiles
- Error rates
- Custom metrics

Export results to JSON:
```bash
k6 run --out json=results.json src/test/load/load-test.js
```

Export to InfluxDB for visualization:
```bash
k6 run --out influxdb=http://localhost:8086/k6 src/test/load/load-test.js
```

## Best Practices

1. **Start Small**: Begin with smoke tests before full load tests
2. **Monitor Resources**: Watch CPU, memory, disk I/O during tests
3. **Isolate Tests**: Run tests in isolated environment
4. **Baseline First**: Establish baseline performance before changes
5. **Incremental Load**: Gradually increase load to identify limits
6. **Clean Data**: Reset test data between runs for consistency

## Troubleshooting

**Connection Refused:**
- Ensure server is running
- Check BASE_URL in config.js

**High Error Rates:**
- Check server logs
- Verify database/cache connectivity
- Monitor resource utilization

**Timeouts:**
- Increase timeout in k6 options
- Check network latency
- Verify server capacity

## CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run Load Tests
  run: |
    k6 run --quiet --no-color src/test/load/load-test.js
```

## Performance Targets

Based on requirements:

| Metric | Target | Critical |
|--------|--------|----------|
| URL Creation Rate | 100,000 req/s | 50,000 req/s |
| Redirect Rate | 1,000,000 req/s | 500,000 req/s |
| p99 Latency (Redirect) | < 50ms | < 100ms |
| p99 Latency (Creation) | < 100ms | < 200ms |
| Error Rate | < 0.1% | < 1% |
| Cache Hit Ratio | > 99% | > 95% |
| Uptime | 99.99% | 99.9% |
