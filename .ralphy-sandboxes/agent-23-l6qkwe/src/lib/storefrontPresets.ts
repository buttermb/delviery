/**
 * Storefront Preset Packs
 * One-click combinations of theme + layout + feature toggles
 * for friction-free storefront setup
 */

import { logger } from '@/lib/logger';
import { THEME_PRESETS, type ThemePreset } from '@/lib/storefrontThemes';

/**
 * Feature toggles control what UI elements appear in the storefront
 */
export interface FeatureToggles {
    // Product badges
    showSaleBadges: boolean;
    showNewBadges: boolean;
    showStrainBadges: boolean;
    showStockWarnings: boolean;
    // Grid features
    enableSearch: boolean;
    showCategories: boolean;
    showPremiumFilter: boolean;
    // Sections visibility
    showHero: boolean;
    showFeatures: boolean;
    showTestimonials: boolean;
    showNewsletter: boolean;
    showFAQ: boolean;
}

/**
 * Simple content fields editable in Easy Mode
 */
export interface SimpleContent {
    announcementBanner?: string;
    heroHeadline: string;
    heroSubheadline: string;
    heroCtaText: string;
    heroCtaLink: string;
}

/**
 * Easy Mode configuration stored in theme_config.easy_mode
 */
export interface EasyModeConfig {
    enabled: boolean;
    preset_id: string | null;
    feature_toggles: FeatureToggles;
    simple_content: SimpleContent;
    custom_modifications: string[];
    last_preset_applied_at?: string;
}

/**
 * Preset Pack combines theme + template + toggles + content
 */
export interface PresetPack {
    id: string;
    name: string;
    description: string;
    tagline: string;
    themeId: string;
    templateId: 'minimal' | 'standard' | 'full' | 'landing';
    featureToggles: FeatureToggles;
    defaultContent: SimpleContent;
    category: 'quick-start' | 'professional' | 'premium';
    recommendedFor: string[];
    icon: 'rocket' | 'sun' | 'briefcase' | 'leaf' | 'crown' | 'megaphone';
}

/**
 * Default feature toggles - all enabled for maximum functionality
 */
export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
    showSaleBadges: true,
    showNewBadges: true,
    showStrainBadges: true,
    showStockWarnings: true,
    enableSearch: true,
    showCategories: true,
    showPremiumFilter: false,
    showHero: true,
    showFeatures: true,
    showTestimonials: false,
    showNewsletter: false,
    showFAQ: false,
};

/**
 * Default simple content
 */
export const DEFAULT_SIMPLE_CONTENT: SimpleContent = {
    heroHeadline: 'Premium Cannabis Delivered',
    heroSubheadline: 'Fast, discreet delivery to your door',
    heroCtaText: 'Shop Now',
    heroCtaLink: '/shop',
};

/**
 * 6 Preset Packs covering common use cases
 */
