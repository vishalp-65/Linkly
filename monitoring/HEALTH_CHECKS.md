# Health Check System

This document describes the comprehensive health check system implemented for the URL Shortener service.

## Overview

The health check system provides multiple endpoints and programmatic interfaces to monitor the health and readiness of the service and its dependencies.

## Health Check Endpoints

### Basic Health Check
**Endpoint**: `GET /health`
**Purpose**: Comprehensive health check of all services
**Response Time**: ~100-500ms
**Use Case**: General monitoring, dashboards

```bash
curl http://localhost:3000/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-02T10:30:45.123Z",
  "uptime": 3600.5,
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "cache": {
      "status": "healthy", 
      "responseTime": 8
    },
    "kafka": {
      "status": "healthy",
      "responseTime": 25
    }
  },
  "system": {
    "memory": {
      "used": 134217728,
      "total": 8589934592,
      "percentage": 2
    },
    "cpu": {
      "loadAverage": [0.5, 0.3, 0.2]
    }
  }
}
```

### Readiness Check
**Endpoint**: `GET /ready`
**Purpose**: Kubernetes readiness probe
**Response Time**: ~50-200ms
**Use Case**: Load balancer health checks, Kubernetes

```bash
curl http://localhost:3000/ready
```

**Response**:
```json
{
  "status": "ready",
  "timestamp": "2024-11-02T10:30:45.123Z",
  "services": {
    "database": "ready",
    "cache": "ready",
    "kafka": "degraded"
  }
}
```

### Liveness Check
**Endpoint**: `GET /live`
**Purpose**: Kubernetes liveness probe
**Response Time**: ~1-5ms
**Use Case**: Container orchestration

```bash
curl http://localhost:3000/live
```

**Response**:
```json
{
  "status": "alive",
  "timestamp": "2024-11-02T10:30:45.123Z",
  "uptime": 3600.5,
  "pid": 1234
}
```

### Detailed Health Check
**Endpoint**: `GET /health/detailed`
**Purpose**: Comprehensive system diagnostics
**Response Time**: ~200-1000ms
**Use Case**: Debugging, detailed monitoring

```bash
curl http://localhost:3000/health/detailed
```

**Response**: Extended health information including:
- Detailed service metrics
- Database connection pool stats
- Memory breakdown
- CPU usage details
- Process information
- Network interface details

### Service-Specific Health Checks

#### Database Health
**Endpoint**: `GET /health/database`
```bash
curl http://localhost:3000/health/database
```

#### Cache Health
**Endpoint**: `GET /health/cache`
```bash
curl http://localhost:3000/health/cache
```

#### Analytics Health
**Endpoint**: `GET /health/kafka`
```bash
curl http://localhost:3000/health/kafka
```

## Health Status Definitions

### Service Status
- **healthy**: Service is fully operational
- **unhealthy**: Service is not working, system may be impacted
- **degraded**: Service has issues but system can still operate

### Overall System Status
- **healthy**: All critical services are healthy
- **unhealthy**: One or more critical services are unhealthy
- **degraded**: Critical services are healthy, but optional services have issues

### Critical vs Optional Services
- **Critical**: Database, Redis Cache (system cannot operate without these)
- **Optional**: Kafka Analytics (system can operate in degraded mode without this)

## Response Codes

| Status Code | Meaning | Action |
|-------------|---------|---------|
| 200 | Healthy | No action needed |
| 503 | Unhealthy/Not Ready | Investigate immediately |
| 500 | Health Check Error | Check health check system |

## Kubernetes Integration

### Deployment Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: url-shortener
spec:
  template:
    spec:
      containers:
      - name: url-shortener
        image: url-shortener:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

### Service Configuration
```yaml
apiVersion: v1
kind: Service
metadata:
  name: url-shortener-service
spec:
  selector:
    app: url-shortener
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Load Balancer Integration

### HAProxy Configuration
```
backend url-shortener
    balance roundrobin
    option httpchk GET /ready
    http-check expect status 200
    server app1 10.0.1.10:3000 check
    server app2 10.0.1.11:3000 check
    server app3 10.0.1.12:3000 check
```

### NGINX Configuration
```nginx
upstream url_shortener {
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
}

