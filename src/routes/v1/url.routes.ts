import { Router } from "express"
import { UrlController } from "../../controllers/url.controller"
import { RedirectController } from "../../controllers/redirect.controller"
import { urlValidators } from "../../validators/url.validator"
import { asyncHandler } from "../../middleware/errorHandler"
import { authMiddleware } from "../../middleware/authMiddleware"
import {
    validateParams,
    validateQuery,
    validateRequest,
} from "../../middleware/validationMiddleware"

const router = Router()
const urlController = new UrlController()
const redirectController = new RedirectController()

// ---------------------------------------------
// URL Management Routes
// ---------------------------------------------

// Create Short URL
router.post(
    "/shorten",
    authMiddleware.optionalAuthenticate,
    validateRequest(urlValidators.shorten),
    asyncHandler(urlController.createShortUrl)
)

// Get All URLs (keep before dynamic routes)
router.get(
    "/get-all",
    authMiddleware.authenticate,
    validateQuery(urlValidators.getAllUrls),
    asyncHandler(urlController.getAllUrl)
)

// Check custom alias availability
router.get(
    "/check-alias",
    authMiddleware.authenticate,
    asyncHandler(urlController.checkAliasAvailability)
)

// Get URL stats (authenticated)
router.get(
    "/:shortCode/stats",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.getUrlStats)
)

// Resolve URL (used internally or by redirect service)
router.get(
    "/resolve/:shortCode",
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.resolveUrl)
)

// Update Short URL
router.put(
    "/:shortCode",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    validateRequest(urlValidators.updateUrl),
    asyncHandler(urlController.updateUrl)
)

// Delete Short URL
router.delete(
    "/:shortCode",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.deleteUrl)
)

// Bulk Actions
router.post(
    "/bulk/delete",
    authMiddleware.authenticate,
    asyncHandler(urlController.bulkDelete)
)

router.post(
    "/bulk/update-expiry",
    authMiddleware.authenticate,
    asyncHandler(urlController.bulkUpdateExpiry)
)

// Get long/original URL by shortCode (keep last)
router.get(
    "/:shortCode",
    validateParams(urlValidators.shortCode),
    asyncHandler(urlController.getLongURL)
)

// ---------------------------------------------
// Redirect Service Routes (should not conflict)
// ---------------------------------------------
router.get("/redirect/stats", asyncHandler(redirectController.getStats))
router.get("/redirect/health", asyncHandler(redirectController.healthCheck))

export default router
