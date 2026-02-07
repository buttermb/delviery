import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  loading?: 'lazy' | 'eager';
}

const ImageWithFallback = ({
  src,
  alt,
  className,
  fallbackSrc = '/placeholder.svg',
  loading = 'lazy',
}: ImageWithFallbackProps) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
      setHasError(true);
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="relative">
      {isLoading && !hasError && (
        <div className={cn(
          "absolute inset-0 animate-pulse bg-muted rounded-lg",
          className
        )} />
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          className
        )}
        loading={loading}
        onError={handleError}
        onLoad={handleLoad}
        decoding="async"
        style={{
          touchAction: 'pan-y pinch-zoom',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        draggable={false}
      />
    </div>
  );
};

export default ImageWithFallback;
