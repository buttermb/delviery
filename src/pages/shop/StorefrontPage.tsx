import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { useShop } from '@/pages/shop/ShopLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { NewsletterSection } from '@/components/shop/sections/NewsletterSection';
import { GallerySection } from '@/components/shop/sections/GallerySection';
import { FAQSection } from '@/components/shop/sections/FAQSection';
import { CustomHTMLSection } from '@/components/shop/sections/CustomHTMLSection';
import { LuxuryHeroSection } from '@/components/shop/sections/LuxuryHeroSection';
import { LuxuryProductGridSection } from '@/components/shop/sections/LuxuryProductGridSection';
import { LuxuryFeaturesSection } from '@/components/shop/sections/LuxuryFeaturesSection';
import { HotItemsSection } from '@/components/shop/sections/HotItemsSection';
import { PromotionsBannerSection } from '@/components/shop/sections/PromotionsBannerSection';
import { DealsHighlightSection } from '@/components/shop/sections/DealsHighlightSection';
import { AnnouncementBar } from '@/components/shop/sections/AnnouncementBar';
import { SEOHead } from '@/components/SEOHead';
import { StorefrontShareDialog } from '@/components/shop/StorefrontShareDialog';
import { logger } from '@/lib/logger';

/** Section component props contract */
interface SectionComponentProps {
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    storeId?: string;
}

/** Map section types to their rendering components */
const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionComponentProps>> = {
    hero: HeroSection as React.ComponentType<SectionComponentProps>,
    features: FeaturesSection as React.ComponentType<SectionComponentProps>,
    product_grid: LuxuryProductGridSection as React.ComponentType<SectionComponentProps>,
    testimonials: TestimonialsSection as React.ComponentType<SectionComponentProps>,
    newsletter: NewsletterSection as React.ComponentType<SectionComponentProps>,
    gallery: GallerySection as React.ComponentType<SectionComponentProps>,
    faq: FAQSection as React.ComponentType<SectionComponentProps>,
    custom_html: CustomHTMLSection as React.ComponentType<SectionComponentProps>,
    hot_items: HotItemsSection as React.ComponentType<SectionComponentProps>,
    promotions_banner: PromotionsBannerSection as React.ComponentType<SectionComponentProps>,
    deals_highlight: DealsHighlightSection as React.ComponentType<SectionComponentProps>,
    luxury_hero: LuxuryHeroSection as React.ComponentType<SectionComponentProps>,
    luxury_products: LuxuryProductGridSection as React.ComponentType<SectionComponentProps>,
    luxury_features: LuxuryFeaturesSection as React.ComponentType<SectionComponentProps>,
};

/** Section config shape from layout_config */
interface LayoutSection {
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
}

