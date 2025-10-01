# Distributed Tracing with OpenTelemetry

This document describes the distributed tracing implementation for the URL Shortener service using OpenTelemetry and Jaeger.

## Overview

Distributed tracing helps track requests as they flow through different components of the system, providing visibility into:
- Request latency and performance bottlenecks
- Service dependencies and call patterns
- Error propagation and root cause analysis
- Cache hit/miss patterns
- Database query performance

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│ URL Service │───▶│  Database   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │    Cache    │
                   └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │  Analytics  │
                   └─────────────┘
```

Each component creates spans that are linked together to form a complete trace.

## Components

### OpenTelemetry SDK
- **Auto-instrumentation**: Automatically instruments HTTP, Express, PostgreSQL, Redis, and Kafka
- **Manual instrumentation**: Custom spans for business logic
- **Context propagation**: Maintains trace context across async operations

### Jaeger
- **Trace collection**: Receives and stores trace data
- **UI**: Web interface for viewing and analyzing traces
- **Storage**: Supports in-memory (development) and Elasticsearch (production)

## Trace Structure

### Span Hierarchy
```
HTTP Request (root span)
├── URL Validation
├── Cache Lookup
│   ├── Memory Cache Check
│   ├── Redis Cache Check
│   └── Database Query
├── URL Processing
│   ├── ID Generation
│   └── Database Insert
└── Analytics Event
    └── Kafka Publish
```

### Span Attributes

#### HTTP Spans
- `http.method`: HTTP method (GET, POST, etc.)
- `http.url`: Full request URL
- `http.route`: Route pattern
- `http.status_code`: Response status code
- `http.user_agent`: Client user agent
- `http.remote_addr`: Client IP address

#### Business Logic Spans
- `url_shortener.operation`: Operation type (create_short_url, redirect_url, etc.)
- `url_shortener.short_code`: Short code being processed
- `url_shortener.user_id`: User ID (if authenticated)
- `url_shortener.strategy`: Duplicate handling strategy
- `url_shortener.cache_hit`: Whether cache was hit

#### Cache Spans
- `cache.operation`: Cache operation (get, set, delete)
- `cache.hit`: Whether operation was a hit or miss
- `cache.source`: Cache layer (memory, redis, database)
- `cache.latency_ms`: Operation latency

#### Database Spans
- `db.operation`: Database operation (select, insert, update, delete)
- `db.table`: Table name
- `db.query_time_ms`: Query execution time

## Setup and Configuration

### 1. Environment Variables

```bash
# Jaeger configuration
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Zipkin configuration (optional)
ZIPKIN_ENDPOINT=http://localhost:9411/api/v2/spans

# Enable/disable tracing
TRACING_ENABLED=true
```

### 2. Start Jaeger

#### Development (All-in-One)
```bash
cd monitoring
docker-compose -f docker-compose.jaeger.yml up jaeger
```

#### Production (Distributed)
```bash
cd monitoring
docker-compose -f docker-compose.jaeger.yml --profile production up
```

### 3. Access Jaeger UI

- **Development**: http://localhost:16686
- **Production**: http://localhost:16687

## Usage Examples

### Manual Span Creation

```typescript
import { tracingService } from '../services/tracingService';
import { SpanKind } from '@opentelemetry/api';

// Create a custom span
const span = tracingService.createSpan('custom.operation', {
  kind: SpanKind.INTERNAL,
  attributes: {
    'custom.attribute': 'value',
  },
});

try {
  // Your business logic here
  const result = await someOperation();
  
  span.setAttributes({
    'operation.result': 'success',
    'result.count': result.length,
  });
  
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });
  throw error;
} finally {
  span.end();
}
```

### Using Decorators

```typescript
import { TraceMethod } from '../middleware/tracingMiddleware';

class MyService {
  @TraceMethod('my_service.process_data')
  async processData(data: any): Promise<any> {
    // Method is automatically traced
    return await this.doProcessing(data);
  }
}
```

### Adding Business Context

```typescript
import { addBusinessContext } from '../middleware/tracingMiddleware';

