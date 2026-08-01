import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* On serverless (Vercel), only /tmp is writable */
const UPLOADS_ROOT = (process.env.VERCEL || process.env.NODE_ENV === 'production')
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../../uploads');

const RAW_DIR = path.join(UPLOADS_ROOT, 'raw');
const PROCESSED_DIR = path.join(UPLOADS_ROOT, 'processed');

async function ensureUploadDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(PROCESSED_DIR, { recursive: true });
}

export async function processReceiptImage(buffer, originalName) {
  await ensureUploadDirs();

  const id = randomUUID();
  const ext = '.jpg';
  const rawFilename = `${id}-raw${path.extname(originalName) || '.jpg'}`;
  const processedFilename = `${id}${ext}`;

  const rawPath = path.join(RAW_DIR, rawFilename);
  const processedPath = path.join(PROCESSED_DIR, processedFilename);

  await fs.writeFile(rawPath, buffer);

  const rotatedBuffer = await sharp(buffer).rotate().toBuffer();
  let processedBuffer = rotatedBuffer;

  try {
    const trimmedBuffer = await sharp(rotatedBuffer).trim({ threshold: 10 }).toBuffer();
    const [rotatedMeta, trimmedMeta] = await Promise.all([
      sharp(rotatedBuffer).metadata(),
      sharp(trimmedBuffer).metadata(),
    ]);

    const widthOk = trimmedMeta.width > rotatedMeta.width * 0.5;
    const heightOk = trimmedMeta.height > rotatedMeta.height * 0.5;

    if (widthOk && heightOk) {
      processedBuffer = trimmedBuffer;
    }
  } catch {
    // Keep rotated image when trim cannot detect meaningful borders
  }

  await sharp(processedBuffer)
    .normalize() // brightness/contrast correction
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(processedPath);

  const [processedMeta, originalMeta, stats] = await Promise.all([
    sharp(processedPath).metadata(),
    sharp(buffer).metadata(),
    fs.stat(processedPath),
  ]);

  return {
    id,
    imagePath: `/uploads/processed/${processedFilename}`,
    originalName,
    mimeType: 'image/jpeg',
    size: stats.size,
    width: processedMeta.width,
    height: processedMeta.height,
    originalWidth: originalMeta.width,
    originalHeight: originalMeta.height,
  };
}

export { UPLOADS_ROOT };
