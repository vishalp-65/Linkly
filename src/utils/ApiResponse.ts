import { Response } from 'express';

export class ApiResponse {
    static success(res: Response, data: any, statusCode = 200, meta?: any) {
        return res.status(statusCode).json({
            success: true,
            data,
            ...(meta && { meta: { ...meta, timestamp: new Date().toISOString() } })
        });
    }

    static error(res: Response, error: any, statusCode = 500) {
        return res.status(statusCode).json({
            success: false,
            error: error.code || 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred',
            ...(error.details && { details: error.details }),
            meta: {
                timestamp: new Date().toISOString()
            }
        });
    }

    static created(res: Response, data: any, meta?: any) {
        return ApiResponse.success(res, data, 201, meta);
    }

    static noContent(res: Response) {
        return res.status(204).send();
    }
}