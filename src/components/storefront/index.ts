/**
 * Storefront Components Index
 * Customer-facing storefront components
 */

export { default as ProductDetailPage } from './ProductDetailPage';
export type { ProductDetailData } from './ProductDetailPage';

export { default as ShoppingCartDrawer } from './ShoppingCartDrawer';
export type { CartItem } from './ShoppingCartDrawer';

export { default as CheckoutFlow } from './CheckoutFlow';

export { default as OrderConfirmationPage } from './OrderConfirmationPage';
export type { OrderConfirmationData, OrderItem, DeliveryAddress } from './OrderConfirmationPage';

export { default as OrderTrackingPage } from './OrderTrackingPage';
export type { TrackedOrder } from './OrderTrackingPage';

export { default as AgeVerificationGate } from './AgeVerificationGate';

export { default as StorefrontHeader } from './StorefrontHeader';

export { default as StorefrontFooter } from './StorefrontFooter';

export { default as StorefrontClosedState } from './StorefrontClosedState';

export { default as StorefrontNotFound } from './StorefrontNotFound';

export { default as ProductSearchFilters } from './ProductSearchFilters';
export type { ProductFilters } from './ProductSearchFilters';
