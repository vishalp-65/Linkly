import { Router } from "express"
import { AnalyticsController } from "../../controllers/analytics.controller"
import { urlValidators } from "../../validators/url.validator"
import { asyncHandler } from "../../middleware/errorHandler"
import { authMiddleware } from "../../middleware/authMiddleware"
import {
    validateParams,
    validateQuery
} from "../../middleware/validationMiddleware"

const router = Router()
const analyticsController = new AnalyticsController()

router.get(
    "/:shortCode",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    validateQuery(urlValidators.dateRange),
    asyncHandler(analyticsController.getAnalytics)
)

router.get(
    "/:shortCode/realtime",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    asyncHandler(analyticsController.getRealtimeAnalytics)
)

router.get(
    "/global/summary",
    authMiddleware.authenticate,
    validateQuery(urlValidators.dateRange),
    asyncHandler(analyticsController.getGlobalAnalytics)
)

router.post(
    "/:shortCode/invalidate-cache",
    authMiddleware.authenticate,
    validateParams(urlValidators.shortCode),
    asyncHandler(analyticsController.invalidateCache)
)

router.get(
    "/cache/stats",
    authMiddleware.authenticate,
    asyncHandler(analyticsController.getCacheStats)
)

export default router
