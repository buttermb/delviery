/**
 * OptimizedImage Component
 *
 * Renders images with automatic srcset generation and format negotiation
 * via the <picture> element. Supports AVIF/WebP with origin fallback,
 * IntersectionObserver-based lazy loading, skeleton placeholders,
 * and error fallback UI.
 *
 * Uses Supabase Storage image transformation parameters for on-the-fly
 * resizing, quality, and format conversion.
 */

import { useState, useRef, useEffect, useMemo } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  /** Image source URL */
  src: string | null | undefined;
  /** Alt text for accessibility */
  alt: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Skip lazy loading and load immediately */
  priority?: boolean;
  /** Target display width in pixels (default: 400) */
  width?: number;
  /** Image quality 1-100 (default: 80) */
  quality?: number;
  /** Responsive sizes attribute (default: auto-calculated from width) */
  sizes?: string;
  /** CSS object-fit value (default: 'cover') */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none';
  /** Aspect ratio class (e.g. 'aspect-square', 'aspect-video') */
  aspectRatio?: string;
}

/** Check if URL supports Supabase image transformations */
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('.supabase.co/storage/v1/object/public/');
}

/** Build a transformed Supabase storage URL */
function buildTransformedUrl(
  baseUrl: string,
  width: number,
  quality: number,
  format: 'avif' | 'webp' | 'origin',
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('width', width.toString());
  url.searchParams.set('quality', quality.toString());
  if (format !== 'origin') {
    url.searchParams.set('format', format);
  }
  return url.toString();
}

interface SourceSet {
  avifSrcSet: string;
  webpSrcSet: string;
  fallbackSrc: string;
  fallbackSrcSet: string;
}

/** Generate srcset strings for AVIF, WebP, and origin formats */
function buildSourceSets(
  baseUrl: string,
  width: number,
  quality: number,
): SourceSet {
  const densities = [
    { descriptor: '1x', multiplier: 1, qualityOffset: 0 },
    { descriptor: '2x', multiplier: 2, qualityOffset: 0 },
    { descriptor: '3x', multiplier: 3, qualityOffset: -10 },
  ];

  const makeSrcSet = (format: 'avif' | 'webp' | 'origin') =>
    densities
      .map(
        (d) =>
          `${buildTransformedUrl(baseUrl, width * d.multiplier, Math.max(quality + d.qualityOffset, 10), format)} ${d.descriptor}`,
      )
      .join(', ');

  return {
    avifSrcSet: makeSrcSet('avif'),
    webpSrcSet: makeSrcSet('webp'),
    fallbackSrc: buildTransformedUrl(baseUrl, width, quality, 'origin'),
    fallbackSrcSet: makeSrcSet('origin'),
  };
}

export function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  width = 400,
  quality = 80,
  sizes,
  objectFit = 'cover',
  aspectRatio,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const computedSizes = sizes ?? `(max-width: ${width}px) 100vw, ${width}px`;
  const isTransformable = !!src && isSupabaseStorageUrl(src);

  const sourceSets = useMemo(() => {
    if (!src || !isTransformable) return null;
    return buildSourceSets(src, width, quality);
  }, [src, width, quality, isTransformable]);

  const resolvedSrc = isTransformable && sourceSets
    ? sourceSets.fallbackSrc
    : (src ?? undefined);

  const hasImage = !!src && !error;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-neutral-100',
        aspectRatio,
        className,
      )}
    >
      {/* Skeleton placeholder while loading */}
      {isLoading && hasImage && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}

      {hasImage ? (
        isInView ? (
          isTransformable && sourceSets ? (
            <picture>
              <source
                type="image/avif"
                srcSet={sourceSets.avifSrcSet}
                sizes={computedSizes}
              />
              <source
                type="image/webp"
                srcSet={sourceSets.webpSrcSet}
                sizes={computedSizes}
              />
              <img
                src={sourceSets.fallbackSrc}
                srcSet={sourceSets.fallbackSrcSet}
                sizes={computedSizes}
                alt={alt}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError(true);
                }}
                className={cn(
                  'w-full h-full transition-opacity duration-300',
                  `object-${objectFit}`,
                  isLoading ? 'opacity-0' : 'opacity-100',
                )}
                style={{ contentVisibility: 'auto' }}
              />
            </picture>
          ) : (
            <img
              src={resolvedSrc}
              alt={alt}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError(true);
              }}
              className={cn(
                'w-full h-full transition-opacity duration-300',
                `object-${objectFit}`,
                isLoading ? 'opacity-0' : 'opacity-100',
              )}
              style={{ contentVisibility: 'auto' }}
            />
          )
        ) : (
          /* Placeholder div while not in view */
          <div className="w-full h-full" />
        )
      ) : (
        /* Error / no-image fallback */
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
          <div className="text-center p-4">
            <div className="w-16 h-16 mx-auto mb-3 bg-neutral-200/60 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="text-xs text-neutral-500 font-medium truncate max-w-[120px]">
              {alt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptimizedImage;
