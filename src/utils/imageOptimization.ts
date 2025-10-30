/**
 * Image optimization utilities for better performance
 */

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Calculate responsive image dimensions based on viewport
 */
export const getResponsiveImageSize = (
  baseWidth: number,
  baseHeight: number,
  maxWidth: number = 1920
): ImageDimensions => {
  const aspectRatio = baseHeight / baseWidth;
  const width = Math.min(baseWidth, maxWidth);
  const height = Math.round(width * aspectRatio);
  
  return { width, height };
};

/**
 * Generate srcset for responsive images
 */
export const generateSrcSet = (
  baseSrc: string,
  widths: number[] = [640, 768, 1024, 1280, 1920]
): string => {
  return widths
    .map((width) => `${baseSrc}?w=${width} ${width}w`)
    .join(', ');
};

/**
 * Lazy load images with Intersection Observer
 */
export const lazyLoadImage = (
  img: HTMLImageElement,
  src: string,
  onLoad?: () => void
): void => {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            img.src = src;
            img.onload = () => {
              img.classList.add('loaded');
              onLoad?.();
            };
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );
    observer.observe(img);
  } else {
    // Fallback for browsers without Intersection Observer
    img.src = src;
    img.onload = () => onLoad?.();
  }
};

/**
 * Preload critical images
 */
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Get optimal image format based on browser support
 */
export const getOptimalImageFormat = (): 'webp' | 'jpeg' => {
  const canvas = document.createElement('canvas');
  if (canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0) {
    return 'webp';
  }
  return 'jpeg';
};
