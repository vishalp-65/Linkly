import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    code?: string;
    details?: any;
}

export class CustomError extends Error implements AppError {
    public statusCode: number;
    public isOperational: boolean;
    public code?: string;
    public details?: any;

    constructor(
        message: string,
        statusCode: number = 500,
        code?: string,
        isOperational: boolean = true,
        details?: any
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }

    // Static factory methods for common errors
    static badRequest(message: string, code = 'BAD_REQUEST', details?: any) {
        return new CustomError(message, 400, code, true, details);
    }

    static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
        return new CustomError(message, 401, code);
    }

    static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN') {
        return new CustomError(message, 403, code);
    }

    static notFound(message: string, code = 'NOT_FOUND') {
        return new CustomError(message, 404, code);
    }

    static conflict(message: string, code = 'CONFLICT') {
        return new CustomError(message, 409, code);
    }

    static gone(message: string, code = 'GONE') {
        return new CustomError(message, 410, code);
    }

    static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
        return new CustomError(message, 500, code, false);
    }

    static serviceUnavailable(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
        return new CustomError(message, 503, code, false);
    }
}

// Error handler middleware
export const errorHandler = (
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    // Handle specific error types
    let processedError = error;

    if (error.name === 'ValidationError' || (error as any).isJoi) {
        processedError = validationErrorHandler(error);
    } else if ((error as any).code && typeof (error as any).code === 'string') {
        // Database errors
        if ((error as any).code.match(/^23\d{3}$|^42\d{3}$/)) {
            processedError = databaseErrorHandler(error);
        }
        // Redis errors
        else if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes((error as any).code)) {
            processedError = redisErrorHandler(error);
        }
    }

    const statusCode = processedError.statusCode || 500;
    const message = processedError.message || 'Internal Server Error';
    const isOperational = processedError.isOperational !== false;
    const errorCode = processedError.code || 'INTERNAL_ERROR';

    // Log error with context
    const logContext = {
        statusCode,
        errorCode,
        isOperational,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: sanitizeBody(req.body),
        params: req.params,
        query: req.query,
    };

    if (statusCode >= 500) {
        logger.error('Server error occurred', {
            ...logContext,
            message: error.message,
            stack: error.stack,
        });
    } else if (statusCode >= 400) {
        logger.warn('Client error occurred', {
            ...logContext,
            message: error.message,
        });
    }

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    const errorResponse = {
        success: false,
        error: errorCode,
        message,
        ...(processedError.details && { details: processedError.details }),
        ...(isDevelopment && {
            stack: error.stack,
            originalError: error.name !== 'CustomError' ? {
                name: error.name,
                message: error.message,
            } : undefined,
        }),
        meta: {
            timestamp: new Date().toISOString(),
            path: req.url,
            method: req.method,
        },
    };

    res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
    const error = new CustomError(
        `Route ${req.originalUrl} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
};

// Validation error handler
export const validationErrorHandler = (error: any): CustomError => {
    if (error.isJoi) {
        const message = error.details.map((detail: any) => detail.message).join(', ');
        const details = error.details.map((detail: any) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
        }));
        return new CustomError(
            `Validation failed: ${message}`,
            400,
            'VALIDATION_ERROR',
            true,
            details
        );
    }

    if (error.name === 'ValidationError') {
        const message = Object.values(error.errors || {})
            .map((err: any) => err.message)
            .join(', ');
        return new CustomError(
            `Validation failed: ${message}`,
            400,
            'VALIDATION_ERROR'
        );
    }

    return error;
};

// Database error handler
export const databaseErrorHandler = (error: any): CustomError => {
    // PostgreSQL error codes
    const pgErrors: Record<string, { message: string; code: string; operational: boolean }> = {
        '23505': {
            message: 'Resource already exists',
            code: 'DUPLICATE_ENTRY',
            operational: true,
        },
        '23503': {
            message: 'Referenced resource does not exist',
            code: 'FOREIGN_KEY_VIOLATION',
            operational: true,
        },
        '23502': {
            message: 'Required field is missing',
            code: 'NOT_NULL_VIOLATION',
            operational: true,
        },
        '23514': {
            message: 'Check constraint violation',
            code: 'CHECK_VIOLATION',
            operational: true,
        },
        '42P01': {
            message: 'Database table not found',
            code: 'UNDEFINED_TABLE',
            operational: false,
        },
        '42703': {
            message: 'Database column not found',
            code: 'UNDEFINED_COLUMN',
            operational: false,
        },
        '42P02': {
            message: 'Database parameter not found',
            code: 'UNDEFINED_PARAMETER',
            operational: false,
        },
        '08006': {
            message: 'Database connection failure',
            code: 'CONNECTION_FAILURE',
            operational: false,
        },
        '57P01': {
            message: 'Database admin shutdown',
            code: 'ADMIN_SHUTDOWN',
            operational: false,
        },
    };

    const errorInfo = pgErrors[error.code];

    if (errorInfo) {
        return new CustomError(
            errorInfo.message,
            errorInfo.operational ? 400 : 500,
            errorInfo.code,
            errorInfo.operational,
            {
                constraint: error.constraint,
                table: error.table,
                column: error.column,
            }
        );
    }

    // Generic database error
    return new CustomError(
        'Database operation failed',
        500,
        'DATABASE_ERROR',
        false,
        {
            code: error.code,
            detail: error.detail,
        }
    );
};

// Redis error handler
export const redisErrorHandler = (error: any): CustomError => {
    const redisErrors: Record<string, { message: string; code: string }> = {
        'ECONNREFUSED': {
            message: 'Cache service connection refused',
            code: 'CACHE_CONNECTION_REFUSED',
        },
        'ENOTFOUND': {
            message: 'Cache service not found',
            code: 'CACHE_NOT_FOUND',
        },
        'ETIMEDOUT': {
            message: 'Cache service timeout',
            code: 'CACHE_TIMEOUT',
        },
        'READONLY': {
            message: 'Cache service is read-only',
            code: 'CACHE_READONLY',
        },
        'NOAUTH': {
            message: 'Cache service authentication failed',
            code: 'CACHE_AUTH_FAILED',
        },
    };

    const errorInfo = redisErrors[error.code];

    if (errorInfo) {
        return new CustomError(
            errorInfo.message,
            503,
            errorInfo.code,
            false
        );
    }

    return new CustomError(
        'Cache operation failed',
        500,
        'CACHE_ERROR',
        false
    );
};

// Kafka error handler
export const kafkaErrorHandler = (error: any): CustomError => {
    const kafkaErrors: Record<string, { message: string; code: string }> = {
        'ECONNREFUSED': {
            message: 'Kafka connection refused',
            code: 'KAFKA_CONNECTION_REFUSED',
        },
        'REQUEST_TIMED_OUT': {
            message: 'Kafka request timeout',
            code: 'KAFKA_TIMEOUT',
        },
        'BROKER_NOT_AVAILABLE': {
            message: 'Kafka broker not available',
            code: 'KAFKA_BROKER_UNAVAILABLE',
        },
    };

    const errorInfo = kafkaErrors[error.code] || kafkaErrors[error.type];

    if (errorInfo) {
        return new CustomError(
            errorInfo.message,
            503,
            errorInfo.code,
            false
        );
    }

    return new CustomError(
        'Message queue operation failed',
        500,
        'KAFKA_ERROR',
        false
    );
};

// Sanitize request body for logging (remove sensitive data)
function sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

// Unhandled rejection handler
export const unhandledRejectionHandler = (): void => {
    process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
        logger.error('Unhandled Rejection detected', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise.toString(),
        });

        // Optionally exit the process in production
        if (process.env.NODE_ENV === 'production') {
            console.error('Unhandled Rejection - shutting down gracefully...');
            process.exit(1);
        }
    });
};

// Uncaught exception handler
export const uncaughtExceptionHandler = (): void => {
    process.on('uncaughtException', (error: Error) => {
        logger.error('Uncaught Exception detected', {
            message: error.message,
            stack: error.stack,
        });

        console.error('Uncaught Exception - shutting down...');
        process.exit(1);
    });
};

export default {
    errorHandler,
    asyncHandler,
    notFoundHandler,
    validationErrorHandler,
    databaseErrorHandler,
    redisErrorHandler,
    kafkaErrorHandler,
    CustomError,
    unhandledRejectionHandler,
    uncaughtExceptionHandler,
};
