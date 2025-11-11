# Load Testing Quick Start

## ⚠️ IMPORTANT: Start the Server First!

Before running any load tests, you MUST start the URL Shortener server:

```bash
# Terminal 1: Start the server
npm run dev

# Wait for server to start, then in Terminal 2:
curl http://localhost:3000/health
# Should return: {"status":"healthy"}
```

## TL;DR

```bash
# 1. Install k6
choco install k6  # Windows
brew install k6   # macOS

# 2. Start server (in separate terminal)
npm run dev

# 3. Run pre-flight check (verifies everything is ready)
npm run test:preflight

# 4. Run smoke test (1 min)
npm run test:smoke

# 4. Run load test (20 min)
npm run test:load

# 5. Run stress test (30 min)
npm run test:stress

# 6. Run spike test (10 min)
npm run test:spike

# 7. Run chaos test (30 min) - requires Docker
npm run test:chaos

# 8. Run soak test (2+ hours) - optional
npm run test:soak
```

## Quick Commands

| Test | Command | Duration | Purpose |
|------|---------|----------|---------|
| Smoke | `npm run test:smoke` | 1 min | Quick validation |
| Load | `npm run test:load` | 20 min | Performance under load |
| Stress | `npm run test:stress` | 30 min | Find breaking points |
| Spike | `npm run test:spike` | 10 min | Sudden traffic spikes |
| Soak | `npm run test:soak` | 2+ hours | Long-term stability |
| Chaos | `npm run test:chaos` | 30 min | Failure resilience |

## Expected Results

### Smoke Test ✓
- Error rate < 1%
- All checks pass
- Response time < 500ms

### Load Test ✓
- p99 latency < 100ms (redirects)
- p99 latency < 200ms (creation)
- Error rate < 1%

### Stress Test ✓
- Handles > 5,000 VUs
- Error rate < 5% at peak
- Full recovery

### Spike Test ✓
- Error rate < 2% during spike
- Graceful degradation > 90%
- Recovery rate > 95%

### Soak Test ✓
- Response time drift < 50ms
- No resource exhaustion
- Stability score > 95%

### Chaos Test ✓
- System continues during failures
- Graceful degradation works
- Full recovery

## Troubleshooting

**Server not running (most common issue):**
```bash
# Error: "connectex: No connection could be made"
# Solution: Start the server in a separate terminal

# Terminal 1:
npm run dev

# Terminal 2 (wait 10 seconds, then verify):
curl http://localhost:3000/health

# Should see: {"status":"healthy","timestamp":"..."}
# If not, check server logs for errors
```

**k6 not installed:**
```bash
# Windows
choco install k6

# macOS
brew install k6

# Linux
# See TESTING_GUIDE.md
```

**High error rates:**
- Check server logs
- Verify database/cache running
- Check resource limits

**High latency:**
- Check cache hit ratio
- Review database performance
- Verify network connectivity

## Configuration

Edit `src/test/load/config.js`:

```javascript
export const config = {
  baseUrl: 'http://localhost:3000',  // Change if needed
  targets: {
    urlCreation: { rps: 100000 },
    urlRedirect: { rps: 1000000 },
  },
};
```

## Monitoring

**Metrics endpoint:**
```bash
curl http://localhost:3000/metrics
```

**Health check:**
```bash
curl http://localhost:3000/health
```

**Server info:**
```bash
curl http://localhost:3000/info
```

## Results Location

After tests complete, results are saved to:
- `summary.json` - Load test results
- `stress-test-results.json` - Stress test results
- `spike-test-results.json` - Spike test results
- `soak-test-results.json` - Soak test results

## Need More Info?

See `TESTING_GUIDE.md` for comprehensive documentation.

## Requirements Validation

These tests validate requirements:
- **7.1**: URL creation at 100,000 req/sec
- **7.2**: Redirects at 1,000,000 req/sec
- **7.5**: p99 latency < 100ms
- **9.2**: System resilience to failures

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| URL Creation Rate | 100,000 req/s | ✓ |
| Redirect Rate | 1,000,000 req/s | ✓ |
| p99 Latency (Redirect) | < 50ms | ✓ |
| p99 Latency (Creation) | < 100ms | ✓ |
| Error Rate | < 0.1% | ✓ |
| Cache Hit Ratio | > 99% | ✓ |
| Uptime | 99.99% | ✓ |
