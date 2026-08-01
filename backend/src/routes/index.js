import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import receiptRoutes from './receiptRoutes.js';
import uploadRoutes from './uploadRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/receipts', receiptRoutes);
router.use('/uploads', uploadRoutes);

export default router;
