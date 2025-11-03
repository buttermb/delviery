/**
 * Image Optimization Utility
 * Uses Supabase storage transformation for optimized image delivery
 */

/**
 * Optimize image URL using Supabase storage transformation
 * @param url - Original image URL or path
 * @param width - Target width in pixels (default: 800)
 * @param quality - JPEG quality 1-100 (default: 80)
 * @param format - Output format: 'webp' | 'jpeg' | 'png' (default: 'webp')
 * @returns Optimized image URL
 */
export function optimizeImage(
  url: string,
  width?: number,
  quality: number = 80,
  format: 'webp' | 'jpeg' | 'png' = 'webp'
): string {
  if (!url) return '';
  
  // If URL is already absolute, return as-is (might be external)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Check if it's a Supabase storage URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (url.includes(supabaseUrl || '')) {
      // Extract path from Supabase URL
      const pathMatch = url.match(/\/storage\/v1\/object\/public\/(.+)/);
      if (pathMatch) {
        const storagePath = pathMatch[1];
        return `${supabaseUrl}/storage/v1/render/image/public/${storagePath}?width=${width || 800}&quality=${quality}&format=${format}`;
      }
    }
    return url;
  }

  // If relative path, construct full Supabase storage URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    console.warn('VITE_SUPABASE_URL not configured, returning original URL');
    return url;
  }

  // Remove leading slash if present
  const cleanPath = url.startsWith('/') ? url.slice(1) : url;
  
  // Construct optimized URL
  return `${supabaseUrl}/storage/v1/render/image/public/${cleanPath}?width=${width || 800}&quality=${quality}&format=${format}`;
}

/**
 * Get responsive image srcset
 * @param url - Original image URL
 * @param widths - Array of widths for srcset (default: [400, 800, 1200])
 * @returns srcset string
 */
export function getResponsiveSrcSet(
  url: string,
  widths: number[] = [400, 800, 1200]
): string {
  return widths
    .map(width => `${optimizeImage(url, width)} ${width}w`)
    .join(', ');
}

/**
 * Generate optimized img tag props
 * @param url - Original image URL
 * @param alt - Alt text
 * @param width - Target width
 * @returns Object with src, srcSet, loading, and decoding props
 */
export function getOptimizedImageProps(
  url: string,
  alt: string,
  width?: number
): {
  src: string;
  srcSet?: string;
  loading: 'lazy' | 'eager';
  decoding: 'async' | 'auto' | 'sync';
} {
  return {
    src: optimizeImage(url, width),
    srcSet: width ? undefined : getResponsiveSrcSet(url),
    loading: 'lazy' as const,
    decoding: 'async' as const,
  };
}

