import { Router } from 'express';
import { UrlController } from '../../controllers/url.controller';
import { RedirectController } from '../../controllers/redirect.controller';
import { validate } from '../../middleware/validation.middleware';
import { urlValidators } from '../../validators/url.validator';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();
const urlController = new UrlController();
const redirectController = new RedirectController();

// URL Management Routes
router.post(
    '/shorten',
    validate(urlValidators.shorten, 'body'),
    asyncHandler(urlController.createShortUrl)
);

router.delete(
    '/:shortCode',
    validate(urlValidators.shortCode, 'params'),
    asyncHandler(urlController.deleteUrl)
);

router.get(
    '/resolve/:shortCode',
    validate(urlValidators.shortCode, 'params'),
    asyncHandler(urlController.resolveUrl)
);

// Redirect Service Routes
router.get(
    '/redirect/stats',
    asyncHandler(redirectController.getStats)
);

router.get(
    '/redirect/health',
    asyncHandler(redirectController.healthCheck)
);

export default router;