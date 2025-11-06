import { Router } from "express"
import { AuthController } from "../../controllers/auth.controller"
import { authMiddleware } from "../../middleware/authMiddleware"
import { validateRequest } from "../../middleware/validationMiddleware"
import { asyncHandler } from "../../middleware/errorHandler"
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    resetPasswordSchema,
    confirmResetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema
} from "../../validators/authValidators"

const router = Router()
const authController = new AuthController()

// Public Routes
router.post(
    "/register",
    validateRequest(registerSchema),
    asyncHandler(authController.register)
)

router.post(
    "/login",
    validateRequest(loginSchema),
    asyncHandler(authController.login)
)
router.post(
    "/refresh-token",
    validateRequest(refreshTokenSchema),
    asyncHandler(authController.refreshToken)
)
router.post("/logout", asyncHandler(authController.logout))
router.post(
    "/request-password-reset",
    validateRequest(resetPasswordSchema),
    asyncHandler(authController.requestPasswordReset)
)
router.post(
    "/confirm-password-reset",
    validateRequest(confirmResetPasswordSchema),
    asyncHandler(authController.confirmPasswordReset)
)

// Protected Routes
router.get(
    "/profile",
    authMiddleware.authenticate,
    asyncHandler(authController.getProfile)
)
router.put(
    "/profile",
    authMiddleware.authenticate,
    validateRequest(updateProfileSchema),
    asyncHandler(authController.updateProfile)
)
router.post(
    "/change-password",
    authMiddleware.authenticate,
    validateRequest(changePasswordSchema),
    asyncHandler(authController.changePassword)
)

// Utility
router.get(
    "/permissions",
    authMiddleware.optionalAuthenticate,
    asyncHandler(authController.getPermissions)
)

export default router
