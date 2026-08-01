import { Router } from 'express';
import {
  createReceipt,
  getReceipts,
  getReceiptById,
  updateReceipt,
  deleteReceipt,
  processOCR,
  getDashboardStats,
} from '../controllers/receiptController.js';
import { validate } from '../middlewares/validate.js';
import {
  createReceiptSchema,
  updateReceiptSchema,
} from '../validators/receiptValidator.js';

const router = Router();

router.get('/stats', getDashboardStats);
router.post('/ocr', processOCR);
router.post('/', validate(createReceiptSchema), createReceipt);
router.get('/', getReceipts);
router.get('/:id', getReceiptById);
router.put('/:id', validate(updateReceiptSchema), updateReceipt);
router.delete('/:id', deleteReceipt);

export default router;