server {
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    location / {
        proxy_pass http://url_shortener;
        
        # Health check
        health_check uri=/ready interval=10s;
    }
}
```

## Monitoring Integration

### Prometheus Monitoring
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'url-shortener-health'
    metrics_path: '/health'
    scrape_interval: 30s
    static_configs:
      - targets: ['url-shortener:3000']
```

### Grafana Dashboard Queries
```promql
# Service availability
up{job="url-shortener"}

# Health check response time
http_request_duration_seconds{handler="/health"}

# Service status
url_shortener_service_health{service="database"}
```

## Alerting Rules

### Critical Alerts
```yaml
groups:
  - name: health_checks
    rules:
      - alert: ServiceDown
        expr: up{job="url-shortener"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "URL Shortener service is down"
          
      - alert: DatabaseUnhealthy
        expr: url_shortener_service_health{service="database"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database is unhealthy"
          
      - alert: HighHealthCheckLatency
        expr: http_request_duration_seconds{handler="/health"} > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Health check latency is high"
```

## Programmatic Usage

### Using Health Check Service
```typescript
import { healthCheckService } from '../services/healthCheckService';

// Basic health check
const health = await healthCheckService.checkHealth();
console.log(`System status: ${health.status}`);

// Check specific service
const dbHealth = await healthCheckService.getServiceHealth('database');
console.log(`Database status: ${dbHealth.status}`);

// Quick readiness check
const isReady = await healthCheckService.isReady();
if (isReady) {
  console.log('Service is ready to accept traffic');
}

// Liveness check
const isAlive = healthCheckService.isAlive();
console.log(`Service is alive: ${isAlive}`);
```

### Custom Health Checks
```typescript
// Add custom health check logic
class CustomHealthCheck {
  async checkExternalAPI(): Promise<boolean> {
    try {
      const response = await fetch('https://api.example.com/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Health check timeouts**:
   - Check database connection pool
   - Verify Redis connectivity
   - Monitor system resources

2. **Intermittent failures**:
   - Check network stability
   - Monitor connection limits
   - Review error logs

3. **False positives**:
   - Adjust timeout values
   - Review health check logic
   - Check system load

### Debug Commands
```bash
# Test all health endpoints
curl -w "%{http_code} %{time_total}s\n" http://localhost:3000/health
curl -w "%{http_code} %{time_total}s\n" http://localhost:3000/ready
curl -w "%{http_code} %{time_total}s\n" http://localhost:3000/live

# Check specific services
curl http://localhost:3000/health/database
curl http://localhost:3000/health/cache
curl http://localhost:3000/health/kafka

# Get detailed diagnostics
curl http://localhost:3000/health/detailed | jq '.'
```

### Log Analysis
```bash
# Filter health check logs
docker logs url-shortener 2>&1 | grep -i "health"

# Monitor health check performance
docker logs url-shortener 2>&1 | grep "Health check completed" | tail -20
```

## Performance Considerations

### Response Time Targets
- `/live`: < 5ms
- `/ready`: < 100ms
- `/health`: < 500ms
- `/health/detailed`: < 1000ms

### Optimization Tips
1. **Cache health results** for frequently called endpoints
2. **Use connection pooling** for database health checks
3. **Implement circuit breakers** for external dependencies
4. **Set appropriate timeouts** to prevent hanging
5. **Monitor health check overhead** in production

## Security Considerations

1. **Access Control**: Restrict detailed health endpoints in production
2. **Information Disclosure**: Avoid exposing sensitive system information
3. **Rate Limiting**: Prevent health check endpoint abuse
4. **Authentication**: Consider authentication for detailed diagnostics

### Production Security
```typescript
// Restrict detailed health checks in production
if (config.nodeEnv === 'production' && !req.headers['x-admin-key']) {
  return res.status(403).json({ error: 'Access denied' });
}
```

## Best Practices

1. **Implement graceful degradation** for optional services
2. **Use appropriate timeouts** for each service type
3. **Monitor health check performance** and overhead
4. **Test health checks** in different failure scenarios
5. **Document expected response times** for each endpoint
6. **Use structured logging** for health check events
7. **Implement health check versioning** for API compatibility