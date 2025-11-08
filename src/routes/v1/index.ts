import { Router } from 'express';
import urlRoutes from './url.routes';
import analyticsRoutes from './analytics.routes';
import authRoutes from './auth.routes';
import preferencesRoutes from './preferences.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/url', urlRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/user', preferencesRoutes);

export default router;