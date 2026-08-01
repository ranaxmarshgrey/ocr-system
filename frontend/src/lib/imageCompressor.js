/**
 * Client-side image compression using Canvas API.
 * Targets low-end Android devices — reduces 5MB phone photos to ~200-400KB
 * before upload, saving bandwidth and improving upload speed.
 */

const MAX_DIMENSION = 1920; // px on longest edge
const JPEG_QUALITY = 0.82;

/**
 * Compress an image file using Canvas.
 * - Resizes to max 1920px on the longest edge (preserving aspect ratio)
 * - Re-encodes as JPEG at 0.82 quality
 * - Falls back to the original file if compression fails or increases size
 *
 * @param {File} file - original image file
 * @returns {Promise<File>} - compressed file (or original if compression didn't help)
 */
export async function compressImage(file) {
  // Skip non-image or already-small files (<300KB)
  if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Calculate new dimensions
    let newWidth = width;
    let newHeight = height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    // Draw to canvas
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    // Convert to blob
    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: JPEG_QUALITY,
    });

    // Only use compressed version if it's actually smaller
    if (blob.size >= file.size) {
      return file;
    }

    // Create a new File object preserving the name
    const compressedName = file.name.replace(/\.[^.]+$/, '.jpg');
    return new File([blob], compressedName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    // OffscreenCanvas not supported or other error — fall back to regular Canvas
    try {
      return await compressWithCanvas(file);
    } catch {
      // All compression failed — return original
      return file;
    }
  }
}

/**
 * Fallback compression using regular HTMLCanvasElement
 * (for browsers without OffscreenCanvas support)
 */
function compressWithCanvas(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }

          const compressedName = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(
            new File([blob], compressedName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            }),
          );
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original
    };

    img.src = url;
  });
}
