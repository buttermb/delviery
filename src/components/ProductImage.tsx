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
  
  // Premium gradient fallback - unique per product based on name
  const fallbackGradients = [
    'from-emerald-500/20 to-teal-500/20',
    'from-purple-500/20 to-pink-500/20',
    'from-blue-500/20 to-cyan-500/20',
    'from-amber-500/20 to-orange-500/20',
    'from-rose-500/20 to-pink-500/20',
    'from-violet-500/20 to-purple-500/20',
  ];
  
  // Pick gradient based on product name (consistent per product)
  const gradientIndex = alt.length % fallbackGradients.length;
  const gradient = fallbackGradients[gradientIndex];
  
  const hasImage = src && !imageError;
  
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${className}`}>
      
      {/* Loading spinner */}
      {isLoading && hasImage && (
        <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="w-12 h-12 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}
      
      {/* Actual image */}
      {hasImage ? (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setImageError(true);
            setIsLoading(false);
          }}
          loading="lazy"
        />
      ) : (
        // Beautiful fallback UI when no image or error
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
          
          {/* Icon container */}
          <div className="mb-4 p-6 rounded-full bg-white/5 backdrop-blur-xl border border-white/10">
            <svg 
              className="w-12 h-12 text-emerald-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" 
              />
            </svg>
          </div>
          
          {/* Product name */}
          <div className="text-white/60 text-sm font-light tracking-wide max-w-full truncate">
            {alt}
          </div>
          <div className="text-white/30 text-xs font-light mt-2">
            Premium Product
          </div>
          
        </div>
      )}
      
      {/* Overlay gradient for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
      
    </div>
  );
}

