/**
 * useOptimizedImage Hook
 * Generates optimized image URLs for Supabase Storage images
 * Supports responsive srcSet generation and WebP/AVIF formats
 */

interface OptimizedImageOptions {
    /** Target width in pixels */
    width?: number;
    /** Quality 1-100 (default: 80) */
    quality?: number;
    /** Image format (default: 'webp') */
    format?: 'webp' | 'avif' | 'origin';
    /** Generate srcSet for 1x, 2x, 3x densities */
    generateSrcSet?: boolean;
}

interface OptimizedImageResult {
    /** Optimized image URL */
    src: string;
    /** srcSet for responsive images */
    srcSet?: string;
    /** Sizes attribute recommendation */
    sizes?: string;
}

/**
 * Check if URL is a Supabase storage URL that supports transformations
 */
function isSupabaseStorageUrl(url: string): boolean {
    return url.includes('.supabase.co/storage/v1/object/public/');
}

/**
 * Build optimized URL with Supabase image transformation parameters
 */
function buildOptimizedUrl(
    baseUrl: string,
    width: number,
    quality: number,
    format: string
): string {
    const url = new URL(baseUrl);

    // Supabase storage transformation parameters
    url.searchParams.set('width', width.toString());
    url.searchParams.set('quality', quality.toString());

    if (format !== 'origin') {
        url.searchParams.set('format', format);
    }

    return url.toString();
}

/**
 * Hook for generating optimized image URLs
 * 
 * @example
 * ```tsx
 * const { src, srcSet } = useOptimizedImage(product.imageUrl, { width: 300 });
 * <img src={src} srcSet={srcSet} loading="lazy" />
 * ```
 */
export function useOptimizedImage(
    imageUrl: string | undefined | null,
    options: OptimizedImageOptions = {}
): OptimizedImageResult {
    const {
        width = 400,
        quality = 80,
        format = 'webp',
        generateSrcSet = true,
    } = options;

    // Return empty if no URL
    if (!imageUrl) {
        return { src: '' };
    }

    // Only transform Supabase storage URLs
    if (!isSupabaseStorageUrl(imageUrl)) {
        return { src: imageUrl };
    }

    const src = buildOptimizedUrl(imageUrl, width, quality, format);

    if (!generateSrcSet) {
        return { src };
    }

    // Generate srcSet for 1x, 2x, 3x pixel densities
    const srcSet = [
        `${buildOptimizedUrl(imageUrl, width, quality, format)} 1x`,
        `${buildOptimizedUrl(imageUrl, width * 2, quality, format)} 2x`,
        `${buildOptimizedUrl(imageUrl, width * 3, quality - 10, format)} 3x`, // Lower quality for 3x
    ].join(', ');

    return {
        src,
        srcSet,
        sizes: `(max-width: ${width}px) 100vw, ${width}px`,
    };
}

/**
 * Convenience function for product thumbnails (300px)
 */
export function useProductThumbnail(imageUrl: string | undefined | null) {
    return useOptimizedImage(imageUrl, { width: 300, quality: 75 });
}

/**
 * Convenience function for product detail images (600px)
 */
export function useProductImage(imageUrl: string | undefined | null) {
    return useOptimizedImage(imageUrl, { width: 600, quality: 85 });
}

/**
 * Convenience function for hero/banner images (1200px)
 */
export function useHeroImage(imageUrl: string | undefined | null) {
    return useOptimizedImage(imageUrl, { width: 1200, quality: 85 });
}

/**
 * Convenience function for avatar/profile images (100px)
 */
export function useAvatarImage(imageUrl: string | undefined | null) {
    return useOptimizedImage(imageUrl, { width: 100, quality: 80 });
}

export default useOptimizedImage;
