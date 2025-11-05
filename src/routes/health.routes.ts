import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const healthController = new HealthController();

router.get('/health', asyncHandler(healthController.basicHealthCheck));
router.get('/ready', asyncHandler(healthController.readinessCheck));
router.get('/live', healthController.livenessCheck);
router.get('/metrics', asyncHandler(healthController.getMetrics));

export default router;
