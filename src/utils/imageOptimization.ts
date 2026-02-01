/**
 * Image Optimization Utilities
 * Client-side image optimization with WebP support, lazy loading,
 * responsive images, and performance optimizations
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface OptimizedImageSrc {
  src: string;
  srcSet: string;
  sizes: string;
  placeholder?: string;
  aspectRatio: number;
}

export interface ImageOptimizationOptions {
  quality?: number;
  format?: 'auto' | 'webp' | 'jpeg' | 'png' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  blur?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_WIDTHS = [320, 640, 768, 1024, 1280, 1536, 1920];
const DEFAULT_QUALITY = 80;
const PLACEHOLDER_SIZE = 20;

// Supabase Storage transform URL pattern
const SUPABASE_STORAGE_PATTERN = /supabase\.co\/storage\/v1\/object\/public/;

// ============================================================================
// RESPONSIVE IMAGE UTILITIES
// ============================================================================

/**
 * Calculate responsive dimensions maintaining aspect ratio
 */
export function getResponsiveDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number = 1920
): ImageDimensions {
  if (originalWidth <= maxWidth) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalHeight / originalWidth;
  const width = maxWidth;
  const height = Math.round(width * aspectRatio);

  return { width, height };
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(
  baseSrc: string,
  widths: number[] = DEFAULT_WIDTHS,
  options: ImageOptimizationOptions = {}
): string {
  const { quality = DEFAULT_QUALITY, format = 'auto' } = options;

  return widths
    .map((width) => {
      const url = buildOptimizedUrl(baseSrc, { width, quality, format });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(breakpoints: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    '(max-width: 640px)': '100vw',
    '(max-width: 768px)': '80vw',
    '(max-width: 1024px)': '60vw',
    default: '50vw',
  };

  const merged = { ...defaults, ...breakpoints };
  const entries = Object.entries(merged);
  const defaultValue = merged.default || '100vw';

  return entries
    .filter(([key]) => key !== 'default')
    .map(([breakpoint, size]) => `${breakpoint} ${size}`)
    .concat([defaultValue])
    .join(', ');
}

/**
 * Build optimized URL with transforms
 */
export function buildOptimizedUrl(
  src: string,
  options: ImageOptimizationOptions & { width?: number; height?: number } = {}
): string {
  const { width, height, quality = DEFAULT_QUALITY, format = 'auto' } = options;

  // Handle Supabase Storage URLs
  if (SUPABASE_STORAGE_PATTERN.test(src)) {
    const url = new URL(src);
    const params: string[] = [];

    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    if (quality) params.push(`quality=${quality}`);
    if (format && format !== 'auto') params.push(`format=${format}`);

    if (params.length > 0) {
      const separator = url.search ? '&' : '?';
      return `${src}${separator}${params.join('&')}`;
    }
    return src;
  }

  // Handle Cloudinary URLs
  if (src.includes('cloudinary.com')) {
    const transforms: string[] = [];
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (quality) transforms.push(`q_${quality}`);
    if (format === 'auto') transforms.push('f_auto');
    else if (format) transforms.push(`f_${format}`);

    if (transforms.length > 0) {
      return src.replace('/upload/', `/upload/${transforms.join(',')}/`);
    }
    return src;
  }

  // For other URLs, just append query params
  const url = new URL(src, window.location.origin);
  if (width) url.searchParams.set('w', String(width));
  if (height) url.searchParams.set('h', String(height));
  if (quality) url.searchParams.set('q', String(quality));

  return url.toString();
}

/**
 * Get complete optimized image props
 */
export function getOptimizedImageProps(
  src: string,
  options: {
    width?: number;
    height?: number;
    widths?: number[];
    quality?: number;
    sizes?: Record<string, string>;
    format?: 'auto' | 'webp' | 'jpeg' | 'png';
  } = {}
): OptimizedImageSrc {
  const { width = 1920, height, widths = DEFAULT_WIDTHS, quality, sizes } = options;

  const aspectRatio = height && width ? height / width : 0;

  return {
    src: buildOptimizedUrl(src, { width, height, quality }),
    srcSet: generateSrcSet(src, widths, { quality }),
    sizes: generateSizes(sizes),
    aspectRatio,
  };
}

// ============================================================================
// LAZY LOADING
// ============================================================================

interface LazyLoadOptions {
  rootMargin?: string;
  threshold?: number;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Lazy load an image with Intersection Observer
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  options: LazyLoadOptions = {}
): () => void {
  const { rootMargin = '50px', threshold = 0.01, onLoad, onError } = options;

  if (!('IntersectionObserver' in window)) {
    // Fallback for older browsers
    img.src = src;
    img.onload = () => onLoad?.();
    img.onerror = () => onError?.(new Error('Image load failed'));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          img.onload = () => {
            img.classList.add('loaded');
            onLoad?.();
          };
          img.onerror = () => onError?.(new Error('Image load failed'));
          observer.unobserve(img);
        }
      });
    },
    { rootMargin, threshold }
  );

  observer.observe(img);

  return () => observer.disconnect();
}

