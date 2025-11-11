# Load and Stress Testing Guide

## Overview

This guide provides comprehensive instructions for running load tests, stress tests, and chaos engineering tests on the URL Shortener system. These tests validate that the system meets the performance requirements specified in the design document.

## Performance Requirements

Based on requirements 7.1, 7.2, 7.5, 9.2:

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| URL Creation Rate | 100,000 req/s | 50,000 req/s |
| Redirect Rate | 1,000,000 req/s | 500,000 req/s |
| p99 Latency (Redirect) | < 50ms | < 100ms |
| p99 Latency (Creation) | < 100ms | < 200ms |
| Error Rate | < 0.1% | < 1% |
| Cache Hit Ratio | > 99% | > 95% |
| Uptime | 99.99% | 99.9% |

## Prerequisites

### 1. Install k6

k6 is a modern load testing tool that we use for performance testing.

**Windows:**
```powershell
choco install k6
```

**macOS:**
```bash
brew install k6
```

**Linux (Debian/Ubuntu):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Verify installation:
```bash
k6 version
```

### 2. Start the Server

Ensure the URL Shortener server is running:

```bash
# Development mode
npm run dev

# Or production mode
npm run build
npm start
```

Verify the server is running:
```bash
curl http://localhost:3000/health
```

### 3. Prepare Infrastructure

For accurate load testing, ensure:
- Database (PostgreSQL) is running
- Cache (Redis) is running
- Kafka is running (optional, for analytics)
- All services have adequate resources

## Test Types

### 1. Smoke Test (1 minute)

Quick validation to ensure the system is ready for load testing.

**Purpose:**
- Verify all endpoints are accessible
- Test basic functionality
- Catch configuration issues early

**Run:**
```bash
npm run test:smoke
```

**Expected Results:**
- All checks pass (>95%)
- Error rate < 1%
- Response times < 500ms

### 2. Load Test (20 minutes)

Tests system performance under expected production load.

**Purpose:**
- Validate performance targets
- Measure response times under load
- Verify cache effectiveness

**Configuration:**
- Ramp up to 1,000 VUs
- Sustain load for 10 minutes
- 80% redirects, 20% URL creation

**Run:**
```bash
npm run test:load
```

**Expected Results:**
- p99 latency < 100ms for redirects
- p99 latency < 200ms for URL creation
- Error rate < 1%
- Cache hit ratio > 95%

### 3. Stress Test (30 minutes)

Gradually increases load to find system breaking points.

**Purpose:**
- Identify maximum capacity
- Find bottlenecks
- Test recovery after overload

**Configuration:**
- Ramp from 100 to 10,000 VUs
- Gradual increase over 25 minutes
- 5-minute recovery period

**Run:**
```bash
npm run test:stress
```

**Expected Results:**
- System handles at least 5,000 VUs
- Graceful degradation under extreme load
- Full recovery after load reduction

### 4. Spike Test (10 minutes)

Tests system behavior under sudden traffic spikes.

**Purpose:**
- Verify auto-scaling triggers
- Test graceful degradation
- Validate rate limiting

**Configuration:**
- Normal load: 100 VUs
- Spike to 1,000 VUs (10x) in 30 seconds
- Sustain spike for 3 minutes

**Run:**
```bash
npm run test:spike
```

**Expected Results:**
- Error rate < 2% during spike
- Graceful degradation > 90%
- Full recovery after spike

### 5. Soak Test (2+ hours)

Tests system stability over extended periods.

**Purpose:**
- Identify memory leaks
- Test resource exhaustion
- Verify long-term stability

**Configuration:**
- Sustain 500 VUs for 2 hours
- Monitor response time drift
- Track resource usage

**Run:**
```bash
npm run test:soak
```

**Expected Results:**
- Response time drift < 50ms
- No resource exhaustion
- Error rate < 0.1%
- System stability score > 95%

### 6. Chaos Engineering Tests (30 minutes)

Tests system resilience to infrastructure failures.

**Purpose:**
- Verify graceful degradation
- Test failover mechanisms
- Validate error handling

**Scenarios:**
1. Database failure
2. Cache cluster failure
3. Network partition
4. Kafka failure

**Run:**
```bash
npm run test:chaos
```

**Prerequisites:**
- Docker containers must be running
- Container names must match configuration

**Expected Results:**
- System continues operating during failures
- Graceful degradation mechanisms activate
- Full recovery after failure resolution

## Running All Tests

To run the complete test suite:

**Windows:**
```bash
src\test\load\run-all-tests.bat
```

**Unix/Linux/macOS:**
```bash
chmod +x src/test/load/run-all-tests.sh
./src/test/load/run-all-tests.sh
```

**Note:** The complete suite takes approximately 90 minutes (excluding soak test).

## Configuration

Edit `src/test/load/config.js` to customize:

```javascript
export const config = {
  // Target server
  baseUrl: 'http://localhost:3000',
  
  // Load targets
  targets: {
    urlCreation: {
      rps: 100000,
      p99Threshold: 100,
    },
    urlRedirect: {
      rps: 1000000,
      p99Threshold: 50,
    },
  },
  
  // Thresholds
  thresholds: {
    'http_req_duration': ['p(95)<100', 'p(99)<200'],
    'http_req_failed': ['rate<0.01'],
  },
};
```

