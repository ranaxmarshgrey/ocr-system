/**
 * Upload endpoint smoke test
 * Run: npm run test:upload
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'test-receipt.jpg');

async function createFixture() {
  await fs.mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await sharp({
    create: {
      width: 800,
      height: 1200,
      channels: 3,
      background: { r: 240, g: 240, b: 235 },
    },
  })
    .jpeg()
    .toFile(FIXTURE_PATH);
}

async function run() {
  await createFixture();
  const buffer = await fs.readFile(FIXTURE_PATH);

  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: 'image/jpeg' }), 'test-receipt.jpg');

  console.log('\n=== Upload API Test ===\n');
  console.log(`POST ${BASE_URL}/uploads/receipt`);

  const res = await fetch(`${BASE_URL}/uploads/receipt`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();
  console.log('Status:', res.status);
  console.log(JSON.stringify(data, null, 2));

  if (res.status !== 201 || !data.data?.imagePath) {
    console.error('\nFAIL: upload did not return expected response');
    process.exit(1);
  }

  const imageRes = await fetch(`http://localhost:5000${data.data.imagePath}`);
  if (!imageRes.ok) {
    console.error('\nFAIL: processed image not accessible at', data.data.imagePath);
    process.exit(1);
  }

  console.log('\nPASS: image uploaded, processed, and served at', data.data.imagePath);
}

run().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
