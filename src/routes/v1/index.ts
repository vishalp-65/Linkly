import { Router } from 'express';
import urlRoutes from './url.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/url', urlRoutes);
router.use('/analytics', analyticsRoutes);

export default router;