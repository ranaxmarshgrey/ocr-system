/**
 * API service for creating and managing receipts
 * Includes offline fallback — receipts are queued in IndexedDB when network is unavailable.
 */
import { enqueueReceipt } from '../lib/offlineQueue';

/**
 * Save a verified receipt to MongoDB.
 * If the network is unavailable, the receipt is queued offline and
 * will auto-sync when connectivity returns.
 *
 * @param {object} receiptData
 * @returns {Promise<object>} { receipt, warnings, offline? }
 */
export async function createReceipt(receiptData) {
  try {
    const response = await fetch('/api/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(receiptData),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      let errorMsg = body?.message || `Failed to save receipt (${response.status})`;
      if (body?.errors && Array.isArray(body.errors)) {
        errorMsg = body.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
      }
      throw new Error(errorMsg);
    }

    return {
      receipt: body.data,
      warnings: body.warnings || [],
    };
  } catch (err) {
    // If it's a network error (not a server validation error), queue offline
    if (isNetworkError(err)) {
      const offlineId = await enqueueReceipt(receiptData);
      return {
        receipt: { ...receiptData, _id: `offline-${offlineId}` },
        warnings: [],
        offline: true,
      };
    }
    throw err;
  }
}

/**
 * Detect if an error is a network/connectivity issue vs a server error
 */
function isNetworkError(err) {
  return (
    err instanceof TypeError && (
      err.message.includes('Failed to fetch') ||
      err.message.includes('NetworkError') ||
      err.message.includes('Network request failed')
    )
  );
}

/**
 * Get all receipts from database
 */
export async function getReceipts() {
  const response = await fetch('/api/receipts');
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || 'Failed to fetch receipts');
  }

  return body.data || [];
}

/**
 * Get dashboard statistics (today's count, total, pending, received, paid, to-pay)
 * @param {object} params - optional { route }
 * @returns {Promise<object>} { totalCount, todayCount, pendingCount, receivedCount, paidCount, toPayCount, uniqueDestinations }
 */
export async function getDashboardStats(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== 'All') query.set(key, value);
  });
  const url = `/api/receipts/stats${query.toString() ? `?${query}` : ''}`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || 'Failed to fetch dashboard stats');
  }

  return body.data;
}

/**
 * Query receipts with search & filter params
 * @param {object} params - { search, acknowledgementStatus, freightType, destination, startDate, endDate }
 * @returns {Promise<Array>} list of receipt objects
 */
export async function queryReceipts(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      query.set(key, value);
    }
  });

  const url = `/api/receipts${query.toString() ? `?${query}` : ''}`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || 'Failed to query receipts');
  }

  return body.data || [];
}

/**
 * Update a receipt's acknowledgement status (Pending → Received / Later)
 * @param {string} id - receipt _id
 * @param {object} updateData - { acknowledgementStatus, receivedBy?, remarks? }
 * @returns {Promise<object>} updated receipt
 */
export async function updateReceiptStatus(id, updateData) {
  const response = await fetch(`/api/receipts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.message || 'Failed to update receipt status');
  }

  return body.data;
}
