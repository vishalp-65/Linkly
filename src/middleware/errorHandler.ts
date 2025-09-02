import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
    public statusCode: number;
    public isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
export const errorHandler = (
    error: AppError,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    const isOperational = error.isOperational !== false;

    // Log error with context
    logger.logError(error, {
        statusCode,
        isOperational,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body,
        params: req.params,
        query: req.query,
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    const errorResponse = {
        success: false,
        error: {
            message,
            ...(isDevelopment && {
                stack: error.stack,
                statusCode,
            }),
        },
        timestamp: new Date().toISOString(),
        path: req.url,
        method: req.method,
    };

    res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
    const error = new CustomError(`Route ${req.originalUrl} not found`, 404);
    next(error);
};

// Validation error handler
export const validationErrorHandler = (error: any): CustomError => {
    if (error.isJoi) {
        const message = error.details.map((detail: any) => detail.message).join(', ');
        return new CustomError(`Validation Error: ${message}`, 400);
    }
    return error;
};

// Database error handler
export const databaseErrorHandler = (error: any): CustomError => {
    // PostgreSQL error codes
    switch (error.code) {
        case '23505': // Unique violation
            return new CustomError('Resource already exists', 409);
        case '23503': // Foreign key violation
            return new CustomError('Referenced resource does not exist', 400);
        case '23502': // Not null violation
            return new CustomError('Required field is missing', 400);
        case '42P01': // Undefined table
            return new CustomError('Database table not found', 500, false);
        case '42703': // Undefined column
            return new CustomError('Database column not found', 500, false);
        default:
            return new CustomError('Database operation failed', 500, false);
    }
};

// Redis error handler
export const redisErrorHandler = (error: any): CustomError => {
    if (error.code === 'ECONNREFUSED') {
        return new CustomError('Cache service unavailable', 503, false);
    }
    if (error.code === 'ENOTFOUND') {
        return new CustomError('Cache service not found', 503, false);
    }
    return new CustomError('Cache operation failed', 500, false);
};

export default {
    errorHandler,
    asyncHandler,
    notFoundHandler,
    validationErrorHandler,
    databaseErrorHandler,
    redisErrorHandler,
    CustomError,
};
