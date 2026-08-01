import Receipt from '../models/Receipt.js';
import { AppError } from '../utils/AppError.js';

export async function createReceipt(data) {
  const duplicate = await Receipt.findOne({ lrNumber: data.lrNumber }).lean();
  const receipt = await Receipt.create(data);

  const warnings = [];
  if (duplicate) {
    warnings.push(
      `A receipt with LR Number "${data.lrNumber}" already exists (ID: ${duplicate._id})`,
    );
  }

  return { receipt, warnings };
}

/**
 * Fetch receipts with search & multi-filtering capabilities
 * @param {object} params - { search, acknowledgementStatus, freightType, destination, startDate, endDate }
 */
export async function getAllReceipts(params = {}) {
  const filter = {};

  // Keyword search across multiple fields
  const searchQuery = params.search || params.q;
  if (searchQuery && searchQuery.trim()) {
    const regex = new RegExp(searchQuery.trim(), 'i');
    filter.$or = [
      { lrNumber: regex },
      { invoiceNumber: regex },
      { consignor: regex },
      { consignee: regex },
      { destination: regex },
      { description: regex },
      { remarks: regex },
    ];
  }

  // Specific field filters
  if (params.acknowledgementStatus) {
    filter.acknowledgementStatus = params.acknowledgementStatus;
  }

  if (params.freightType) {
    filter.freightType = params.freightType;
  }

  if (params.destination && params.destination.trim()) {
    filter.destination = new RegExp(params.destination.trim(), 'i');
  }

  // Date range filter
  if (params.startDate || params.endDate) {
    filter.date = {};
    if (params.startDate) {
      filter.date.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }

  return Receipt.find(filter).sort({ createdAt: -1 });
}

export async function getReceiptById(id) {
  const receipt = await Receipt.findById(id);
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }
  return receipt;
}

export async function updateReceipt(id, data) {
  const receipt = await Receipt.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });

  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }

  return receipt;
}

export async function deleteReceipt(id) {
  const receipt = await Receipt.findByIdAndDelete(id);
  if (!receipt) {
    throw new AppError('Receipt not found', 404);
  }
  return receipt;
}

/**
 * Aggregate dashboard statistics
 */
export async function getDashboardStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalCount,
    todayCount,
    pendingCount,
    receivedCount,
    paidCount,
    toPayCount,
    destinations,
  ] = await Promise.all([
    Receipt.countDocuments(),
    Receipt.countDocuments({ createdAt: { $gte: todayStart } }),
    Receipt.countDocuments({ acknowledgementStatus: 'Pending' }),
    Receipt.countDocuments({ acknowledgementStatus: 'Received' }),
    Receipt.countDocuments({ freightType: 'Paid' }),
    Receipt.countDocuments({ freightType: 'To Pay' }),
    Receipt.distinct('destination'),
  ]);

  return {
    totalCount,
    todayCount,
    pendingCount,
    receivedCount,
    paidCount,
    toPayCount,
    uniqueDestinations: destinations.filter(Boolean),
  };
}