export const PRESET_PACKS: PresetPack[] = [
    {
        id: 'quick-dark',
        name: 'Quick Launch',
        description: 'Get online fast with a sleek dark theme',
        tagline: 'Fast. Modern. Ready.',
        themeId: 'dark-mode',
        templateId: 'minimal',
        category: 'quick-start',
        recommendedFor: ['new stores', 'delivery services', 'quick setup'],
        icon: 'rocket',
        featureToggles: {
            showSaleBadges: true,
            showNewBadges: true,
            showStrainBadges: true,
            showStockWarnings: true,
            enableSearch: true,
            showCategories: true,
            showPremiumFilter: false,
            showHero: true,
            showFeatures: false,
            showTestimonials: false,
            showNewsletter: false,
            showFAQ: false,
        },
        defaultContent: {
            heroHeadline: 'Premium Cannabis Delivered',
            heroSubheadline: 'Fast, discreet delivery to your door',
            heroCtaText: 'Shop Now',
            heroCtaLink: '/shop',
        },
    },
    {
        id: 'quick-light',
        name: 'Quick Launch Light',
        description: 'Clean and minimal for a professional look',
        tagline: 'Simple. Clean. Professional.',
        themeId: 'minimalist',
        templateId: 'minimal',
        category: 'quick-start',
        recommendedFor: ['dispensaries', 'medical', 'professional'],
        icon: 'sun',
        featureToggles: {
            showSaleBadges: true,
            showNewBadges: true,
            showStrainBadges: true,
            showStockWarnings: true,
            enableSearch: true,
            showCategories: true,
            showPremiumFilter: false,
            showHero: true,
            showFeatures: false,
            showTestimonials: false,
            showNewsletter: false,
            showFAQ: false,
        },
        defaultContent: {
            heroHeadline: 'Quality Cannabis Products',
            heroSubheadline: 'Lab-tested. Locally sourced. Delivered with care.',
            heroCtaText: 'Browse Products',
            heroCtaLink: '/shop',
        },
    },
    {
        id: 'pro-standard',
        name: 'Professional',
        description: 'Complete store with features and product showcase',
        tagline: 'Everything you need to succeed.',
        themeId: 'minimalist',
        templateId: 'standard',
        category: 'professional',
        recommendedFor: ['established stores', 'multi-location', 'brands'],
        icon: 'briefcase',
        featureToggles: {
            showSaleBadges: true,
            showNewBadges: true,
            showStrainBadges: true,
            showStockWarnings: true,
            enableSearch: true,
            showCategories: true,
            showPremiumFilter: true,
            showHero: true,
            showFeatures: true,
            showTestimonials: false,
            showNewsletter: false,
            showFAQ: false,
        },
        defaultContent: {
            heroHeadline: 'Your Trusted Source',
            heroSubheadline: 'Premium products. Expert service. Unmatched quality.',
            heroCtaText: 'Explore Collection',
            heroCtaLink: '/shop',
        },
    },
    {
        id: 'pro-nature',
        name: 'Nature Focused',
        description: 'Earthy, organic aesthetic for cannabis brands',
        tagline: 'Celebrate the plant.',
        themeId: 'strain-focused',
        templateId: 'standard',
        category: 'professional',
        recommendedFor: ['craft cannabis', 'organic', 'farm-to-table'],
        icon: 'leaf',
        featureToggles: {
            showSaleBadges: true,
            showNewBadges: true,
            showStrainBadges: true,
            showStockWarnings: true,
            enableSearch: true,
            showCategories: true,
            showPremiumFilter: true,
            showHero: true,
            showFeatures: true,
            showTestimonials: false,
            showNewsletter: false,
            showFAQ: false,
        },
        defaultContent: {
            heroHeadline: 'Craft Cannabis',
            heroSubheadline: 'Grown with care. Curated for you.',
            heroCtaText: 'Shop Strains',
            heroCtaLink: '/shop',
        },
    },
    {
        id: 'luxury-full',
        name: 'Luxury Boutique',
        description: 'Premium experience with all sections enabled',
        tagline: 'Elevated. Refined. Exclusive.',
        themeId: 'luxury',
        templateId: 'full',
        category: 'premium',
        recommendedFor: ['high-end', 'boutique', 'premium brands'],
        icon: 'crown',
        featureToggles: {
            showSaleBadges: false, // Luxury doesn't show "sale" - just premium pricing
            showNewBadges: true,
            showStrainBadges: true,
            showStockWarnings: false, // Creates urgency without looking desperate
            enableSearch: true,
            showCategories: true,
            showPremiumFilter: true,
            showHero: true,
            showFeatures: true,
            showTestimonials: true,
            showNewsletter: true,
            showFAQ: true,
        },
        defaultContent: {
            heroHeadline: 'The Finest Selection',
            heroSubheadline: 'Curated excellence for the discerning connoisseur.',
            heroCtaText: 'Discover',
            heroCtaLink: '/shop',
        },
    },
    {
        id: 'landing-focus',
        name: 'Landing Page',
        description: 'Conversion-focused design for marketing campaigns',
        tagline: 'Convert visitors to customers.',
        themeId: 'dark-mode',
        templateId: 'landing',
        category: 'premium',
        recommendedFor: ['campaigns', 'launches', 'promotions'],
        icon: 'megaphone',
        featureToggles: {
            showSaleBadges: true,
            showNewBadges: true,
            showStrainBadges: false,
            showStockWarnings: true,
            enableSearch: false,
            showCategories: false,
            showPremiumFilter: false,
            showHero: true,
            showFeatures: false,
            showTestimonials: true,
            showNewsletter: true,
            showFAQ: false,
        },
        defaultContent: {
            announcementBanner: 'Limited Time: Free Delivery on Orders $50+',
            heroHeadline: 'Spring Collection',
            heroSubheadline: 'New strains. New experiences. Available now.',
            heroCtaText: 'Shop the Drop',
            heroCtaLink: '/shop',
        },
    },
];