/**
 * Create a lazy loading manager for multiple images
 */
export function createLazyLoadManager(options: LazyLoadOptions = {}) {
  const observers = new Map<HTMLImageElement, IntersectionObserver>();

  return {
    observe: (img: HTMLImageElement, src: string) => {
      const cleanup = lazyLoadImage(img, src, options);
      observers.set(img, { disconnect: cleanup } as IntersectionObserver);
    },
    unobserve: (img: HTMLImageElement) => {
      const observer = observers.get(img);
      observer?.disconnect();
      observers.delete(img);
    },
    disconnectAll: () => {
      observers.forEach((observer) => observer.disconnect());
      observers.clear();
    },
  };
}

// ============================================================================
// PRELOADING
// ============================================================================

const preloadCache = new Set<string>();

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<void> {
  if (preloadCache.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      preloadCache.add(src);
      resolve();
    };
    img.onerror = () => reject(new Error(`Failed to preload: ${src}`));
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export function preloadImages(srcs: string[]): Promise<PromiseSettledResult<void>[]> {
  return Promise.allSettled(srcs.map(preloadImage));
}

/**
 * Preload image using link rel="preload"
 */
export function preloadImageViaLink(
  src: string,
  options: { as?: string; type?: string; fetchpriority?: 'high' | 'low' | 'auto' } = {}
): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = options.as || 'image';
  link.href = src;
  if (options.type) link.type = options.type;
  if (options.fetchpriority) link.setAttribute('fetchpriority', options.fetchpriority);
  document.head.appendChild(link);
  return link;
}

// ============================================================================
// PLACEHOLDER GENERATION
// ============================================================================

/**
 * Generate a tiny placeholder image (data URL)
 */
export async function generatePlaceholder(
  src: string,
  size: number = PLACEHOLDER_SIZE
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const aspectRatio = img.height / img.width;
        canvas.width = size;
        canvas.height = Math.round(size * aspectRatio);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Generate a solid color placeholder from dominant color
 */
export async function getDominantColor(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#f0f0f0');
          return;
        }

        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch {
        resolve('#f0f0f0');
      }
    };
    img.onerror = () => resolve('#f0f0f0');
    img.src = src;
  });
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => resolve(webP.height === 2);
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSywABeQAAA';
  });
}

/**
 * Check if browser supports AVIF
 */
export function supportsAVIF(): Promise<boolean> {
  return new Promise((resolve) => {
    const avif = new Image();
    avif.onload = avif.onerror = () => resolve(avif.height === 2);
    avif.src =
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABpAgICAwAAEMICBERBYS';
  });
}

/**
 * Get best supported format
 */
export async function getBestFormat(): Promise<'avif' | 'webp' | 'jpeg'> {
  const [avif, webp] = await Promise.all([supportsAVIF(), supportsWebP()]);
  if (avif) return 'avif';
  if (webp) return 'webp';
  return 'jpeg';
}

// ============================================================================
// IMAGE COMPRESSION (Client-side)
// ============================================================================

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Compress an image file on the client
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, type = 'image/jpeg' } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate new dimensions
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            },
            type,
            quality
          );
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// REACT HOOKS
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for lazy loading images
 */
export function useLazyImage(
  src: string,
  options: { placeholder?: string; rootMargin?: string } = {}
) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentSrc, setCurrentSrc] = useState(options.placeholder || '');
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current || !src) return;

    const cleanup = lazyLoadImage(imgRef.current, src, {
      rootMargin: options.rootMargin,
      onLoad: () => {
        setLoaded(true);
        setCurrentSrc(src);
      },
      onError: (err) => {
        setError(err);
        logger.error('Image load failed', err, { src });
      },
    });

    return cleanup;
  }, [src, options.rootMargin]);

  return { imgRef, loaded, error, currentSrc };
}

/**
 * Hook for progressive image loading
 */
export function useProgressiveImage(lowQualitySrc: string, highQualitySrc: string) {
  const [src, setSrc] = useState(lowQualitySrc);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setSrc(highQualitySrc);
      setLoading(false);
    };
    img.src = highQualitySrc;

    return () => {
      img.onload = null;
    };
  }, [highQualitySrc]);

  return { src, loading, isLowQuality: src === lowQualitySrc };
}

/**
 * Hook for optimized image props
 */
export function useOptimizedImage(
  src: string,
  options: Parameters<typeof getOptimizedImageProps>[1] = {}
) {
  const [bestFormat, setBestFormat] = useState<'avif' | 'webp' | 'jpeg'>('jpeg');

  useEffect(() => {
    getBestFormat().then(setBestFormat);
  }, []);

  return getOptimizedImageProps(src, { ...options, format: bestFormat as 'webp' | 'jpeg' });
}
