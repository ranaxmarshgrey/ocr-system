import { z } from 'zod';
import {
  FREIGHT_TYPES,
  ACKNOWLEDGEMENT_STATUSES,
  VERIFICATION_STATUSES,
  ROUTES,
} from '../constants/receipt.js';

const optionalString = z.string().trim().optional().or(z.literal(''));

const createReceiptSchema = z.object({
  lrNumber: z.string().trim().min(1, 'LR Number is required'),
  route: z.enum(ROUTES).optional(),
  date: z.coerce.date({ invalid_type_error: 'Date must be a valid date' }),
  consignor: z.string().trim().min(1, 'Consignor is required'),
  consignee: z.string().trim().min(1, 'Consignee is required'),
  destination: z.string().trim().min(1, 'Destination is required'),
  articles: optionalString,
  description: optionalString,
  invoiceNumber: optionalString,
  freightType: z.enum(FREIGHT_TYPES).optional(),
  acknowledgementStatus: z.enum(ACKNOWLEDGEMENT_STATUSES).optional(),
  remarks: optionalString,
  imagePath: optionalString,
  ocrConfidence: z
    .number()
    .min(0, 'OCR confidence must be between 0 and 100')
    .max(100, 'OCR confidence must be between 0 and 100')
    .nullable()
    .optional(),
  enteredBy: optionalString,
  verificationStatus: z.enum(VERIFICATION_STATUSES).optional(),
});

const updateReceiptSchema = createReceiptSchema.partial();

export { createReceiptSchema, updateReceiptSchema };
