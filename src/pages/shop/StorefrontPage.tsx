
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useShop } from './ShopLayout';
import { MarketplaceProfile } from '@/types/marketplace-extended';
import { Skeleton } from '@/components/ui/skeleton';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { LuxuryHeroSection } from '@/components/shop/sections/LuxuryHeroSection';
import { LuxuryProductGridSection } from '@/components/shop/sections/LuxuryProductGridSection';
import { LuxuryFeaturesSection } from '@/components/shop/sections/LuxuryFeaturesSection';

// Map section types to components
const SECTION_COMPONENTS: Record<string, any> = {
  hero: HeroSection,
  features: FeaturesSection,
  product_grid: ProductGridSection,
  // Luxury theme sections
  luxury_hero: LuxuryHeroSection,
  luxury_products: LuxuryProductGridSection,
  luxury_features: LuxuryFeaturesSection,
};

export default function StorefrontPage() {
  const { storeSlug } = useParams();
  const { store, isLoading } = useShop();

  // If loading, show skeleton
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-96 w-full mb-8 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!store) return null;

  // Use layout_config from store if available, otherwise fallback to default layout
  // Defensive check: ensure layout_config is an array with items
  const layoutConfig = store.layout_config;
  const hasValidLayout = Array.isArray(layoutConfig) && layoutConfig.length > 0;

  const sections = hasValidLayout
    ? layoutConfig
    : [
      // Default Layout if none configured
      {
        id: 'default-hero',
        type: 'hero',
        content: {
          heading_line_1: store.store_name,
          heading_line_2: "Welcome",
          heading_line_3: "To Our Store",
          subheading: "Premium cannabis delivery.",
          primary_button_text: "Shop Now",
          primary_button_link: `/shop/${storeSlug}/products`
        },
        styles: {
          background_gradient_start: store.theme_config?.colors?.primary || store.primary_color || '#000000',
          background_gradient_end: '#022c22',
          text_color: '#ffffff',
          accent_color: '#34d399'
        }
      },
      {
        id: 'default-products',
        type: 'product_grid',
        content: {
          heading: "Featured Products",
          subheading: "Our top selection",
          show_search: true
        },
        styles: {
          background_color: '#ffffff',
          text_color: '#000000',
          accent_color: store.theme_config?.colors?.primary || store.primary_color || '#000000'
        }
      }
    ];

  return (
    <div className="min-h-screen bg-background">
      {sections.map((section: any) => {
        const Component = SECTION_COMPONENTS[section.type];
        if (!Component) {
          console.warn(`Unknown section type: ${section.type}`);
          return null;
        }

        // Wrap each section in error boundary - graceful degradation
        try {
          return (
            <Component
              key={section.id}
              content={section.content}
              styles={section.styles}
              storeId={store.id} // Pass storeId for data fetching
            />
          );
        } catch (error) {
          console.error(`Error rendering section ${section.id}:`, error);
          // Return null to gracefully skip broken sections
          return null;
        }
      })}
    </div>
  );
}
