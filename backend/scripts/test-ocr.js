/**
 * OCR endpoint smoke test
 * Run: npm run test:ocr
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'test-ocr-receipt.jpg');

async function createFixture() {
  await fs.mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await sharp({
    create: {
      width: 800,
      height: 1200,
      channels: 3,
      background: { r: 245, g: 245, b: 240 },
    },
  })
    .jpeg()
    .toFile(FIXTURE_PATH);
}

async function run() {
  await createFixture();
  const buffer = await fs.readFile(FIXTURE_PATH);

  // 1. Upload receipt image
  console.log('\n=== Step 1: Uploading Image ===');
  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: 'image/jpeg' }), 'test-ocr-receipt.jpg');

  const uploadRes = await fetch(`${BASE_URL}/uploads/receipt`, {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  if (uploadRes.status !== 201 || !uploadData.data?.imagePath) {
    console.error('FAIL: Upload failed', uploadData);
    process.exit(1);
  }

  const { imagePath } = uploadData.data;
  console.log('✓ Image uploaded successfully:', imagePath);

  // 2. Call OCR endpoint
  console.log('\n=== Step 2: Hitting POST /api/receipts/ocr ===');
  const ocrRes = await fetch(`${BASE_URL}/receipts/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imagePath }),
  });

  const ocrData = await ocrRes.json();
  console.log('Status:', ocrRes.status);
  console.log('OCR Output:', JSON.stringify(ocrData, null, 2));

  if (ocrRes.status !== 200 || ocrData.status !== 'success') {
    console.error('\nFAIL: OCR endpoint returned error status:', ocrRes.status);
    process.exit(1);
  }

  const { extractedData, ocrConfidence, fieldConfidence, rawOcrOutput } = ocrData.data || {};

  if (!extractedData || typeof ocrConfidence !== 'number') {
    console.error('\nFAIL: Missing expected fields in OCR response');
    process.exit(1);
  }

  // 3. Check raw log file
  const logPath = path.join(__dirname, '../logs/ocr-raw.log');
  try {
    const logContent = await fs.readFile(logPath, 'utf8');
    if (logContent.length > 0) {
      console.log('\n✓ Raw OCR output logged successfully to backend/logs/ocr-raw.log');
    }
  } catch (err) {
    console.warn('\nNote: Raw log file check:', err.message);
  }

  console.log('\nPASS: OCR integration test succeeded!');
}

run().catch((err) => {
  console.error('Test failed with error:', err.message);
  process.exit(1);
});
