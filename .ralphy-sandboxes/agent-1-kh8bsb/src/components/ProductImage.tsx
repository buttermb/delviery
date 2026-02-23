/**
 * Enhanced Product Image Component with Beautiful Fallback
 * Handles missing images gracefully with premium fallback UI
 */

import { useState } from 'react';

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export default function ProductImage({ src, alt, className = '' }: ProductImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const hasImage = src && !imageError;

  return (
    <div className={`relative overflow-hidden bg-neutral-100 ${className}`}>

      {/* Loading spinner */}
      {isLoading && hasImage && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="w-12 h-12 border-2 border-shop-accent/30 border-t-shop-accent rounded-full animate-spin" />
        </div>
      )}

      {/* Actual image */}
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setImageError(true);
            setIsLoading(false);
          }}
          loading="lazy"
        />
      ) : (
        // Beautiful fallback UI when no image or error - Light Theme Optimized
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center min-h-[200px] bg-neutral-50">

          {/* Icon container */}
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

          {/* Product name */}
          <div className="text-neutral-500 text-sm font-medium tracking-wide max-w-full truncate px-4">
            {alt}
          </div>
          <div className="text-neutral-400 text-xs mt-1">
            No Image
          </div>

        </div>
      )}

      {/* Subtle border for depth */}
      <div className="absolute inset-0 border border-black/5 pointer-events-none" />

    </div>
  );
}

