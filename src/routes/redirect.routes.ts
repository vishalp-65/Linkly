import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';
import { validate } from '../middleware/validation.middleware';
import { urlValidators } from '../validators/url.validator';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const redirectController = new RedirectController();

// Main redirect route - should be at root level
router.get(
    '/:shortCode',
    validate(urlValidators.shortCode, 'params'),
    asyncHandler(redirectController.handleRedirect)
);

export default router;