/**
 * Get preset pack by ID
 */
export function getPresetById(id: string): PresetPack | undefined {
    const preset = PRESET_PACKS.find(p => p.id === id);
    if (!preset) {
        logger.warn('Preset pack not found', { presetId: id });
    }
    return preset;
}

/**
 * Get theme for a preset
 */
export function getPresetTheme(preset: PresetPack): ThemePreset | undefined {
    return THEME_PRESETS.find(t => t.id === preset.themeId);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: PresetPack['category']): PresetPack[] {
    return PRESET_PACKS.filter(p => p.category === category);
}

/**
 * Template configurations for section generation
 */
export const TEMPLATE_SECTIONS: Record<PresetPack['templateId'], string[]> = {
    minimal: ['hero', 'product_grid'],
    standard: ['hero', 'features', 'product_grid'],
    full: ['hero', 'features', 'product_grid', 'testimonials', 'faq', 'newsletter'],
    landing: ['hero', 'gallery', 'testimonials', 'newsletter'],
};

/**
 * Generate section configs from a preset
 */
export function generateSectionsFromPreset(preset: PresetPack): Array<{
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible: boolean;
}> {
    const sectionTypes = TEMPLATE_SECTIONS[preset.templateId];
    const theme = getPresetTheme(preset);

    return sectionTypes.map(type => ({
        id: crypto.randomUUID(),
        type,
        content: getSectionDefaultContent(type, preset),
        styles: getSectionDefaultStyles(type, theme),
        visible: isSectionVisibleInPreset(type, preset.featureToggles),
    }));
}

/**
 * Check if a section should be visible based on feature toggles
 */
function isSectionVisibleInPreset(sectionType: string, toggles: FeatureToggles): boolean {
    switch (sectionType) {
        case 'hero':
            return toggles.showHero;
        case 'features':
            return toggles.showFeatures;
        case 'testimonials':
            return toggles.showTestimonials;
        case 'newsletter':
            return toggles.showNewsletter;
        case 'faq':
            return toggles.showFAQ;
        default:
            return true; // product_grid, gallery always visible
    }
}

/**
 * Get default content for a section type
 */
