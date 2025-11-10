import Joi from "joi"

export const urlValidators = {
    shorten: Joi.object({
        url: Joi.string()
            .uri({ scheme: ["http", "https"] })
            .max(2048)
            .required()
            .messages({
                "string.uri": "URL must be a valid HTTP or HTTPS URL",
                "string.max": "URL cannot exceed 2048 characters",
                "any.required": "URL is required"
            }),
        customAlias: Joi.string()
            .pattern(/^[a-zA-Z0-9_-]{3,30}$/)
            .optional()
            .messages({
                "string.pattern.base":
                    "Custom alias must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores"
            }),
        expiryDays: Joi.number()
            .integer()
            .min(1)
            .max(3650)
            .optional()
            .messages({
                "number.min": "Expiry days must be at least 1",
                "number.max": "Expiry days cannot exceed 3650 (10 years)"
            })
    }),

    shortCode: Joi.object({
        shortCode: Joi.string()
            .pattern(/^[a-zA-Z0-9_-]{3,30}$/)
            .required()
            .messages({
                "string.pattern.base":
                    "Short code must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores",
                "any.required": "Short code is required"
            })
    }),

    dateRange: Joi.object({
        date_from: Joi.date().iso().optional(),
        date_to: Joi.date()
            .iso()
            .min(Joi.ref("date_from"))
            .optional()
            .messages({
                "date.min": "date_to cannot be before date_from"
            }),
        country_code: Joi.string().length(2).uppercase().optional(),
        device_type: Joi.string()
            .valid("mobile", "desktop", "tablet")
            .optional(),
        no_cache: Joi.boolean().optional()
    }),

    getAllUrls: Joi.object({
        // Search
        search: Joi.string().trim().min(1).max(200).optional(),

        // Pagination
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(100).default(20),

        // Sorting
        sortBy: Joi.string()
            .valid(
                "created_at",
                "access_count",
                "last_accessed_at",
                "expires_at",
                "short_code"
            )
            .default("created_at"),
        sortOrder: Joi.string()
            .valid("asc", "desc", "ASC", "DESC")
            .default("desc"),

        // Filters
        isCustomAlias: Joi.boolean().optional(),
        hasExpiry: Joi.boolean().optional(),
        isExpired: Joi.boolean().optional(),
        dateFrom: Joi.date().iso().optional(),
        dateTo: Joi.date().iso().min(Joi.ref("dateFrom")).optional(),
        minAccessCount: Joi.number().integer().min(0).optional(),
        maxAccessCount: Joi.number()
            .integer()
            .min(Joi.ref("minAccessCount"))
            .optional()
    })
}
