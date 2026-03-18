import { memo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Set to true for above-the-fold images (uses eager loading + high fetchPriority) */
  priority?: boolean;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  onError?: () => void;
  onLoad?: () => void;
}

const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className,
  priority = false,
  width,
  height,
  srcSet,
  sizes,
  onError,
  onLoad,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      width={width}
      height={height}
      srcSet={srcSet}
      sizes={sizes}
      className={cn(
        'object-cover transition-opacity duration-300',
        isLoaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
      onLoad={() => {
        setIsLoaded(true);
        onLoad?.();
      }}
      onError={onError}
    />
  );
});

export { OptimizedImage };
export type { OptimizedImageProps };
