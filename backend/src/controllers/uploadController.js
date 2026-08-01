import { processReceiptImage } from '../services/imageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

export const uploadReceiptImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided. Use field name "image".', 400);
  }

  const result = await processReceiptImage(req.file.buffer, req.file.originalname);

  res.status(201).json({
    status: 'success',
    message: 'Receipt image uploaded and processed',
    data: result,
  });
});
