import { Router } from 'express';
import urlRoutes from './url.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.use('/url', urlRoutes);
router.use('/analytics', analyticsRoutes);

export default router;