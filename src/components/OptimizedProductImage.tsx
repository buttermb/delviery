import { useState } from 'react';

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

  // Handle different image source types
  let imageSrc = src;
  
  // If it's a local public path, use as-is
  if (src?.startsWith('/products/') || src?.startsWith('/public/')) {
    imageSrc = src;
  }
  // If it's already a full URL (Supabase storage), use as-is
  else if (src?.startsWith('http://') || src?.startsWith('https://') || src?.startsWith('//')) {
    imageSrc = src;
  }
  // If it's a placeholder, use as-is
  else if (src?.startsWith('/placeholder') || src?.includes('placeholder')) {
    imageSrc = src;
  }
  // Otherwise, assume it's a Supabase storage path and needs the public URL
  else if (src && !src.startsWith('/')) {
    imageSrc = src; // Already a storage URL
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && !error && (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-black animate-pulse">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full border border-emerald-500/20 animate-pulse" />
          </div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          // Silently handle error - no console logging
          setIsLoading(false);
          setError(true);
        }}
        className={`
          w-full h-full object-cover transition-opacity duration-300
          ${isLoading ? 'opacity-0' : 'opacity-100'}
          ${error ? 'opacity-50' : ''}
        `}
        style={{
          contentVisibility: 'auto',
          willChange: isLoading ? 'opacity' : 'auto',
        }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 to-black">
          <div className="text-center p-8">
            <div className="w-24 h-24 mx-auto mb-4 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-sm text-white/60 font-light">Product Image</p>
            <p className="text-xs text-white/40 font-light mt-2">{alt}</p>
          </div>
        </div>
      )}
    </div>
  );
};
