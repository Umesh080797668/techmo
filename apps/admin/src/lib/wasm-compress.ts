/**
 * wasm-compress.ts
 * -----------------
 * Browser-side image compression using the native Canvas API (zero-dependency, $0 cost).
 * Resizes and re-encodes images to a max dimension of 1200 px before uploading to
 * Cloudinary — keeps the project within the 25 GB/month free-tier bandwidth limit.
 *
 * Uses OffscreenCanvas when available (worker threads), falls back to main-thread canvas.
 */

export interface CompressOptions {
  /** Maximum width or height in pixels. Default: 1200 */
  maxDimension?: number;
  /** JPEG quality 0–1. Default: 0.82 */
  quality?: number;
  /** Output MIME type. Default: 'image/jpeg' */
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  /** Size reduction ratio 0–1  (e.g. 0.68 = 68 % smaller) */
  compressionRatio: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Compress a File or Blob before upload.
 * Works in the browser main thread. Call from a Web Worker via postMessage for
 * non-blocking compression of large repair photos.
 *
 * @example
 * const result = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
 * const formData = new FormData();
 * formData.append('file', result.blob, 'photo.jpg');
 * await api.post('/api/v1/worker/upload-repair-photo', formData);
 */
export async function compressImage(
  source: File | Blob,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const {
    maxDimension = 1200,
    quality = 0.82,
    outputType = 'image/jpeg',
  } = options;

  const originalSizeBytes = source.size;

  // 1. Decode the image into an ImageBitmap (no DOM required)
  const bitmap = await createImageBitmap(source);

  // 2. Calculate target dimensions (maintain aspect ratio)
  const { width: origW, height: origH } = bitmap;
  let targetW = origW;
  let targetH = origH;

  if (origW > maxDimension || origH > maxDimension) {
    if (origW >= origH) {
      targetW = maxDimension;
      targetH = Math.round((origH / origW) * maxDimension);
    } else {
      targetH = maxDimension;
      targetW = Math.round((origW / origH) * maxDimension);
    }
  }

  // 3. Draw onto OffscreenCanvas (preferred) or HTMLCanvasElement
  let blob: Blob;

  if (typeof OffscreenCanvas !== 'undefined') {
    const offscreen = new OffscreenCanvas(targetW, targetH);
    const ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    blob = await offscreen.convertToBlob({ type: outputType, quality });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        outputType,
        quality,
      );
    });
  }

  bitmap.close();

  const compressedSizeBytes = blob.size;
  const compressionRatio = 1 - compressedSizeBytes / originalSizeBytes;

  return { blob, width: targetW, height: targetH, compressionRatio, originalSizeBytes, compressedSizeBytes };
}

/**
 * Helper: compress a File and return a new File with the same name.
 * Useful for drop-in replacement of file inputs.
 */
export async function compressFile(
  file: File,
  options?: CompressOptions,
): Promise<File> {
  const result = await compressImage(file, options);
  const ext = result.blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
  return new File([result.blob], name, { type: result.blob.type });
}

/**
 * Human-readable size string, e.g. "2.3 MB → 480 KB (−79%)"
 */
export function formatCompressionSummary(result: CompressResult): string {
  const fmt = (b: number) =>
    b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB`
    : `${(b / 1024).toFixed(0)} KB`;
  return `${fmt(result.originalSizeBytes)} → ${fmt(result.compressedSizeBytes)} (−${Math.round(result.compressionRatio * 100)}%)`;
}
