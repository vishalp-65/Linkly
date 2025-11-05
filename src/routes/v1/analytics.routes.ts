import { Router } from 'express';
import { AnalyticsController } from '../../controllers/analytics.controller';
import { validate } from '../../middleware/validation.middleware';
import { urlValidators } from '../../validators/url.validator';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();
const analyticsController = new AnalyticsController();

router.get(
    '/:shortCode',
    validate(urlValidators.shortCode, 'params'),
    validate(urlValidators.dateRange, 'query'),
    asyncHandler(analyticsController.getAnalytics)
);

router.get(
    '/:shortCode/realtime',
    validate(urlValidators.shortCode, 'params'),
    asyncHandler(analyticsController.getRealtimeAnalytics)
);

router.get(
    '/global/summary',
    validate(urlValidators.dateRange, 'query'),
    asyncHandler(analyticsController.getGlobalAnalytics)
);

router.post(
    '/:shortCode/invalidate-cache',
    validate(urlValidators.shortCode, 'params'),
    asyncHandler(analyticsController.invalidateCache)
);

router.get(
    '/cache/stats',
    asyncHandler(analyticsController.getCacheStats)
);

export default router;