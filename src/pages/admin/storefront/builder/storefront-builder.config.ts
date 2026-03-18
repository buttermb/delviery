/**
 * StorefrontBuilder Configuration
 * Section types, templates, defaults, and shared types
 */

import { Layout, LayoutGrid, Sparkles, MessageSquare, Mail, Image, HelpCircle, Code, FileText, ShoppingBag, Star, LayoutTemplate } from 'lucide-react';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { NewsletterSection } from '@/components/shop/sections/NewsletterSection';
import { GallerySection } from '@/components/shop/sections/GallerySection';
import { FAQSection } from '@/components/shop/sections/FAQSection';
import { CustomHTMLSection } from '@/components/shop/sections/CustomHTMLSection';
import type { LucideIcon } from 'lucide-react';

export type SectionType = 'hero' | 'features' | 'product_grid' | 'testimonials' | 'newsletter' | 'gallery' | 'faq' | 'custom_html';
export type SectionCategory = 'layout' | 'content' | 'commerce' | 'social_proof' | 'advanced';

export interface StorefrontSection {
    id: string;
    type: SectionType;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
    responsive?: {
        mobile?: Record<string, unknown>;
        tablet?: Record<string, unknown>;
        desktop?: Record<string, unknown>;
    };
}

export interface ThemeConfig {
    colors: { primary: string; secondary: string; accent: string; background: string; text: string };
    typography: { fontFamily: string };
}

export interface SectionDefinition {
    type: SectionType;
    label: string;
    description: string;
    category: SectionCategory;
    icon: LucideIcon;
    component: React.ComponentType<any>;
    defaults: { content: Record<string, unknown>; styles: Record<string, unknown> };
}

export const SECTION_CATEGORIES: { key: SectionCategory; label: string; icon: LucideIcon }[] = [
  { key: 'layout', label: 'Layout', icon: LayoutTemplate },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'commerce', label: 'Commerce', icon: ShoppingBag },
  { key: 'social_proof', label: 'Social Proof', icon: Star },
  { key: 'advanced', label: 'Advanced', icon: Code },
];

