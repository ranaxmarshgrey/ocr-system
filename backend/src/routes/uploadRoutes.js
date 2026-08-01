import { Router } from 'express';
import { uploadReceiptImage as uploadMiddleware, handleMulterError } from '../middlewares/upload.js';
import { uploadReceiptImage } from '../controllers/uploadController.js';

const router = Router();

router.post(
  '/receipt',
  uploadMiddleware,
  handleMulterError,
  uploadReceiptImage,
);

export default router;
