import { compressImage } from '../lib/imageCompressor';

const PROCESSING_MESSAGES = [
  { afterMs: 0,    text: 'Compressing & Uploading Receipt…' },
  { afterMs: 800,  text: 'Reading Receipt…' },
  { afterMs: 2200, text: 'Extracting Information…' },
  { afterMs: 4000, text: 'Finalizing…' },
];

/**
 * Upload a receipt image with real upload-progress tracking (XHR)
 * and simulated processing-stage messages.
 *
 * Images are compressed client-side before upload to save bandwidth
 * on flaky/slow connections (especially low-end Android devices).
 *
 * @param {File}     file             – the image file to upload
 * @param {Function} onStatusChange   – called with status text
 * @param {Function} onUploadProgress – called with 0-100 percentage
 * @returns {Promise<object>}         – resolved server response data
 */
export async function uploadReceiptImage(file, onStatusChange, onUploadProgress) {
  // Compress image before upload (transparent — returns original if compression doesn't help)
  onStatusChange?.('Compressing image…');
  const compressedFile = await compressImage(file);

  return new Promise((resolve, reject) => {
    /* ── Status message rotation ─────────────────── */
    let currentIdx = 0;
    onStatusChange?.(PROCESSING_MESSAGES[0].text);

    const timers = PROCESSING_MESSAGES.slice(1).map(({ afterMs, text }, i) =>
      setTimeout(() => {
        currentIdx = i + 1;
        onStatusChange?.(text);
      }, afterMs),
    );

    function cleanup() {
      timers.forEach(clearTimeout);
    }

    /* ── Build form data ─────────────────────────── */
    const formData = new FormData();
    formData.append('image', compressedFile, compressedFile.name || 'receipt.jpg');

    /* ── XHR for upload progress ─────────────────── */
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/uploads/receipt');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onUploadProgress?.(pct);
      }
    });

    xhr.addEventListener('load', () => {
      cleanup();
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data.data);
        } else {
          reject(new Error(data?.message || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => {
      cleanup();
      reject(new Error('Network error — check your connection and try again.'));
    });

    xhr.addEventListener('abort', () => {
      cleanup();
      reject(new Error('Upload was cancelled.'));
    });

    xhr.send(formData);
  });
}