## Interpreting Results

### Success Criteria

**Load Test:**
- ✓ p99 latency < 100ms for redirects
- ✓ p99 latency < 200ms for URL creation
- ✓ Error rate < 1%
- ✓ All thresholds passed

**Stress Test:**
- ✓ System handles > 5,000 VUs
- ✓ Error rate < 5% at peak load
- ✓ Full recovery after load reduction

**Spike Test:**
- ✓ Error rate < 2% during spike
- ✓ Graceful degradation > 90%
- ✓ Recovery rate > 95%

**Soak Test:**
- ✓ Response time drift < 50ms
- ✓ No resource exhaustion events
- ✓ System stability score > 95%

**Chaos Test:**
- ✓ System continues operating during failures
- ✓ Graceful degradation mechanisms work
- ✓ Full recovery after failures

### Common Issues

**High Error Rates:**
- Check server logs for errors
- Verify database/cache connectivity
- Review connection pool sizes
- Check resource limits (CPU, memory, connections)

**High Latency:**
- Check cache hit ratio
- Review database query performance
- Verify network latency
- Check for resource contention

**Memory Leaks:**
- Monitor response time drift in soak test
- Review application memory usage
- Check for unclosed connections
- Verify garbage collection settings

**Timeouts:**
- Increase timeout values in config
- Check network connectivity
- Verify server capacity
- Review slow queries

## Monitoring During Tests

### Key Metrics to Watch

**Application Metrics:**
- Request rate (req/s)
- Response time (p50, p95, p99)
- Error rate (%)
- Cache hit ratio (%)

**System Metrics:**
- CPU utilization (%)
- Memory usage (MB)
- Disk I/O (ops/s)
- Network throughput (MB/s)

**Database Metrics:**
- Connection pool usage
- Query latency
- Replication lag
- Lock contention

**Cache Metrics:**
- Memory usage
- Eviction rate
- Hit/miss ratio
- Connection count

### Monitoring Tools

**Prometheus + Grafana:**
```bash
# Access metrics endpoint
curl http://localhost:3000/metrics

# View in Grafana
http://localhost:3001
```

**k6 Cloud (Optional):**
```bash
k6 login cloud
k6 run --out cloud src/test/load/load-test.js
```

**InfluxDB + Grafana:**
```bash
k6 run --out influxdb=http://localhost:8086/k6 src/test/load/load-test.js
```

## Best Practices

### Before Testing

1. **Baseline Performance:**
   - Run smoke test to establish baseline
   - Document current performance metrics
   - Note any known issues

2. **Environment Preparation:**
   - Use dedicated test environment
   - Ensure adequate resources
   - Clear old test data
   - Warm up caches

3. **Monitoring Setup:**
   - Enable detailed logging
   - Configure monitoring dashboards
   - Set up alerting

### During Testing

1. **Monitor Continuously:**
   - Watch system metrics
   - Check error logs
   - Track resource usage
   - Note any anomalies

2. **Document Observations:**
   - Record unusual behavior
   - Note performance degradation
   - Capture error messages
   - Screenshot dashboards

3. **Be Ready to Stop:**
   - Stop tests if system becomes unstable
   - Prevent data corruption
   - Avoid cascading failures

### After Testing

1. **Analyze Results:**
   - Review all metrics
   - Compare against targets
   - Identify bottlenecks
   - Document findings

2. **Clean Up:**
   - Remove test data
   - Reset system state
   - Clear caches
   - Restart services if needed

3. **Report Findings:**
   - Summarize results
   - Highlight issues
   - Recommend improvements
   - Track action items

## Troubleshooting

### k6 Installation Issues

**Windows:**
```powershell
# If choco fails, download manually
# https://github.com/grafana/k6/releases
```

**macOS:**
```bash
# If brew fails, use binary
curl -L https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-macos-amd64.zip -o k6.zip
unzip k6.zip
sudo mv k6 /usr/local/bin/
```

### Server Connection Issues

```bash
# Check if server is running
curl http://localhost:3000/health

# Check port availability
netstat -an | grep 3000

# Check firewall rules
# Windows: Check Windows Firewall
# Linux: sudo iptables -L
```

### Docker Container Issues

```bash
# List running containers
docker ps

# Check container logs
docker logs url-shortener-postgres-1

# Restart containers
docker-compose restart

# Check container health
docker inspect url-shortener-postgres-1 | grep Health
```

### Performance Issues

**Database:**
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Check locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Redis:**
```bash
# Check memory usage
redis-cli INFO memory

# Check hit rate
redis-cli INFO stats | grep keyspace

# Monitor commands
redis-cli MONITOR
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Run daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for services
        run: sleep 30
      
      - name: Run smoke test
        run: npm run test:smoke
      
      - name: Run load test
        run: npm run test:load
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            summary.json
            *.json
```

## Support

For issues or questions:
1. Check the README.md in this directory
2. Review test output and logs
3. Consult the design document
4. Check k6 documentation: https://k6.io/docs/

## References

- [k6 Documentation](https://k6.io/docs/)
- [Load Testing Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Performance Testing Guide](https://martinfowler.com/articles/practical-test-pyramid.html)
