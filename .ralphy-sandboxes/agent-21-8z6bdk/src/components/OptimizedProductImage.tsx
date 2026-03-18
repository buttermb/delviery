import { useState, useRef, useEffect } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface OptimizedProductImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export const OptimizedProductImage = ({
  src,
  alt,
  className = '',
  priority = false,
}: OptimizedProductImageProps) => {
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
      { rootMargin: '200px' }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Resolve image source
  let imageSrc = src;
  if (src?.startsWith('/products/') || src?.startsWith('/public/')) {
    imageSrc = src;
  } else if (src?.startsWith('http://') || src?.startsWith('https://') || src?.startsWith('//')) {
    imageSrc = src;
  } else if (src?.startsWith('/placeholder') || src?.includes('placeholder')) {
    imageSrc = src;
  } else if (src && !src.startsWith('/')) {
    imageSrc = src;
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Skeleton placeholder */}
      {isLoading && !error && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}

      <img
        src={isInView ? imageSrc : undefined}
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
          'w-full h-full object-cover transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          error && 'opacity-0',
        )}
        style={{
          contentVisibility: 'auto',
        }}
      />

      {/* Error fallback */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
          <div className="text-center p-4">
            <div className="w-16 h-16 mx-auto mb-3 bg-neutral-200/60 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-neutral-500 font-medium truncate max-w-[120px]">{alt}</p>
          </div>
        </div>
      )}
    </div>
  );
};
