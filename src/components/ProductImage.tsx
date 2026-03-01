/**
 * Product Image Component with Skeleton Placeholder & Error Fallback
 * Uses IntersectionObserver for lazy loading with smooth skeleton-to-image transitions
 */

import { useState, useRef, useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}

export default function ProductImage({ src, alt, className = '', priority = false }: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const hasImage = src && !imageError;

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden bg-neutral-100', className)}>

      {/* Skeleton placeholder while loading */}
      {isLoading && hasImage && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}

      {/* Actual image - only render src when in view */}
      {hasImage ? (
        <img
          src={isInView ? src : undefined}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-500',
            isLoading ? 'opacity-0' : 'opacity-100',
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setImageError(true);
            setIsLoading(false);
          }}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center min-h-[200px] bg-neutral-50">
          <div className="mb-4 p-4 rounded-full bg-white border border-neutral-100 shadow-sm">
            <svg
              className="w-10 h-10 text-neutral-300"
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
          <div className="text-neutral-500 text-sm font-medium tracking-wide max-w-full truncate px-4">
            {alt}
          </div>
          <div className="text-neutral-400 text-xs mt-1">
            No Image
          </div>
        </div>
      )}

      <div className="absolute inset-0 border border-black/5 pointer-events-none" />
    </div>
  );
}
