/**
 * Trigger Gemini Vision OCR extraction for an uploaded receipt image
 * @param {string} imagePath - relative image path returned from upload endpoint
 * @returns {Promise<object>} - extracted JSON data, confidence scores & raw output
 */
export async function runReceiptOCR(imagePath) {
  if (!imagePath) {
    throw new Error('Image path is required for OCR processing');
  }

  const response = await fetch('/api/receipts/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ imagePath }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `OCR extraction failed (${response.status})`);
  }

  return data.data;
}
