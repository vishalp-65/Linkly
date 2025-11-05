import { Router } from 'express';
import v1Routes from './v1';
import healthRoutes from './health.routes';
import redirectRoutes from './redirect.routes';

const router = Router();

// Health and monitoring routes (no version prefix)
router.use('/', healthRoutes);

// API versioned routes
router.use('/api/v1', v1Routes);

// Redirect routes (at root level for short URLs)
router.use('/', redirectRoutes);

export default router;