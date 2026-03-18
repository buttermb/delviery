/**
 * Image Compression Utility
 *
 * Provides client-side image compression before upload using browser-image-compression.
 * Reduces file sizes for faster uploads and lower storage costs.
 */

import imageCompression from 'browser-image-compression';
import { logger } from '@/lib/logger';

/**
 * Options for image compression
 */
export interface ImageCompressionOptions {
  /** Maximum file size in MB (default: 1MB) */
  maxSizeMB?: number;
  /** Maximum width or height in pixels (default: 1920) */
  maxWidthOrHeight?: number;
  /** Use web worker for compression (default: true) */
  useWebWorker?: boolean;
  /** Initial quality (0-1, default: 0.8) */
  initialQuality?: number;
  /** Preserve EXIF data (default: false) */
  preserveExif?: boolean;
}

/**
 * Default compression options optimized for product images
 */
export const DEFAULT_COMPRESSION_OPTIONS: Required<ImageCompressionOptions> = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  initialQuality: 0.8,
  preserveExif: false,
};

/**
 * Compression presets for different use cases
 */
export const COMPRESSION_PRESETS = {
  /** High quality for product images (max 2MB, 2048px) */
  product: {
    maxSizeMB: 2,
    maxWidthOrHeight: 2048,
    initialQuality: 0.85,
  },
  /** Medium quality for thumbnails (max 500KB, 800px) */
  thumbnail: {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    initialQuality: 0.7,
  },
  /** Optimized for profile/logo images (max 1MB, 1024px) */
  profile: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    initialQuality: 0.8,
  },
  /** Cover images (max 2MB, 1920px) */
  cover: {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    initialQuality: 0.85,
  },
} as const;

/**
 * Check if a file is an image that can be compressed
 */
export function isCompressibleImage(file: File): boolean {
  const compressibleTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
  ];
  return compressibleTypes.includes(file.type.toLowerCase());
}

/**
 * Compress an image file before upload
 *
 * @param file - The image file to compress
 * @param options - Compression options (uses defaults if not provided)
 * @param onProgress - Optional progress callback (0-100)
 * @returns Compressed image file
 *
 * @example
 * ```ts
 * const compressedFile = await compressImage(file, {
 *   maxSizeMB: 1,
 *   maxWidthOrHeight: 1920
 * });
 * ```
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {},
  onProgress?: (progress: number) => void
): Promise<File> {
  // Skip compression for non-image files
  if (!isCompressibleImage(file)) {
    logger.debug('Skipping compression for non-image file', {
      fileName: file.name,
      type: file.type,
    });
    return file;
  }

  // Skip if file is already small enough
  const mergedOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  const maxSizeBytes = mergedOptions.maxSizeMB * 1024 * 1024;

  if (file.size <= maxSizeBytes) {
    logger.debug('Skipping compression - file already within size limit', {
      fileName: file.name,
      fileSize: file.size,
      maxSize: maxSizeBytes,
    });
    return file;
  }

  const originalSize = file.size;
  const startTime = performance.now();

  try {
    logger.debug('Starting image compression', {
      fileName: file.name,
      originalSize: formatBytes(originalSize),
      options: mergedOptions,
    });

    const compressedFile = await imageCompression(file, {
      maxSizeMB: mergedOptions.maxSizeMB,
      maxWidthOrHeight: mergedOptions.maxWidthOrHeight,
      useWebWorker: mergedOptions.useWebWorker,
      initialQuality: mergedOptions.initialQuality,
      preserveExif: mergedOptions.preserveExif,
      onProgress: onProgress
        ? (progress: number) => onProgress(Math.round(progress))
        : undefined,
    });

    const compressionTime = Math.round(performance.now() - startTime);
    const savedBytes = originalSize - compressedFile.size;
    const compressionRatio = ((savedBytes / originalSize) * 100).toFixed(1);

    logger.info('Image compression complete', {
      fileName: file.name,
      originalSize: formatBytes(originalSize),
      compressedSize: formatBytes(compressedFile.size),
      savedBytes: formatBytes(savedBytes),
      compressionRatio: `${compressionRatio}%`,
      compressionTime: `${compressionTime}ms`,
    });

    return compressedFile;
  } catch (error) {
    logger.error('Image compression failed, using original file', error, {
      fileName: file.name,
      fileSize: file.size,
    });
    // Return original file if compression fails
    return file;
  }
}

/**
 * Compress an image with a specific preset
 *
 * @param file - The image file to compress
 * @param preset - Compression preset name
 * @param onProgress - Optional progress callback
 * @returns Compressed image file
 */
export async function compressImageWithPreset(
  file: File,
  preset: keyof typeof COMPRESSION_PRESETS,
  onProgress?: (progress: number) => void
): Promise<File> {
  return compressImage(file, COMPRESSION_PRESETS[preset], onProgress);
}

/**
 * Compress multiple images in parallel
 *
 * @param files - Array of image files to compress
 * @param options - Compression options
 * @param onFileProgress - Callback with file index and progress
 * @returns Array of compressed files
 */
export async function compressImages(
  files: File[],
  options: ImageCompressionOptions = {},
  onFileProgress?: (fileIndex: number, progress: number) => void
): Promise<File[]> {
  const results = await Promise.all(
    files.map((file, index) =>
      compressImage(file, options, (progress) =>
        onFileProgress?.(index, progress)
      )
    )
  );
  return results;
}

/**
 * Get compression statistics for a file
 */
export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  compressionRatio: number;
  wasCompressed: boolean;
}

/**
 * Compress and return statistics
 */
export async function compressImageWithStats(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<{ file: File; stats: CompressionStats }> {
  const originalSize = file.size;
  const compressedFile = await compressImage(file, options);
  const compressedSize = compressedFile.size;

  return {
    file: compressedFile,
    stats: {
      originalSize,
      compressedSize,
      savedBytes: originalSize - compressedSize,
      compressionRatio:
        originalSize > 0 ? ((originalSize - compressedSize) / originalSize) * 100 : 0,
      wasCompressed: compressedSize < originalSize,
    },
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
