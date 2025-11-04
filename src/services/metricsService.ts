import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../config/logger';

/**
 * Prometheus metrics service for collecting and exposing application metrics
 */
class MetricsService {
    // HTTP request metrics
    public readonly httpRequestsTotal: Counter<string>;
    public readonly httpRequestDuration: Histogram<string>;

    // URL shortening metrics
    public readonly urlCreationTotal: Counter<string>;
    public readonly urlCreationDuration: Histogram<string>;
    public readonly urlRedirectTotal: Counter<string>;
    public readonly urlRedirectDuration: Histogram<string>;

    // Cache metrics
    public readonly cacheHitRatio: Gauge<string>;
    public readonly cacheOperationsTotal: Counter<string>;
    public readonly cacheOperationDuration: Histogram<string>;

    // Database metrics
    public readonly dbConnectionsActive: Gauge<string>;
    public readonly dbQueryDuration: Histogram<string>;
    public readonly dbQueryTotal: Counter<string>;

    // System metrics
    public readonly activeConnections: Gauge<string>;
    public readonly errorRate: Counter<string>;

    // Analytics metrics
    public readonly analyticsEventsTotal: Counter<string>;
    public readonly analyticsProcessingDuration: Histogram<string>;

    constructor() {
        // Enable default metrics collection (CPU, memory, etc.)
        collectDefaultMetrics({
            register,
            prefix: 'url_shortener_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        });

        // HTTP request metrics
        this.httpRequestsTotal = new Counter({
            name: 'url_shortener_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
            registers: [register],
        });

        this.httpRequestDuration = new Histogram({
            name: 'url_shortener_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [register],
        });

        // URL shortening metrics
        this.urlCreationTotal = new Counter({
            name: 'url_shortener_url_creation_total',
            help: 'Total number of URLs created',
            labelNames: ['strategy', 'status'],
            registers: [register],
        });

        this.urlCreationDuration = new Histogram({
            name: 'url_shortener_url_creation_duration_seconds',
            help: 'Duration of URL creation operations in seconds',
            labelNames: ['strategy'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
            registers: [register],
        });

        this.urlRedirectTotal = new Counter({
            name: 'url_shortener_url_redirect_total',
            help: 'Total number of URL redirects',
            labelNames: ['status', 'cache_hit'],
            registers: [register],
        });

        this.urlRedirectDuration = new Histogram({
            name: 'url_shortener_url_redirect_duration_seconds',
            help: 'Duration of URL redirect operations in seconds',
            labelNames: ['cache_hit'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
            registers: [register],
        });

        // Cache metrics
        this.cacheHitRatio = new Gauge({
            name: 'url_shortener_cache_hit_ratio',
            help: 'Cache hit ratio (0-1)',
            labelNames: ['cache_type'],
            registers: [register],
        });

        this.cacheOperationsTotal = new Counter({
            name: 'url_shortener_cache_operations_total',
            help: 'Total number of cache operations',
            labelNames: ['operation', 'cache_type', 'status'],
            registers: [register],
        });

        this.cacheOperationDuration = new Histogram({
            name: 'url_shortener_cache_operation_duration_seconds',
            help: 'Duration of cache operations in seconds',
            labelNames: ['operation', 'cache_type'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
            registers: [register],
        });

        // Database metrics
        this.dbConnectionsActive = new Gauge({
            name: 'url_shortener_db_connections_active',
            help: 'Number of active database connections',
            registers: [register],
        });

        this.dbQueryDuration = new Histogram({
            name: 'url_shortener_db_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'table'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
            registers: [register],
        });

        this.dbQueryTotal = new Counter({
            name: 'url_shortener_db_query_total',
            help: 'Total number of database queries',
            labelNames: ['operation', 'table', 'status'],
            registers: [register],
        });

        // System metrics
        this.activeConnections = new Gauge({
            name: 'url_shortener_active_connections',
            help: 'Number of active connections',
            registers: [register],
        });

        this.errorRate = new Counter({
            name: 'url_shortener_errors_total',
            help: 'Total number of errors',
            labelNames: ['type', 'component'],
            registers: [register],
        });

        // Analytics metrics
        this.analyticsEventsTotal = new Counter({
            name: 'url_shortener_analytics_events_total',
            help: 'Total number of analytics events processed',
            labelNames: ['event_type', 'status'],
            registers: [register],
        });

        this.analyticsProcessingDuration = new Histogram({
            name: 'url_shortener_analytics_processing_duration_seconds',
            help: 'Duration of analytics processing in seconds',
            labelNames: ['event_type'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
            registers: [register],
        });

        logger.info('Metrics service initialized with Prometheus collectors');
    }

    /**
     * Get metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        try {
            return await register.metrics();
        } catch (error) {
            logger.error('Failed to collect metrics', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Get metrics content type
     */
    getContentType(): string {
        return register.contentType;
    }

    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
        this.httpRequestsTotal.inc({
            method: method.toUpperCase(),
            route,
            status_code: statusCode.toString(),
        });

        this.httpRequestDuration.observe(
            {
                method: method.toUpperCase(),
                route,
                status_code: statusCode.toString(),
            },
            duration / 1000 // Convert to seconds
        );
    }

    /**
     * Record URL creation metrics
     */
    recordUrlCreation(strategy: string, status: string, duration: number): void {
        this.urlCreationTotal.inc({ strategy, status });
        this.urlCreationDuration.observe({ strategy }, duration / 1000);
    }

    /**
     * Record URL redirect metrics
     */
    recordUrlRedirect(status: string, cacheHit: boolean, duration: number): void {
        const cacheHitLabel = cacheHit ? 'hit' : 'miss';
        this.urlRedirectTotal.inc({ status, cache_hit: cacheHitLabel });
        this.urlRedirectDuration.observe({ cache_hit: cacheHitLabel }, duration / 1000);
    }

    /**
     * Update cache hit ratio
     */
    updateCacheHitRatio(cacheType: string, ratio: number): void {
        this.cacheHitRatio.set({ cache_type: cacheType }, ratio);
    }

    /**
     * Record cache operation metrics
     */
    recordCacheOperation(operation: string, cacheType: string, status: string, duration: number): void {
        this.cacheOperationsTotal.inc({ operation, cache_type: cacheType, status });
        this.cacheOperationDuration.observe({ operation, cache_type: cacheType }, duration / 1000);
    }

    /**
     * Update database connection count
     */
    updateDbConnections(count: number): void {
        this.dbConnectionsActive.set(count);
    }

    /**
     * Record database query metrics
     */
    recordDbQuery(operation: string, table: string, status: string, duration: number): void {
        this.dbQueryTotal.inc({ operation, table, status });
        this.dbQueryDuration.observe({ operation, table }, duration / 1000);
    }

    /**
     * Update active connections count
     */
    updateActiveConnections(count: number): void {
        this.activeConnections.set(count);
    }

    /**
     * Record error metrics
     */
    recordError(type: string, component: string): void {
        this.errorRate.inc({ type, component });
    }

    /**
     * Record analytics event metrics
     */
    recordAnalyticsEvent(eventType: string, status: string, duration?: number): void {
        this.analyticsEventsTotal.inc({ event_type: eventType, status });
        if (duration !== undefined) {
            this.analyticsProcessingDuration.observe({ event_type: eventType }, duration / 1000);
        }
    }

    /**
     * Clear all metrics (useful for testing)
     */
    clear(): void {
        register.clear();
    }

    /**
     * Get registry for advanced usage
     */
    getRegistry() {
        return register;
    }
}

// Export singleton instance
export const metricsService = new MetricsService();
export { MetricsService };