export function StorefrontPage() {
    const { storeSlug } = useParams<{ storeSlug: string }>();
    const { store, isLoading } = useShop();
    const [shareDialogOpen, setShareDialogOpen] = useState(false);

    /** Build Schema.org Store JSON-LD structured data */
    const structuredData = useMemo(() => {
        if (!store) return undefined;
        return {
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: store.store_name,
            description: store.tagline || `Shop at ${store.store_name}`,
            url: typeof window !== 'undefined' ? window.location.href : '',
            image: store.logo_url || undefined,
            ...(store.operating_hours ? {
                openingHoursSpecification: Object.entries(store.operating_hours)
                    .filter(([, hours]) => {
                        const h = hours as { open?: string; close?: string; closed?: boolean };
                        return !h.closed;
                    })
                    .map(([day, hours]) => {
                        const h = hours as { open?: string; close?: string };
                        return {
                            '@type': 'OpeningHoursSpecification',
                            dayOfWeek: day,
                            opens: h.open || '10:00',
                            closes: h.close || '22:00',
                        };
                    }),
            } : {}),
        };
    }, [store]);

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Skeleton className="h-96 w-full mb-8 rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-64 rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    if (!store) return null;

    const layoutConfig = store.layout_config as unknown as LayoutSection[] | null | undefined;
    const hasValidLayout = Array.isArray(layoutConfig) && layoutConfig.length > 0;
    const accentColor = store.theme_config?.colors?.accent || store.accent_color || '#10b981';

    const sections: LayoutSection[] = hasValidLayout
        ? layoutConfig
        : [
            {
                id: 'default-hero',
                type: 'hero',
                content: {
                    heading_line_1: store.store_name,
                    heading_line_2: 'Welcome',
                    heading_line_3: 'To Our Store',
                    subheading: 'Premium cannabis delivery.',
                    primary_button_text: 'Shop Now',
                    primary_button_link: `/shop/${storeSlug}/products`,
                },
                styles: {
                    background_gradient_start: store.theme_config?.colors?.primary || store.primary_color || '#000000',
                    background_gradient_end: '#022c22',
                    text_color: '#ffffff',
                    accent_color: '#34d399',
                },
            },
            {
                id: 'default-deals-highlight',
                type: 'deals_highlight',
                content: {
                    heading: 'Current Deals',
                    subheading: "Don't miss out on these limited-time offers",
                    max_deals: 3,
                    show_view_all: true,
                },
                styles: { accent_color: accentColor },
            },
            {
                id: 'default-hot-items',
                type: 'hot_items',
                content: { show_time_indicator: true, max_items: 8 },
                styles: {
                    accent_color: store.theme_config?.colors?.primary || store.primary_color || undefined,
                },
            },
            {
                id: 'default-products',
                type: 'product_grid',
                content: {
                    heading: 'Featured Products',
                    subheading: 'Our top selection',
                    show_search: true,
                },
                styles: {
                    background_color: '#ffffff',
                    text_color: '#000000',
                    accent_color: store.theme_config?.colors?.primary || store.primary_color || '#000000',
                },
            },
        ];

    const seoTitle = `${store.store_name} | Cannabis Delivery`;
    const seoDescription = store.tagline || `Shop premium cannabis at ${store.store_name}. Fast delivery, lab-tested products.`;

    return (
        <div
            className="min-h-dvh overflow-x-hidden"
            style={{
                backgroundColor: 'var(--storefront-bg, hsl(var(--background)))',
                color: 'var(--storefront-text, inherit)',
            }}
        >
            {/* SEO: Title, Meta, OG, Twitter, JSON-LD */}
            <SEOHead
                title={seoTitle}
                description={seoDescription}
                image={store.logo_url || undefined}
                type="website"
                structuredData={structuredData}
            />

            {/* Announcement Bar */}
            <AnnouncementBar storeId={store.id} accentColor={accentColor} />

            {/* Section Renderer */}
            {sections
                .filter((s) => s.visible !== false)
                .map((section, index) => {
                    const Component = SECTION_COMPONENTS[section.type];
                    if (!Component) {
                        logger.warn(`Unknown section type: ${section.type}`);
                        return null;
                    }

                    try {
                        return (
                            <div
                                key={section.id}
                                data-section-type={section.type}
                                data-section-index={index}
                                data-testid={`storefront-section-${section.type}`}
                            >
                                <Component
                                    content={section.content}
                                    styles={section.styles}
                                    storeId={store.id}
                                />
                            </div>
                        );
                    } catch (error) {
                        logger.error(`Error rendering section ${section.id}`, error);
                        return null;
                    }
                })}

            {/* Share Store Bar */}
            <div className="bg-muted/50 border-t py-6">
                <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">Share this store with friends</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShareDialogOpen(true)}
                        className="gap-2"
                    >
                        <Share2 className="w-4 h-4" />
                        Share Store
                    </Button>
                </div>
            </div>

            {/* Share Dialog */}
            <StorefrontShareDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                storeName={store.store_name}
                storeSlug={storeSlug || store.slug}
            />
        </div>
    );
}

/** Default export for route compatibility */
export default StorefrontPage;