function getSectionDefaultContent(type: string, preset: PresetPack): Record<string, unknown> {
    const content = preset.defaultContent;

    switch (type) {
        case 'hero':
            return {
                heading_line_1: content.heroHeadline.split(' ')[0] || 'Premium',
                heading_line_2: content.heroHeadline.split(' ').slice(1, 2).join(' ') || 'Cannabis',
                heading_line_3: content.heroHeadline.split(' ').slice(2).join(' ') || 'Delivered',
                subheading: content.heroSubheadline,
                cta_primary_text: content.heroCtaText,
                cta_primary_link: content.heroCtaLink,
                cta_secondary_text: 'Learn More',
                cta_secondary_link: '/about',
                trust_badges: true,
            };
        case 'features':
            return {
                heading_small: 'Why Choose Us',
                heading_large: 'The Difference',
                features: [
                    { icon: 'clock', title: 'Fast Delivery', description: 'Same-day delivery available.' },
                    { icon: 'shield', title: 'Lab Tested', description: 'Every product verified for quality.' },
                    { icon: 'lock', title: 'Discreet', description: 'Unmarked packaging guaranteed.' },
                    { icon: 'star', title: 'Premium Selection', description: 'Only the best strains.' },
                ],
            };
        case 'product_grid':
            return {
                heading: 'Shop Collection',
                subheading: 'Browse our curated selection',
                show_search: preset.featureToggles.enableSearch,
                show_categories: preset.featureToggles.showCategories,
                show_premium_filter: preset.featureToggles.showPremiumFilter,
                initial_categories_shown: 3,
            };
        case 'testimonials':
            return {
                heading: 'Customer Reviews',
                subheading: 'What our customers say',
                testimonials: [
                    { name: 'Alex M.', role: 'Verified Customer', quote: 'Amazing quality and fast delivery!', rating: 5 },
                    { name: 'Jordan K.', role: 'Regular Customer', quote: 'Best selection in town. Highly recommend.', rating: 5 },
                    { name: 'Sam R.', role: 'New Customer', quote: 'Great first experience. Will order again!', rating: 5 },
                ],
            };
        case 'newsletter':
            return {
                heading: 'Stay Updated',
                subheading: 'Get exclusive deals and new arrivals.',
                button_text: 'Subscribe',
                placeholder_text: 'Enter your email',
            };
        case 'faq':
            return {
                heading: 'FAQ',
                subheading: 'Common questions answered',
                faqs: [
                    { question: 'How fast is delivery?', answer: 'We offer same-day delivery for orders placed before 6 PM.' },
                    { question: 'What payment methods accepted?', answer: 'Cash, debit, and all major credit cards.' },
                    { question: 'Is there a minimum order?', answer: '$30 minimum for delivery. Free delivery over $75.' },
                ],
            };
        case 'gallery':
            return {
                heading: 'Gallery',
                subheading: 'A visual journey',
                images: [
                    { url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600', alt: 'Product showcase' },
                    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', alt: 'Store interior' },
                    { url: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=600', alt: 'Premium products' },
                ],
            };
        default:
            return {};
    }
}

/**
 * Get default styles for a section type based on theme
 */
function getSectionDefaultStyles(type: string, theme?: ThemePreset): Record<string, unknown> {
    const colors = theme?.colors || {
        background: '#ffffff',
        foreground: '#000000',
        primary: '#000000',
        accent: '#10b981',
        card: '#f9fafb',
        border: '#e5e7eb',
    };

    const isDark = theme?.darkMode ?? false;

    switch (type) {
        case 'hero':
            return {
                background_gradient_start: isDark ? '#000000' : '#f8fafc',
                background_gradient_end: isDark ? '#022c22' : '#e2e8f0',
                text_color: colors.foreground,
                accent_color: colors.accent,
            };
        case 'features':
            return {
                background_color: isDark ? '#171717' : '#f9fafb',
                text_color: colors.foreground,
                icon_color: colors.accent,
            };
        case 'product_grid':
            return {
                background_color: colors.background,
                text_color: colors.foreground,
                accent_color: colors.accent,
            };
        case 'testimonials':
            return {
                background_color: colors.background,
                text_color: colors.foreground,
                accent_color: colors.accent,
                card_background: colors.card,
            };
        case 'newsletter':
            return {
                background_gradient_start: isDark ? '#000000' : '#1f2937',
                background_gradient_end: isDark ? '#1f2937' : '#374151',
                text_color: '#ffffff',
                accent_color: colors.accent,
                button_color: colors.primary,
            };
        case 'faq':
            return {
                background_color: isDark ? '#0a0a0a' : '#f9fafb',
                text_color: colors.foreground,
                accent_color: colors.accent,
                border_color: colors.border,
            };
        case 'gallery':
            return {
                background_color: isDark ? '#000000' : '#ffffff',
                text_color: colors.foreground,
                accent_color: colors.accent,
            };
        default:
            return {};
    }
}

/**
 * Create a default Easy Mode config
 */
export function createDefaultEasyModeConfig(presetId?: string): EasyModeConfig {
    const preset = presetId ? getPresetById(presetId) : PRESET_PACKS[0];

    return {
        enabled: true,
        preset_id: preset?.id || null,
        feature_toggles: preset?.featureToggles || DEFAULT_FEATURE_TOGGLES,
        simple_content: preset?.defaultContent || DEFAULT_SIMPLE_CONTENT,
        custom_modifications: [],
    };
}

/**
 * Detect if layout config has advanced customizations
 * that would be lost when switching to Simple Mode
 */
export function detectAdvancedCustomizations(layoutConfig: Array<{ type: string; responsive?: unknown }>): {
    hasCustomizations: boolean;
    customizations: string[];
} {
    const customizations: string[] = [];

    // Check for custom HTML sections
    const hasCustomHTML = layoutConfig.some(s => s.type === 'custom_html');
    if (hasCustomHTML) {
        customizations.push('Custom HTML sections');
    }

    // Check for responsive overrides
    const hasResponsive = layoutConfig.some(s => s.responsive && Object.keys(s.responsive as object).length > 0);
    if (hasResponsive) {
        customizations.push('Responsive settings');
    }

    // Check for more sections than any template provides
    const maxTemplateSections = Math.max(
        ...Object.values(TEMPLATE_SECTIONS).map(sections => sections.length)
    );
    if (layoutConfig.length > maxTemplateSections) {
        customizations.push('Additional sections beyond template');
    }

    return {
        hasCustomizations: customizations.length > 0,
        customizations,
    };
}
