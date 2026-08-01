/**
 * Offline Queue — IndexedDB wrapper for storing receipts when offline
 * and syncing them when connectivity returns.
 *
 * Database: "ocr-sustem-offline"
 * Object Store: "pendingReceipts" (autoIncrement key)
 */

const DB_NAME = 'ocr-sustem-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingReceipts';

/* ── Open / upgrade database ──────────────────────── */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ── Enqueue a receipt for offline storage ─────────── */
export async function enqueueReceipt(receiptData) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      receiptData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    const request = store.add(record);
    request.onsuccess = () => resolve(request.result); // returns the auto-generated id
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/* ── Get all pending receipts ─────────────────────── */
export async function getPendingReceipts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result.filter((r) => r.status === 'pending'));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/* ── Get count of pending items ───────────────────── */
export async function getPendingCount() {
  try {
    const pending = await getPendingReceipts();
    return pending.length;
  } catch {
    return 0;
  }
}

/* ── Remove a successfully synced item ────────────── */
export async function dequeueReceipt(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/* ── Mark a record as failed (increment attempt) ──── */
async function markFailed(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.attempts += 1;
        record.lastAttempt = new Date().toISOString();
        store.put(record);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => db.close();
  });
}

/* ── Sync all pending receipts to the server ──────── */
export async function syncOfflineQueue() {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getPendingReceipts();
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.receiptData),
      });

      if (response.ok) {
        await dequeueReceipt(item.id);
        synced++;
      } else {
        await markFailed(item.id);
        failed++;
      }
    } catch {
      // Still offline or network error — leave in queue
      await markFailed(item.id);
      failed++;
    }
  }

  return { synced, failed };
}

/* ── Initialize offline sync listeners ────────────── */
let syncInitialized = false;
let onSyncCallback = null;

/**
 * Register a callback to be notified when offline receipts are synced.
 * @param {Function} callback - receives { synced, failed }
 */
export function onOfflineSync(callback) {
  onSyncCallback = callback;
}

/**
 * Call once at app boot to register connectivity listeners.
 * Automatically syncs pending receipts when the browser comes back online.
 */
export function initOfflineSync() {
  if (syncInitialized) return;
  syncInitialized = true;

  window.addEventListener('online', async () => {
    const result = await syncOfflineQueue();
    if (result.synced > 0 && onSyncCallback) {
      onSyncCallback(result);
    }
  });

  // Also attempt sync on app load (in case we came online while app was closed)
  if (navigator.onLine) {
    syncOfflineQueue().then((result) => {
      if (result.synced > 0 && onSyncCallback) {
        onSyncCallback(result);
      }
    });
  }
}
