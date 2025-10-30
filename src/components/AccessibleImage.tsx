import { useState } from 'react';
import OptimizedImage from './OptimizedImage';
import { ImageOff } from 'lucide-react';

interface AccessibleImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const AccessibleImage = ({
  src,
  alt,
  className = '',
  aspectRatio,
  priority = false,
  onLoad,
  onError,
}: AccessibleImageProps) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted ${className}`}
        role="img"
        aria-label={`Failed to load: ${alt}`}
      >
        <div className="text-center p-4 space-y-2">
          <ImageOff className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      loading={priority ? 'eager' : 'lazy'}
      onError={handleError}
    />
  );
};
