import { Request, Response, NextFunction } from 'express';
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { tracingService } from '../services/tracingService';
import { logger } from '../config/logger';

/**
 * Enhanced tracing middleware that adds custom spans and attributes
 */
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Skip tracing for health checks and metrics to reduce noise
    if (req.path === '/health' || req.path === '/metrics' || req.path === '/ready' || req.path === '/live') {
        return next();
    }

    const startTime = Date.now();

    // Create a custom span for the request
    const span = tracingService.createSpan(`${req.method} ${req.route?.path || req.path}`, {
        kind: SpanKind.SERVER,
        attributes: {
            'http.method': req.method,
            'http.url': req.url,
            'http.route': req.route?.path || req.path,
            'http.user_agent': req.get('User-Agent') || '',
            'http.remote_addr': req.ip || req.connection.remoteAddress || '',
            'url_shortener.request_id': req.headers['x-request-id'] as string || '',
        },
    });

    // Add custom attributes based on request type
    if (req.path.startsWith('/api/v1/shorten')) {
        span.setAttribute('url_shortener.operation', 'create_short_url');
    } else if (req.path.match(/^\/[a-zA-Z0-9]+$/)) {
        span.setAttribute('url_shortener.operation', 'redirect_url');
        span.setAttribute('url_shortener.short_code', req.path.substring(1));
    } else if (req.path.startsWith('/api/v1/analytics')) {
        span.setAttribute('url_shortener.operation', 'get_analytics');
    }

    // Add user information if available
    if ((req as any).user) {
        span.setAttribute('url_shortener.user_id', (req as any).user.id || '');
    }

    // Override res.end to capture response information
    const originalEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
        const duration = Date.now() - startTime;

        // Add response attributes
        span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response_size': res.get('Content-Length') || 0,
            'url_shortener.response_time_ms': duration,
        });

        // Set span status based on HTTP status code
        if (res.statusCode >= 400) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: `HTTP ${res.statusCode}`,
            });

            // Add error event
            span.addEvent('http.error', {
                'http.status_code': res.statusCode,
                'error.message': `HTTP ${res.statusCode} response`,
            });
        } else {
            span.setStatus({ code: SpanStatusCode.OK });
        }

        // Add performance markers
        if (duration > 1000) {
            span.addEvent('slow_request', {
                'duration_ms': duration,
                'threshold_ms': 1000,
            });
        }

        // End the span
        span.end();

        // Call original end method
        return originalEnd(...args);
    };

    // Handle errors
    res.on('error', (error) => {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
        });
        span.end();
    });

    next();
};

/**
 * Middleware to add trace context to logs
 */
export const traceContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const traceId = tracingService.getCurrentTraceId();
    const spanId = tracingService.getCurrentSpanId();

    if (traceId && spanId) {
        // Add trace context to request for use in other middleware/handlers
        (req as any).traceContext = {
            traceId,
            spanId,
        };

        // Add trace context to response headers for debugging
        res.set('X-Trace-Id', traceId);
        res.set('X-Span-Id', spanId);
    }

    next();
};

/**
 * Decorator for tracing service methods
 */
export function TraceMethod(operationName?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const spanName = operationName || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = function (...args: any[]) {
            if (!tracingService.isTracingEnabled()) {
                return originalMethod.apply(this, args);
            }

            const span = tracingService.createSpan(spanName, {
                kind: SpanKind.INTERNAL,
                attributes: {
                    'code.function': propertyKey,
                    'code.namespace': target.constructor.name,
                },
            });

            try {
                const result = originalMethod.apply(this, args);

                // Handle async methods
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

                // Handle sync methods
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
        };

        return descriptor;
    };
}

/**
 * Utility function to create a child span
 */
export function createChildSpan(
    name: string,
    attributes?: Record<string, string | number | boolean>
): any {
    return tracingService.createSpan(name, {
        kind: SpanKind.INTERNAL,
        attributes,
    });
}

/**
 * Utility function to add business context to current span
 */
export function addBusinessContext(context: {
    shortCode?: string;
    userId?: number;
    operation?: string;
    strategy?: string;
    cacheHit?: boolean;
}): void {
    const attributes: Record<string, string | number | boolean> = {};

    if (context.shortCode) {
        attributes['url_shortener.short_code'] = context.shortCode;
    }

    if (context.userId) {
        attributes['url_shortener.user_id'] = context.userId;
    }

    if (context.operation) {
        attributes['url_shortener.operation'] = context.operation;
    }

    if (context.strategy) {
        attributes['url_shortener.strategy'] = context.strategy;
    }

    if (context.cacheHit !== undefined) {
        attributes['url_shortener.cache_hit'] = context.cacheHit;
    }

    tracingService.addSpanAttributes(attributes);
}