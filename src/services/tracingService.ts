import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { logger } from '../config/logger';
import { config } from '../config/environment';

/**
 * OpenTelemetry Tracing Service
 * Provides distributed tracing capabilities for the URL Shortener service
 */
class TracingService {
    private sdk: NodeSDK | null = null;
    private tracer: any = null;
    private isInitialized = false;

    /**
     * Initialize OpenTelemetry tracing
     */
    initialize(): void {
        try {
            // Create resource with service information
            const { Resource } = require('@opentelemetry/resources');
            const resource = new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: 'url-shortener',
                [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
                [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'url-shortener',
                [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.nodeEnv,
            });

            // Configure exporters based on environment
            const exporters = this.createExporters();

            // Initialize SDK with auto-instrumentations
            this.sdk = new NodeSDK({
                resource,
                traceExporter: exporters.length > 0 ? exporters[0] : undefined,
                instrumentations: [
                    getNodeAutoInstrumentations({
                        // Disable some instrumentations that might be too verbose
                        '@opentelemetry/instrumentation-fs': {
                            enabled: false,
                        },
                        '@opentelemetry/instrumentation-dns': {
                            enabled: false,
                        },
                        // Configure HTTP instrumentation
                        '@opentelemetry/instrumentation-http': {
                            enabled: true,
                            ignoreIncomingRequestHook: (req) => {
                                // Ignore health check and metrics endpoints to reduce noise
                                const url = req.url || '';
                                return url.includes('/health') || url.includes('/metrics');
                            },
                        },
                        // Configure Express instrumentation
                        '@opentelemetry/instrumentation-express': {
                            enabled: true,
                        },
                        // Configure PostgreSQL instrumentation
                        '@opentelemetry/instrumentation-pg': {
                            enabled: true,
                        },
                        // Configure Redis instrumentation
                        '@opentelemetry/instrumentation-redis': {
                            enabled: true,
                        },
                        // Configure Kafka instrumentation
                        '@opentelemetry/instrumentation-kafkajs': {
                            enabled: true,
                        },
                    }),
                ],
            });

            // Start the SDK
            this.sdk.start();

            // Get tracer instance
            this.tracer = trace.getTracer('url-shortener', process.env.npm_package_version || '1.0.0');

            this.isInitialized = true;
            logger.info('OpenTelemetry tracing initialized successfully', {
                serviceName: 'url-shortener',
                environment: config.nodeEnv,
                exporters: exporters.map(e => e.constructor.name),
            });
        } catch (error) {
            logger.error('Failed to initialize OpenTelemetry tracing', {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });
        }
    }

    /**
     * Create trace exporters based on configuration
     */
    private createExporters(): any[] {
        const exporters: any[] = [];

        // Jaeger exporter (default)
        if (process.env.JAEGER_ENDPOINT || config.nodeEnv === 'development') {
            try {
                const jaegerExporter = new JaegerExporter({
                    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
                });
                exporters.push(jaegerExporter);
                logger.info('Jaeger exporter configured', {
                    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
                });
            } catch (error) {
                logger.warn('Failed to configure Jaeger exporter', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Zipkin exporter (optional)
        if (process.env.ZIPKIN_ENDPOINT) {
            try {
                const zipkinExporter = new ZipkinExporter({
                    url: process.env.ZIPKIN_ENDPOINT,
                });
                exporters.push(zipkinExporter);
                logger.info('Zipkin exporter configured', {
                    endpoint: process.env.ZIPKIN_ENDPOINT,
                });
            } catch (error) {
                logger.warn('Failed to configure Zipkin exporter', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        return exporters;
    }

    /**
     * Create a new span for manual instrumentation
     */
    createSpan(name: string, options?: {
        kind?: SpanKind;
        attributes?: Record<string, string | number | boolean>;
        parent?: any;
    }): any {
        if (!this.isInitialized || !this.tracer) {
            logger.warn('Tracing not initialized, returning no-op span');
            return trace.getActiveSpan();
        }

        const span = this.tracer.startSpan(name, {
            kind: options?.kind || SpanKind.INTERNAL,
            attributes: options?.attributes || {},
        }, options?.parent ? trace.setSpan(context.active(), options.parent) : undefined);

        return span;
    }

    /**
     * Wrap a function with tracing
     */
    traceFunction<T extends (...args: any[]) => any>(
        name: string,
        fn: T,
        options?: {
            kind?: SpanKind;
            attributes?: Record<string, string | number | boolean>;
        }
    ): T {
        if (!this.isInitialized || !this.tracer) {
            return fn;
        }

        return ((...args: Parameters<T>) => {
            const span = this.createSpan(name, options);

            try {
                const result = fn(...args);

                // Handle async functions
                if (result && typeof result.then === 'function') {
                    return result
                        .then((value: any) => {
                            span.setStatus({ code: SpanStatusCode.OK });
                            span.end();
                            return value;
                        })
                        .catch((error: any) => {
                            span.recordException(error);
                            span.setStatus({
                                code: SpanStatusCode.ERROR,
                                message: error.message || 'Unknown error',
                            });
                            span.end();
                            throw error;
                        });
                }

                // Handle sync functions
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return result;
            } catch (error) {
                span.recordException(error as Error);
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: (error as Error).message || 'Unknown error',
                });
                span.end();
                throw error;
            }
        }) as T;
    }

    /**
     * Wrap an async function with tracing
     */
    traceAsyncFunction<T extends (...args: any[]) => Promise<any>>(
        name: string,
        fn: T,
        options?: {
            kind?: SpanKind;
            attributes?: Record<string, string | number | boolean>;
        }
    ): T {
        if (!this.isInitialized || !this.tracer) {
            return fn;
        }

        return (async (...args: Parameters<T>) => {
            const span = this.createSpan(name, options);

            try {
                const result = await fn(...args);
                span.setStatus({ code: SpanStatusCode.OK });
                span.end();
                return result;
            } catch (error) {
                span.recordException(error as Error);
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: (error as Error).message || 'Unknown error',
                });
                span.end();
                throw error;
            }
        }) as T;
    }

    /**
     * Add attributes to the current active span
     */
    addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            Object.entries(attributes).forEach(([key, value]) => {
                activeSpan.setAttribute(key, value);
            });
        }
    }

    /**
     * Add an event to the current active span
     */
    addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            activeSpan.addEvent(name, attributes);
        }
    }

    /**
     * Record an exception in the current active span
     */
    recordException(error: Error): void {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            activeSpan.recordException(error);
            activeSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
        }
    }

    /**
     * Get the current trace ID for correlation with logs
     */
    getCurrentTraceId(): string | undefined {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            const spanContext = activeSpan.spanContext();
            return spanContext.traceId;
        }
        return undefined;
    }

    /**
     * Get the current span ID for correlation with logs
     */
    getCurrentSpanId(): string | undefined {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
            const spanContext = activeSpan.spanContext();
            return spanContext.spanId;
        }
        return undefined;
    }

    /**
     * Shutdown tracing gracefully
     */
    async shutdown(): Promise<void> {
        if (this.sdk) {
            try {
                await this.sdk.shutdown();
                logger.info('OpenTelemetry tracing shutdown completed');
            } catch (error) {
                logger.error('Error during tracing shutdown', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
    }

    /**
     * Check if tracing is initialized
     */
    isTracingEnabled(): boolean {
        return this.isInitialized;
    }
}

// Export singleton instance
export const tracingService = new TracingService();
export { TracingService };