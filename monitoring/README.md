# URL Shortener Monitoring Setup

This directory contains the monitoring and alerting configuration for the URL Shortener service using Prometheus, Alertmanager, and Grafana.

## Components

### Prometheus
- **Purpose**: Metrics collection and storage
- **Port**: 9090
- **Configuration**: `prometheus/prometheus.yml`
- **Alerts**: `prometheus/alerts.yml`

### Alertmanager
- **Purpose**: Alert routing and notification management
- **Port**: 9093
- **Configuration**: `alertmanager/alertmanager.yml`

### Grafana
- **Purpose**: Metrics visualization and dashboards
- **Port**: 3001
- **Default credentials**: admin/admin123

### Exporters
- **Node Exporter**: System metrics (CPU, memory, disk, network)
- **Redis Exporter**: Redis performance and health metrics
- **PostgreSQL Exporter**: Database performance metrics
- **Kafka Exporter**: Kafka cluster and topic metrics

## Quick Start

1. **Start the monitoring stack**:
   ```bash
   cd monitoring
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Access the services**:
   - Prometheus: http://localhost:9090
   - Alertmanager: http://localhost:9093
   - Grafana: http://localhost:3001

3. **Configure environment variables**:
   ```bash
   export DB_USER=your_db_user
   export DB_PASSWORD=your_db_password
   export DB_HOST=postgres
   export DB_PORT=5432
   export DB_NAME=url_shortener
   export REDIS_PASSWORD=your_redis_password
   ```

## Alert Rules

### Critical Alerts (Immediate Response Required)
- **HighErrorRate**: Error rate > 1% for 5 minutes
- **DatabaseReplicationLag**: Replication lag > 10 seconds
- **ServiceDown**: Service unavailable for 1 minute
- **DatabaseConnectionPoolExhaustion**: Connection pool near limit

### Warning Alerts (Monitor and Investigate)
- **HighP99Latency**: P99 latency > 200ms for 10 minutes
- **LowCacheHitRatio**: Cache hit ratio < 95% for 15 minutes
- **HighMemoryUsage**: Memory usage > 85% for 10 minutes
- **HighCPUUsage**: CPU usage > 80% for 10 minutes
- **RedisConnectionIssues**: Redis error rate > 0.1 errors/sec

### Info Alerts (Daily Monitoring)
- **UnusualTrafficPattern**: Traffic 5x higher or 80% lower than yesterday
- **LowURLCreationRate**: URL creation < 10 URLs/hour for 2 hours
- **High404Rate**: 404 error rate > 10% for 15 minutes

## Notification Channels

### Email
- **Critical**: oncall@urlshortener.com
- **Warning**: team@urlshortener.com
- **Info**: monitoring@urlshortener.com

### Slack
- **Critical**: #alerts-critical
- **Warning**: #alerts-warning

### PagerDuty
- **Critical alerts only**: Configured for immediate escalation

## Metrics Collected

### Application Metrics
- `url_shortener_http_requests_total`: Total HTTP requests by method, route, status
- `url_shortener_http_request_duration_seconds`: Request latency histogram
- `url_shortener_url_creation_total`: URL creation attempts by strategy and status
- `url_shortener_url_redirect_total`: URL redirects by status and cache hit
- `url_shortener_cache_hit_ratio`: Cache hit ratio by cache type
- `url_shortener_db_connections_active`: Active database connections
- `url_shortener_errors_total`: Error count by type and component

### System Metrics (via Node Exporter)
- CPU usage, memory usage, disk I/O, network I/O
- File system usage and availability
- System load averages

### Database Metrics (via PostgreSQL Exporter)
- Connection pool status
- Query performance
- Lock statistics
- Replication lag

### Cache Metrics (via Redis Exporter)
- Memory usage
- Hit/miss ratios
- Connection statistics
- Keyspace information

## Configuration

### Prometheus Configuration
Edit `prometheus/prometheus.yml` to:
- Add new scrape targets
- Modify scrape intervals
- Configure remote storage

### Alert Rules
Edit `prometheus/alerts.yml` to:
- Add new alert rules
- Modify thresholds
- Update alert descriptions

### Alertmanager Configuration
Edit `alertmanager/alertmanager.yml` to:
- Configure notification channels
- Set up routing rules
- Add inhibition rules

## Troubleshooting

### Common Issues

1. **Metrics not appearing**:
   - Check if the URL Shortener service is exposing `/metrics` endpoint
   - Verify Prometheus can reach the target (check Targets page)
   - Check Prometheus logs for scrape errors

2. **Alerts not firing**:
   - Verify alert rules syntax in Prometheus Rules page
   - Check if metrics have data for the alert query
   - Ensure Alertmanager is connected to Prometheus

3. **Notifications not sent**:
   - Check Alertmanager configuration
   - Verify notification channel credentials
   - Check Alertmanager logs for delivery errors

### Useful Commands

```bash
# Check Prometheus configuration
docker exec url-shortener-prometheus promtool check config /etc/prometheus/prometheus.yml

# Check alert rules
docker exec url-shortener-prometheus promtool check rules /etc/prometheus/alerts.yml

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload

# Check Alertmanager configuration
docker exec url-shortener-alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# View active alerts
curl http://localhost:9093/api/v1/alerts

# Silence an alert
amtool silence add alertname="HighErrorRate" --duration="1h" --comment="Maintenance window"
```

## Security Considerations

1. **Authentication**: Configure authentication for Grafana and Prometheus in production
2. **Network Security**: Use proper firewall rules and network segmentation
3. **Secrets Management**: Store sensitive credentials in secure secret management systems
4. **TLS**: Enable TLS for all monitoring components in production
5. **Access Control**: Implement proper RBAC for monitoring tools

## Scaling

### High Availability
- Run multiple Prometheus instances with federation
- Use Alertmanager clustering for redundancy
- Deploy Grafana behind a load balancer

### Long-term Storage
- Configure remote write to long-term storage (e.g., Thanos, Cortex)
- Set appropriate retention policies
- Use recording rules for expensive queries

### Performance Optimization
- Tune scrape intervals based on requirements
- Use recording rules for complex queries
- Implement proper cardinality management