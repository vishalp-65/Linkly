import Joi from 'joi';

export const updatePreferencesSchema = Joi.object({
    duplicateStrategy: Joi.string()
        .valid('generate_new', 'reuse_existing')
        .optional()
        .messages({
            'any.only': 'Duplicate strategy must be either "generate_new" or "reuse_existing"',
        }),

    defaultExpiry: Joi.number()
        .integer()
        .min(1)
        .max(3650)
        .allow('', null)
        .optional()
        .messages({
            'number.min': 'Default expiry must be at least 1 day',
            'number.max': 'Default expiry cannot exceed 3650 days',
        }),

    customDomain: Joi.string()
        .pattern(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/)
        .allow('', null)
        .optional()
        .messages({
            'string.pattern.base': 'Invalid custom domain format',
        }),

    enableAnalytics: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Enable analytics must be a boolean',
        }),

    enableQRCode: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Enable QR code must be a boolean',
        }),

    enablePasswordProtection: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Enable password protection must be a boolean',
        }),
});

export const updateNotificationSettingsSchema = Joi.object({
    emailNotifications: Joi.object({
        urlExpiring: Joi.boolean().optional(),
        urlExpired: Joi.boolean().optional(),
        highTraffic: Joi.boolean().optional(),
        weeklyReport: Joi.boolean().optional(),
        monthlyReport: Joi.boolean().optional(),
    }).optional(),

    webhooks: Joi.object({
        enabled: Joi.boolean().optional(),
        url: Joi.string()
            .uri({ scheme: ['http', 'https'] })
            .allow('')
            .optional()
            .messages({
                'string.uri': 'Invalid webhook URL format',
            }),
        secret: Joi.string()
            .allow('')
            .optional(),
        events: Joi.object({
            urlCreated: Joi.boolean().optional(),
            urlClicked: Joi.boolean().optional(),
            urlExpired: Joi.boolean().optional(),
            urlDeleted: Joi.boolean().optional(),
        }).optional(),
    }).optional(),
});

export const testWebhookSchema = Joi.object({
    url: Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .required()
        .messages({
            'any.required': 'Webhook URL is required',
            'string.uri': 'Invalid webhook URL format',
        }),

    secret: Joi.string()
        .optional()
        .allow(''),
});

export const updateEmailSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'any.required': 'Email is required',
            'string.email': 'Invalid email format',
        }),

    currentPassword: Joi.string()
        .required()
        .messages({
            'any.required': 'Current password is required',
        }),
});

export const deleteAccountSchema = Joi.object({
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required',
        }),

    confirmText: Joi.string()
        .valid('DELETE')
        .required()
        .messages({
            'any.required': 'Confirmation text is required',
            'any.only': 'Confirmation text must be "DELETE"',
        }),
});
