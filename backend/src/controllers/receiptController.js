import * as receiptService from '../services/receiptService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createReceipt = asyncHandler(async (req, res) => {
  const { receipt, warnings } = await receiptService.createReceipt(req.body);

  const response = {
    status: 'success',
    data: receipt,
  };

  if (warnings.length > 0) {
    response.warnings = warnings;
  }

  res.status(201).json(response);
});

export const getReceipts = asyncHandler(async (req, res) => {
  const receipts = await receiptService.getAllReceipts(req.query);
  res.json({
    status: 'success',
    count: receipts.length,
    data: receipts,
  });
});

export const getDashboardStats = asyncHandler(async (_req, res) => {
  const stats = await receiptService.getDashboardStats();
  res.json({
    status: 'success',
    data: stats,
  });
});

export const getReceiptById = asyncHandler(async (req, res) => {
  const receipt = await receiptService.getReceiptById(req.params.id);
  res.json({
    status: 'success',
    data: receipt,
  });
});

export const updateReceipt = asyncHandler(async (req, res) => {
  const receipt = await receiptService.updateReceipt(req.params.id, req.body);
  res.json({
    status: 'success',
    data: receipt,
  });
});

export const deleteReceipt = asyncHandler(async (req, res) => {
  const receipt = await receiptService.deleteReceipt(req.params.id);
  res.json({
    status: 'success',
    message: 'Receipt deleted successfully',
    data: receipt,
  });
});

export const processOCR = asyncHandler(async (req, res) => {
  const { imagePath, id } = req.body;
  const targetPath = imagePath || (id ? `/uploads/processed/${id}.jpg` : null);

  const { processReceiptOCR } = await import('../services/ocrService.js');
  const result = await processReceiptOCR(targetPath);

  res.json({
    status: 'success',
    message: 'OCR extraction completed',
    data: result,
  });
});

