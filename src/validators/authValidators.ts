import Joi from 'joi';

export const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
    password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            'any.required': 'Password is required',
        }),
    firstName: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.min': 'First name cannot be empty',
            'string.max': 'First name cannot exceed 100 characters',
        }),
    lastName: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .messages({
            'string.min': 'Last name cannot be empty',
            'string.max': 'Last name cannot exceed 100 characters',
        }),
});

export const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
    password: Joi.string()
        .required()
        .messages({
            'any.required': 'Password is required',
        }),
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string()
        .required()
        .messages({
            'any.required': 'Refresh token is required',
        }),
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
});

export const confirmResetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            'any.required': 'Reset token is required',
        }),
    newPassword: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            'any.required': 'New password is required',
        }),
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string()
        .required()
        .messages({
            'any.required': 'Current password is required',
        }),
    newPassword: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            'any.required': 'New password is required',
        }),
});

export const updateProfileSchema = Joi.object({
    firstName: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .allow('')
        .messages({
            'string.max': 'First name cannot exceed 100 characters',
        }),
    lastName: Joi.string()
        .min(1)
        .max(100)
        .optional()
        .allow('')
        .messages({
            'string.max': 'Last name cannot exceed 100 characters',
        }),
    avatarUrl: Joi.string()
        .uri()
        .optional()
        .allow('')
        .messages({
            'string.uri': 'Avatar URL must be a valid URL',
        }),
});

export const googleAuthSchema = Joi.object({
    googleToken: Joi.string()
        .required()
        .messages({
            'any.required': 'Google token is required',
        }),
});