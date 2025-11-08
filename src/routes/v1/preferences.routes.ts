import { Router } from 'express';
import { PreferencesController } from '../../controllers/preferences.controller';
import { authMiddleware } from '../../middleware/authMiddleware';
import { validate } from '../../middleware/validation.middleware';
import {
    updatePreferencesSchema,
    updateNotificationSettingsSchema,
    testWebhookSchema,
    updateEmailSchema,
    deleteAccountSchema
} from '../../validators/preferences.validator';

const router = Router();
const preferencesController = new PreferencesController();

// All routes require authentication
router.use(authMiddleware.authenticate);

// User Preferences Routes
router.get('/preferences', preferencesController.getUserPreferences);
router.put(
    '/preferences',
    validate(updatePreferencesSchema),
    preferencesController.updateUserPreferences
);

// Notification Settings Routes
router.get('/notifications', preferencesController.getNotificationSettings);
router.put(
    '/notifications',
    validate(updateNotificationSettingsSchema),
    preferencesController.updateNotificationSettings
);

// Webhook Test Route
router.post(
    '/notifications/test-webhook',
    validate(testWebhookSchema),
    preferencesController.testWebhook
);

// Account Management Routes
router.get('/account', preferencesController.getAccountInfo);
router.put(
    '/account/email',
    validate(updateEmailSchema),
    preferencesController.updateEmail
);
router.delete(
    '/account',
    validate(deleteAccountSchema),
    preferencesController.deleteAccount
);

export default router;
