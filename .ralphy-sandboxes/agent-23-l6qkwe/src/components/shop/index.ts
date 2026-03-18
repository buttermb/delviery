/**
 * Shop Components
 * Customer-facing storefront UI components
 */

export { MobileBottomNav } from './MobileBottomNav';
export { SearchAutocomplete } from './SearchAutocomplete';
export { RecentlyViewed, trackRecentlyViewed } from './RecentlyViewed';
export { StickyAddToCart } from './StickyAddToCart';
export { ReviewForm } from './ReviewForm';

// Dynamic background
export { DynamicBackground, BACKGROUND_STYLE_OPTIONS, type BackgroundStyle } from './DynamicBackground';

// Luxury theme components
export { FloatingCartButton } from './FloatingCartButton';
export { CartDrawer, type CartItem } from './CartDrawer';
export { WishlistButton } from './WishlistButton';
export { FilterDrawer, FilterTriggerButton, getActiveFilterCount, type FilterState } from './FilterDrawer';
export { LuxuryNav } from './LuxuryNav';
export { LuxuryFooter } from './LuxuryFooter';
export { LuxuryAgeVerification } from './LuxuryAgeVerification';

// Luxury theme sections (re-exported from sections)
export { LuxuryHeroSection } from './sections/LuxuryHeroSection';
export { LuxuryProductGridSection } from './sections/LuxuryProductGridSection';
export { LuxuryFeaturesSection } from './sections/LuxuryFeaturesSection';

// Luxury theme utilities
export { useLuxuryTheme, luxuryClasses } from './luxury/useLuxuryTheme';
