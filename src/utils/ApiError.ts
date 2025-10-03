export class ApiError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'ApiError';
        Error.captureStackTrace(this, this.constructor);
    }

    static badRequest(message: string, code = 'BAD_REQUEST') {
        return new ApiError(400, code, message);
    }

    static unauthorized(message = 'Authentication required') {
        return new ApiError(401, 'UNAUTHORIZED', message);
    }

    static forbidden(message = 'Insufficient permissions') {
        return new ApiError(403, 'FORBIDDEN', message);
    }

    static notFound(message: string, code = 'NOT_FOUND') {
        return new ApiError(404, code, message);
    }

    static conflict(message: string, code = 'CONFLICT') {
        return new ApiError(409, code, message);
    }

    static gone(message: string, code = 'GONE') {
        return new ApiError(410, code, message);
    }

    static internal(message = 'Internal server error') {
        return new ApiError(500, 'INTERNAL_ERROR', message);
    }

    static serviceUnavailable(message = 'Service unavailable') {
        return new ApiError(503, 'SERVICE_UNAVAILABLE', message);
    }
}