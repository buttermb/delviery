/**
 * useJsonLd Hook
 * Manages SEO meta tags, canonical URL, and JSON-LD structured data for product pages
 */

import { useEffect } from 'react';

import type { ProductDetails, ProductReview } from '@/pages/shop/product-detail/types';

interface UseJsonLdParams {
  product: (ProductDetails & { slug?: string }) | null | undefined;
  store: { store_name: string } | null;
  storeSlug: string | undefined;
  allImages: string[];
  reviews: ProductReview[];
  averageRating: number;
  addToRecentlyViewed: (productId: string) => void;
}

/**
 * Injects page title, meta description, canonical URL, and JSON-LD structured data
 * for product detail pages. Cleans up JSON-LD script on unmount.
 */
export function useJsonLd({
  product,
  store,
  storeSlug,
  allImages,
  reviews,
  averageRating,
  addToRecentlyViewed,
}: UseJsonLdParams) {
  useEffect(() => {
    if (!product || !store) return;

    // Update title
    document.title = `${product.name} | ${store.store_name}`;

    // Add to recently viewed
    if (product.product_id) {
      addToRecentlyViewed(product.product_id);
    }

    // SEO: Add canonical URL with slug if available
    const canonicalPath = product.slug
      ? `/shop/${storeSlug}/product/${product.slug}`
      : `/shop/${storeSlug}/products/${product.product_id}`;
    const canonicalUrl = `${window.location.origin}${canonicalPath}`;

    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', product.short_description || product.description || `Buy ${product.name} at ${store.store_name}`);
    } else {
      const newMeta = document.createElement('meta');
      newMeta.name = 'description';
      newMeta.content = product.short_description || product.description || `Buy ${product.name} at ${store.store_name}`;
      document.head.appendChild(newMeta);
    }

    // Add JSON-LD structured data for rich snippets
    const existingScript = document.getElementById('product-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || product.short_description,
      image: allImages.length > 0 ? allImages : undefined,
      sku: product.sku,
      brand: product.brand ? {
        '@type': 'Brand',
        name: product.brand
      } : undefined,
      offers: {
        '@type': 'Offer',
        url: window.location.href,
        priceCurrency: 'USD',
        price: product.display_price,
        availability: product.in_stock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: store.store_name
        }
      },
      aggregateRating: reviews.length > 0 ? {
        '@type': 'AggregateRating',
        ratingValue: averageRating.toFixed(1),
        reviewCount: reviews.length
      } : undefined
    };

    const script = document.createElement('script');
    script.id = 'product-jsonld';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const scriptToRemove = document.getElementById('product-jsonld');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [product, store, storeSlug, addToRecentlyViewed, allImages, reviews, averageRating]);
}
