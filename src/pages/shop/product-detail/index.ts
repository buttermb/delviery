/**
 * Product Detail — Barrel Export
 * Re-exports all sub-components, types, and hooks for the product detail page
 */

export { ProductGallery } from './ProductGallery';
export { ProductInfo } from './ProductInfo';
export { ProductTabs } from './ProductTabs';
export { useJsonLd } from './useJsonLd';

export type {
  RpcProduct,
  ProductDetails,
  ProductReview,
} from './types';

export { transformProduct } from './types';
