import { Router } from "express"
import { AnalyticsController } from "../../controllers/analytics.controller"
import { asyncHandler } from "../../middleware/errorHandler"
import { authMiddleware } from "../../middleware/authMiddleware"
import {
    validateParams,
    validateQuery
} from "../../middleware/validationMiddleware"
import analyticsValidators from "../../validators/analytics.validator"

const router = Router()
const analyticsController = new AnalyticsController()

// Analytics for specific URL
router.get(
    "/:shortCode",
    authMiddleware.authenticate,
    validateParams(analyticsValidators.shortCode),
    validateQuery(analyticsValidators.dateRangeQuery),  // Changed from urlValidators.dateRange
    asyncHandler(analyticsController.getAnalytics)
)

// Realtime analytics
router.get(
    "/:shortCode/realtime",
    authMiddleware.authenticate,
    validateParams(analyticsValidators.shortCode),
    validateQuery(analyticsValidators.realtimeQuery),  // Added validation
    asyncHandler(analyticsController.getRealtimeAnalytics)
)

// Global analytics
router.get(
    "/global/summary",
    authMiddleware.authenticate,
    validateQuery(analyticsValidators.globalAnalyticsQuery),  // Changed from urlValidators.dateRange
    asyncHandler(analyticsController.getGlobalAnalytics)
)

// Invalidate cache
router.post(
    "/:shortCode/invalidate-cache",
    authMiddleware.authenticate,
    validateParams(analyticsValidators.shortCode),
    asyncHandler(analyticsController.invalidateCache)
)

router.get(
    "/cache/stats",
    authMiddleware.authenticate,
    asyncHandler(analyticsController.getCacheStats)
)

// WebSocket stats
router.get(
    "/websocket/stats",
    authMiddleware.authenticate,
    asyncHandler(analyticsController.getWebSocketStats)
)

export default router
