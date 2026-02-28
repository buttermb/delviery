/**
 * StorefrontBuilder Configuration
 * Section types, templates, defaults, and shared types
 */

import { Layout, Sparkles, MessageSquare, Mail, Image, HelpCircle, Code } from 'lucide-react';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { NewsletterSection } from '@/components/shop/sections/NewsletterSection';
import { GallerySection } from '@/components/shop/sections/GallerySection';
import { FAQSection } from '@/components/shop/sections/FAQSection';
import { CustomHTMLSection } from '@/components/shop/sections/CustomHTMLSection';
import type { LucideIcon } from 'lucide-react';

export interface SectionConfig {
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
}

export interface ThemeConfig {
    colors: { primary: string; secondary: string; accent: string; background: string; text: string };
    typography: { fontFamily: string };
}

export interface SectionTypeDefinition {
    label: string;
    icon: LucideIcon;
    component: React.ComponentType<{ content: Record<string, unknown>; styles: Record<string, unknown>; storeId?: string }>;
}

export const DEFAULT_THEME: ThemeConfig = {
    colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
    typography: { fontFamily: 'Inter' }
};

// Define available section types (8 total)
export const SECTION_TYPES: Record<string, SectionTypeDefinition> = {
    hero: { label: 'Hero Section', icon: Layout, component: HeroSection },
    features: { label: 'Features Grid', icon: Sparkles, component: FeaturesSection },
    product_grid: { label: 'Product Grid', icon: Layout, component: ProductGridSection },
    testimonials: { label: 'Testimonials', icon: MessageSquare, component: TestimonialsSection },
    newsletter: { label: 'Newsletter', icon: Mail, component: NewsletterSection },
    gallery: { label: 'Gallery', icon: Image, component: GallerySection },
    faq: { label: 'FAQ', icon: HelpCircle, component: FAQSection },
    custom_html: { label: 'Custom HTML', icon: Code, component: CustomHTMLSection },
};

export type SectionTypeKey = keyof typeof SECTION_TYPES;

// Templates for quick setup
export const TEMPLATES = {
    minimal: {
        name: 'Minimal',
        description: 'Clean and simple',
        sections: ['hero', 'product_grid']
    },
    standard: {
        name: 'Standard',
        description: 'Hero, Features, Products',
        sections: ['hero', 'features', 'product_grid']
    },
    full: {
        name: 'Full Experience',
        description: 'Complete storefront',
        sections: ['hero', 'features', 'product_grid', 'testimonials', 'faq', 'newsletter']
    },
    landing: {
        name: 'Landing Page',
        description: 'Conversion focused',
        sections: ['hero', 'gallery', 'testimonials', 'newsletter']
    }
};

export type TemplateKey = keyof typeof TEMPLATES;

// Helper to get defaults dynamically so we don't crash on new props
export function sectionDefaults(type: string): { content: Record<string, unknown>; styles: Record<string, unknown> } {
    if (type === 'hero') return {
        content: { heading_line_1: 'Premium', heading_line_2: 'Flower', heading_line_3: 'Delivered', subheading: 'Premium delivery service.' },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#022c22', text_color: '#ffffff', accent_color: '#34d399' }
    };
    if (type === 'features') return {
        content: { heading_small: 'The Difference', heading_large: 'Excellence' },
        styles: { background_color: '#171717', text_color: '#ffffff', icon_color: '#34d399' }
    };
    if (type === 'product_grid') return {
        content: { heading: 'Shop Collection', subheading: 'Curated selection.', columns: 4, max_products: 20, sort_order: 'newest', show_view_all_link: true, category_filter: 'all', show_search: true, show_categories: true, show_premium_filter: true, initial_categories_shown: 2 },
        styles: { background_color: '#f4f4f5', text_color: '#000000', accent_color: '#10b981' }
    };
    if (type === 'testimonials') return {
        content: { heading: 'What Our Customers Say', subheading: 'Join thousands of satisfied customers' },
        styles: { background_color: '#ffffff', text_color: '#000000', accent_color: '#10b981', card_background: '#f9fafb' }
    };
    if (type === 'newsletter') return {
        content: { heading: 'Stay in the Loop', subheading: 'Subscribe for exclusive drops.', button_text: 'Subscribe', placeholder_text: 'Enter your email', success_message: 'Thanks for subscribing!' },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#1f2937', text_color: '#ffffff', accent_color: '#10b981', button_color: '#10b981' }
    };
    if (type === 'gallery') return {
        content: { heading: 'Gallery', subheading: 'A curated visual experience' },
        styles: { background_color: '#000000', text_color: '#ffffff', accent_color: '#10b981' }
    };
    if (type === 'faq') return {
        content: { heading: 'Frequently Asked Questions', subheading: 'Got questions? We\'ve got answers.' },
        styles: { background_color: '#f9fafb', text_color: '#000000', accent_color: '#10b981', border_color: '#e5e7eb' }
    };
    if (type === 'custom_html') return {
        content: { html_content: '<p>Add your custom HTML content here</p>', section_title: '' },
        styles: { background_color: '#ffffff', text_color: '#000000', padding_y: '4rem', max_width: '1200px' }
    };
    return { content: {}, styles: {} };
}
