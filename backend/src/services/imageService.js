import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const UPLOADS_ROOT = (process.env.VERCEL || process.env.NODE_ENV === 'production')
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../../uploads');

const RAW_DIR = path.join(UPLOADS_ROOT, 'raw');
const PROCESSED_DIR = path.join(UPLOADS_ROOT, 'processed');

async function ensureUploadDirs() {
  try {
    await fs.mkdir(RAW_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
  } catch (err) {
    console.warn('Upload directory creation warning (handled):', err.message);
  }
}

export async function processReceiptImage(buffer, originalName) {
  const id = randomUUID();
  const ext = '.jpg';
  const rawFilename = `${id}-raw${path.extname(originalName) || '.jpg'}`;
  const processedFilename = `${id}${ext}`;

  const rawPath = path.join(RAW_DIR, rawFilename);
  const processedPath = path.join(PROCESSED_DIR, processedFilename);

  // Attempt writing to disk if available
  try {
    await ensureUploadDirs();
    await fs.writeFile(rawPath, buffer);
  } catch (err) {
    console.warn('Raw file write skipped (serverless memory mode):', err.message);
  }

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

  const finalJpegBuffer = await sharp(processedBuffer)
    .normalize()
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  // Attempt writing processed image to disk if filesystem allows
  try {
    await fs.writeFile(processedPath, finalJpegBuffer);
  } catch (err) {
    console.warn('Processed file write skipped (serverless memory mode):', err.message);
  }

  const [processedMeta, originalMeta] = await Promise.all([
    sharp(finalJpegBuffer).metadata(),
    sharp(buffer).metadata(),
  ]);

  const base64Jpeg = finalJpegBuffer.toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64Jpeg}`;

  return {
    id,
    imagePath: `/uploads/processed/${processedFilename}`,
    dataUrl,
    originalName,
    mimeType: 'image/jpeg',
    size: finalJpegBuffer.length,
    width: processedMeta.width,
    height: processedMeta.height,
    originalWidth: originalMeta.width,
    originalHeight: originalMeta.height,
  };
}

export { UPLOADS_ROOT };
