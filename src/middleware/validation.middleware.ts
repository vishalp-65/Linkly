import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ApiError } from '../utils';

type ValidationSource = 'body' | 'params' | 'query';

export const validate = (schema: Schema, source: ValidationSource = 'body') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const data = req[source];
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const message = error.details.map(detail => detail.message).join(', ');
            next(new ApiError(400, 'VALIDATION_ERROR', message));
            return;
        }

        // Replace with validated and sanitized value
        req[source] = value;
        next();
    };
};