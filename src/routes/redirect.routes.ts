import { Router } from 'express';
import { RedirectController } from '../controllers/redirect.controller';
import { urlValidators } from '../validators/url.validator';
import { asyncHandler } from '../middleware/errorHandler';
import { validateParams } from '../middleware/validationMiddleware';

const router = Router();
const redirectController = new RedirectController();

// Main redirect route - should be at root level
router.get(
    '/:shortCode',
    validateParams(urlValidators.shortCode),
    asyncHandler(redirectController.handleRedirect)
);

export default router;