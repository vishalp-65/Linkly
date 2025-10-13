import { Router } from "express"
import { UrlController } from "../../controllers/url.controller"
import { RedirectController } from "../../controllers/redirect.controller"
import { urlValidators } from "../../validators/url.validator"
import { asyncHandler } from "../../middleware/errorHandler"
import { authMiddleware } from "../../middleware/authMiddleware"
import {
    validateParams,
    validateQuery,
    validateRequest
} from "../../middleware/validationMiddleware"

const router = Router()
const urlController = new UrlController()
const redirectController = new RedirectController()

// URL Management Routes
router.post(
    "/shorten",
    authMiddleware.optionalAuthenticate,
    validateRequest(urlValidators.shorten),
    asyncHandler(urlController.createShortUrl)
)

router.get(
    "/get-all",
    authMiddleware.authenticate,
    validateQuery(urlValidators.getAllUrls),
    asyncHandler(urlController.getAllUrl)
)

router.get(
    "/check-alias",
    authMiddleware.authenticate,
    asyncHandler(urlController.checkAliasAvailability)
)

router.delete(
    "/:shortCode",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.deleteUrl)
)

router.get(
    "/resolve/:shortCode",
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.resolveUrl)
)

// Redirect Service Routes
router.get("/redirect/stats", asyncHandler(redirectController.getStats))

router.get("/redirect/health", asyncHandler(redirectController.healthCheck))

export default router