// Add context to current span
addBusinessContext({
  shortCode: 'abc123',
  userId: 12345,
  operation: 'redirect_url',
  cacheHit: true,
});
```

## Trace Analysis

### Common Queries in Jaeger UI

1. **Find slow requests**:
   - Service: `url-shortener`
   - Operation: `GET /:shortCode`
   - Min Duration: `100ms`

2. **Find errors**:
   - Service: `url-shortener`
   - Tags: `error=true`

3. **Cache performance**:
   - Service: `url-shortener`
   - Tags: `cache.hit=false`

4. **User-specific traces**:
   - Service: `url-shortener`
   - Tags: `url_shortener.user_id=12345`

### Performance Metrics

#### Latency Percentiles
- P50: 50th percentile (median)
- P95: 95th percentile
- P99: 99th percentile

#### Error Rates
- Total errors / Total requests
- Error rate by operation
- Error rate by user

#### Cache Efficiency
- Cache hit ratio by layer
- Cache miss latency impact
- Cache population patterns

## Troubleshooting

### Common Issues

1. **No traces appearing**:
   - Check Jaeger endpoint configuration
   - Verify network connectivity
   - Check application logs for tracing errors

2. **Missing spans**:
   - Ensure proper context propagation
   - Check if auto-instrumentation is working
   - Verify manual span creation

3. **High overhead**:
   - Reduce sampling rate
   - Disable verbose instrumentations
   - Optimize span attributes

### Debug Commands

```bash
# Check Jaeger health
curl http://localhost:16686/api/services

# Check trace collection
curl http://localhost:14268/api/traces

# View application traces
curl "http://localhost:16686/api/traces?service=url-shortener&limit=10"
```

### Performance Tuning

#### Sampling Configuration
```typescript
// In tracingService.ts
const sdk = new NodeSDK({
  // Sample 10% of traces in production
  sampler: new TraceIdRatioBasedSampler(0.1),
  // ... other config
});
```

#### Attribute Limits
```typescript
// Limit span attributes to reduce overhead
const resource = new Resource({
  // ... resource attributes
}, {
  // Limit number of attributes per span
  attributeCountLimit: 32,
  attributeValueLengthLimit: 256,
});
```

## Best Practices

### Do's
- ✅ Use meaningful span names
- ✅ Add relevant business context
- ✅ Set appropriate span status
- ✅ Record exceptions in spans
- ✅ Use sampling in production
- ✅ Monitor tracing overhead

### Don'ts
- ❌ Create too many spans (causes overhead)
- ❌ Add sensitive data to attributes
- ❌ Ignore span lifecycle (start/end)
- ❌ Block operations for tracing
- ❌ Use tracing for debugging in production

### Span Naming Conventions
- Use `service.operation` format
- Be specific but not too verbose
- Use consistent naming across services
- Include operation type (get, create, update, delete)

### Attribute Guidelines
- Use semantic conventions when possible
- Keep attribute names consistent
- Avoid high-cardinality attributes
- Include relevant business context

## Integration with Monitoring

### Correlation with Logs
```typescript
// Add trace context to logs
const traceId = tracingService.getCurrentTraceId();
const spanId = tracingService.getCurrentSpanId();

logger.info('Processing request', {
  traceId,
  spanId,
  // ... other log data
});
```

### Correlation with Metrics
```typescript
// Add trace context to metrics
metricsService.recordUrlCreation('success', 'generate_new', duration, {
  traceId: tracingService.getCurrentTraceId(),
});
```

### Alerting on Trace Data
- High error rates in specific operations
- Unusual latency patterns
- Missing expected spans
- High trace volume (potential DDoS)

## Security Considerations

1. **Data Privacy**: Don't include PII in span attributes
2. **Access Control**: Secure Jaeger UI access
3. **Network Security**: Use TLS for trace export
4. **Data Retention**: Configure appropriate retention policies
5. **Sampling**: Use sampling to reduce data volume

## Production Deployment

### High Availability
- Deploy multiple Jaeger collectors
- Use load balancer for collectors
- Configure Elasticsearch cluster
- Set up monitoring for tracing infrastructure

### Storage Configuration
```yaml
# Elasticsearch storage
SPAN_STORAGE_TYPE=elasticsearch
ES_SERVER_URLS=http://es-cluster:9200
ES_INDEX_PREFIX=jaeger
ES_TAGS_AS_FIELDS_ALL=true
```

### Retention Policies
```bash
# Set retention to 7 days
ES_INDEX_DATE_SEPARATOR=-
ES_INDEX_ROLLOVER_FREQUENCY_SPANS=daily
ES_MAX_SPAN_AGE=168h
```