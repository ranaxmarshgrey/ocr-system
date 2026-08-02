import mongoose from 'mongoose';
import {
  FREIGHT_TYPES,
  ACKNOWLEDGEMENT_STATUSES,
  VERIFICATION_STATUSES,
  ROUTES,
} from '../constants/receipt.js';

const receiptSchema = new mongoose.Schema(
  {
    lrNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    route: {
      type: String,
      enum: ROUTES,
      default: 'MALUR-MASTHI',
      index: true,
    },
    ewayBillNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    consignor: {
      type: String,
      required: true,
      trim: true,
    },
    consignee: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    articles: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    freightType: {
      type: String,
      enum: FREIGHT_TYPES,
      default: 'Paid',
    },
    acknowledgementStatus: {
      type: String,
      enum: ACKNOWLEDGEMENT_STATUSES,
      default: 'Pending',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    imagePath: {
      type: String,
      trim: true,
      default: '',
    },
    ocrConfidence: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    enteredBy: {
      type: String,
      trim: true,
      default: '',
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model('Receipt', receiptSchema);