export const SECTION_REGISTRY: Record<SectionType, SectionDefinition> = {
    hero: { 
        type: 'hero',
        label: 'Hero Banner', 
        description: 'Full-width banner with headline and CTA button', 
        category: 'layout',
        icon: Layout, 
        component: HeroSection,
        defaults: {
            content: {
                heading_line_1: 'Premium',
                heading_line_2: 'Flower',
                heading_line_3: 'Delivered',
                subheading: 'Curated strains. Same-day delivery.',
                background_image: '',
                cta_primary_text: 'Explore Collection',
                cta_primary_link: '/shop',
                cta_secondary_text: 'View Menu',
                cta_secondary_link: '/menu',
                trust_badges: true,
            },
            styles: { background_gradient_start: '#000000', background_gradient_end: '#022c22', text_color: '#ffffff', accent_color: '#34d399', overlay_opacity: 0.6 }
        }
    },
    features: { 
        type: 'features',
        label: 'Features Grid', 
        description: 'Highlight key benefits with icons and descriptions', 
        category: 'content',
        icon: Sparkles, 
        component: FeaturesSection,
        defaults: {
            content: {
                heading_small: 'The Difference',
                heading_large: 'Excellence in Every Detail',
                features: [
                    { icon: 'clock', title: 'Same-Day Delivery', description: 'Order before 9 PM for delivery within the hour.' },
                    { icon: 'shield', title: 'Lab Verified', description: 'Every strain tested for purity and quality.' },
                    { icon: 'lock', title: 'Discreet Service', description: 'Unmarked packaging. Your privacy is our priority.' },
                    { icon: 'star', title: 'Premium Selection', description: 'Hand-picked strains. Top-shelf quality.' },
                ],
            },
            styles: { background_color: '#171717', text_color: '#ffffff', icon_color: '#34d399' }
        }
    },
    product_grid: { 
        type: 'product_grid',
        label: 'Product Grid', 
        description: 'Showcase your products in a filterable grid', 
        category: 'commerce',
        icon: LayoutGrid, 
        component: ProductGridSection,
        defaults: {
            content: { heading: 'Shop Premium Collection', subheading: 'Premium indoor-grown flower from licensed cultivators', columns: 4, max_products: 20, sort_order: 'newest', show_view_all_link: true, category_filter: 'all', show_search: true, show_categories: true, show_premium_filter: true, initial_categories_shown: 2 },
            styles: { background_color: '#f4f4f5', text_color: '#000000', accent_color: '#10b981' }
        }
    },
    testimonials: { 
        type: 'testimonials',
        label: 'Testimonials', 
        description: 'Customer reviews with star ratings', 
        category: 'social_proof',
        icon: MessageSquare, 
        component: TestimonialsSection,
        defaults: {
            content: {
                heading: 'What Our Customers Say',
                subheading: 'Join thousands of satisfied customers',
                testimonials: [
                    { name: 'Sarah M.', role: 'Verified Customer', quote: 'The quality is unmatched. Fast delivery and exactly what I was looking for.', rating: 5 },
                    { name: 'Michael R.', role: 'Regular Customer', quote: 'Best service in the city. Professional, discreet, and always reliable.', rating: 5 },
                    { name: 'Jessica L.', role: 'New Customer', quote: 'Impressed with the selection and the speed of delivery. Highly recommend!', rating: 5 },
                ],
            },
            styles: { background_color: '#ffffff', text_color: '#000000', accent_color: '#10b981', card_background: '#f9fafb' }
        }
    },
    newsletter: { 
        type: 'newsletter',
        label: 'Newsletter', 
        description: 'Email signup form to grow your audience', 
        category: 'social_proof',
        icon: Mail, 
        component: NewsletterSection,
        defaults: {
            content: { heading: 'Stay in the Loop', subheading: 'Subscribe for exclusive drops, deals, and updates.', button_text: 'Subscribe', placeholder_text: 'Enter your email', success_message: 'Thanks for subscribing!' },
            styles: { background_gradient_start: '#000000', background_gradient_end: '#1f2937', text_color: '#ffffff', accent_color: '#10b981', button_color: '#10b981' }
        }
    },
    gallery: { 
        type: 'gallery',
        label: 'Gallery', 
        description: 'Visual image gallery to showcase your brand', 
        category: 'layout',
        icon: Image, 
        component: GallerySection,
        defaults: {
            content: {
                heading: 'Gallery',
                subheading: 'A curated visual experience',
                images: [
                    { url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600', alt: 'Product 1' },
                    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', alt: 'Product 2' },
                    { url: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=600', alt: 'Product 3' },
                    { url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600', alt: 'Product 4' },
                    { url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600', alt: 'Product 5' },
                    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600', alt: 'Product 6' },
                ],
                layout: 'masonry',
            },
            styles: { background_color: '#000000', text_color: '#ffffff', accent_color: '#10b981' }
        }
    },
    faq: { 
        type: 'faq',
        label: 'FAQ', 
        description: 'Frequently asked questions in an accordion layout', 
        category: 'content',
        icon: HelpCircle, 
        component: FAQSection,
        defaults: {
            content: {
                heading: 'Frequently Asked Questions',
                subheading: 'Got questions? We\'ve got answers.',
                faqs: [
                    { question: 'What are your delivery hours?', answer: 'We deliver 7 days a week from 10 AM to 10 PM. Same-day delivery available.' },
                    { question: 'How do I track my order?', answer: 'You\'ll receive a tracking link via SMS and email once dispatched.' },
                    { question: 'What payment methods do you accept?', answer: 'We accept cash, debit cards, and all major credit cards.' },
                    { question: 'Is there a minimum order?', answer: 'Minimum order is $50 for delivery. Orders above $100 get free delivery.' },
                ],
            },
            styles: { background_color: '#f9fafb', text_color: '#000000', accent_color: '#10b981', border_color: '#e5e7eb' }
        }
    },
    custom_html: { 
        type: 'custom_html',
        label: 'Custom HTML', 
        description: 'Add your own HTML content and embeds', 
        category: 'advanced',
        icon: Code, 
        component: CustomHTMLSection,
        defaults: {
            content: { html_content: '<p>Add your custom HTML content here</p>', section_title: '' },
            styles: { background_color: '#ffffff', text_color: '#000000', padding_y: '4rem', max_width: '1200px' }
        }
    },
};

export function createSectionDefaults(type: SectionType): StorefrontSection {
    const def = SECTION_REGISTRY[type];
    return {
        id: crypto.randomUUID(),
        type,
        visible: true,
        content: structuredClone(def.defaults.content),
        styles: structuredClone(def.defaults.styles)
    };
}

export const DEFAULT_THEME: ThemeConfig = {
    colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
    typography: { fontFamily: 'Inter' }
};

// Templates for quick setup
export const TEMPLATES = {
    minimal: {
        id: 'minimal',
        name: 'Minimal Menu',
        description: 'Clean product showcase with minimal branding',
        sections: ['hero', 'product_grid'] as SectionType[],
        tags: ['minimal', 'menu'],
    },
    standard: {
        id: 'standard',
        name: 'Standard Shop',
        description: 'Hero, Features, Products',
        sections: ['hero', 'features', 'product_grid'] as SectionType[],
        tags: ['popular', 'e-commerce'],
    },
    full: {
        id: 'full',
        name: 'Full Brand Experience',
        description: 'Complete storefront layout',
        sections: ['hero', 'features', 'product_grid', 'testimonials', 'faq', 'newsletter'] as SectionType[],
        tags: ['brand', 'comprehensive'],
    },
    landing: {
        id: 'landing',
        name: 'Landing Page',
        description: 'Conversion focused',
        sections: ['hero', 'gallery', 'testimonials', 'newsletter'] as SectionType[],
        tags: ['fast', 'minimal'],
    }
};

export type TemplateKey = keyof typeof TEMPLATES;
