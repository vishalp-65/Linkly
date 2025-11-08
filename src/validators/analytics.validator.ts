// File: src/validators/analytics.validator.ts

import Joi from 'joi'

export const analyticsValidators = {
    // Validate shortCode parameter
    shortCode: Joi.object({
        shortCode: Joi.string()
            .pattern(/^[a-zA-Z0-9_-]{3,10}$/)
            .required()
            .messages({
                "string.pattern.base":
                    "Short code must be 3-10 characters long and contain only letters, numbers, hyphens, and underscores",
                "any.required": "Short code is required"
            })
    }),

    // Validate date range query parameters
    dateRangeQuery: Joi.object({
        date_from: Joi.date()
            .iso()
            .max('now')
            .optional()
            .messages({
                'date.format': 'date_from must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_from cannot be in the future'
            }),
        date_to: Joi.date()
            .iso()
            .max('now')
            .greater(Joi.ref('date_from'))
            .optional()
            .messages({
                'date.format': 'date_to must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_to cannot be in the future',
                'date.greater': 'date_to must be after date_from'
            }),
        country_code: Joi.string()
            .length(2)
            .uppercase()
            .pattern(/^[A-Z]{2}$/)
            .optional()
            .messages({
                'string.length': 'country_code must be a 2-letter country code',
                'string.uppercase': 'country_code must be uppercase',
                'string.pattern.base': 'country_code must contain only letters'
            }),
        device_type: Joi.string()
            .valid('mobile', 'desktop', 'tablet', 'unknown')
            .lowercase()
            .optional()
            .messages({
                'any.only': 'device_type must be one of: mobile, desktop, tablet, unknown'
            }),
        no_cache: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'no_cache must be a boolean value'
            })
    }),

    // Validate global analytics query parameters
    globalAnalyticsQuery: Joi.object({
        date_from: Joi.date()
            .iso()
            .max('now')
            .optional()
            .messages({
                'date.format': 'date_from must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_from cannot be in the future'
            }),
        date_to: Joi.date()
            .iso()
            .max('now')
            .greater(Joi.ref('date_from'))
            .optional()
            .messages({
                'date.format': 'date_to must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_to cannot be in the future',
                'date.greater': 'date_to must be after date_from'
            }),
        no_cache: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'no_cache must be a boolean value'
            })
    }),

    // Validate realtime analytics query parameters
    realtimeQuery: Joi.object({
        date_from: Joi.date()
            .iso()
            .max('now')
            .optional()
            .messages({
                'date.format': 'date_from must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_from cannot be in the future'
            }),
        date_to: Joi.date()
            .iso()
            .max('now')
            .greater(Joi.ref('date_from'))
            .optional()
            .messages({
                'date.format': 'date_to must be a valid ISO date (YYYY-MM-DD)',
                'date.max': 'date_to cannot be in the future',
                'date.greater': 'date_to must be after date_from'
            }),
        country_code: Joi.string()
            .length(2)
            .uppercase()
            .pattern(/^[A-Z]{2}$/)
            .optional()
            .messages({
                'string.length': 'country_code must be a 2-letter country code',
                'string.uppercase': 'country_code must be uppercase',
                'string.pattern.base': 'country_code must contain only letters'
            }),
        device_type: Joi.string()
            .valid('mobile', 'desktop', 'tablet', 'unknown')
            .lowercase()
            .optional()
            .messages({
                'any.only': 'device_type must be one of: mobile, desktop, tablet, unknown'
            })
    }),

    // Custom validation for date ranges (can be used in middleware)
    validateDateRange: (date_from?: string, date_to?: string) => {
        if (date_from && date_to) {
            const from = new Date(date_from)
            const to = new Date(date_to)
            const diffInDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))

            if (diffInDays > 365) {
                throw new Error('Date range cannot exceed 365 days')
            }
        }
    }
}

export default analyticsValidators