/**
 * Storefront Theme Presets
 * Pre-built themes optimized for cannabis storefronts
 * Following FloraIQ patterns: interfaces, no `any`, @/ imports
 */

import { logger } from '@/lib/logger';

/**
 * Theme color palette configuration
 */
export interface ThemeColors {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    card: string;
    cardForeground: string;
    border: string;
}

/**
 * Theme typography configuration
 */
export interface ThemeTypography {
    fontFamily: string;
    headingFamily: string;
    headingWeight: string;
    bodySize: string;
    headingSize: {
        h1: string;
        h2: string;
        h3: string;
    };
}

/**
 * Theme layout and spacing
 */
export interface ThemeLayout {
    borderRadius: string;
    containerWidth: string;
    sectionPadding: string;
    cardShadow: string;
    buttonStyle: 'solid' | 'outline' | 'ghost' | 'gradient';
}

/**
 * Complete theme preset configuration
 */
export interface ThemePreset {
    id: string;
    name: string;
    description: string;
    tagline: string;
    thumbnail: string;
    colors: ThemeColors;
    typography: ThemeTypography;
    layout: ThemeLayout;
    darkMode: boolean;
}

/**
 * Pre-built theme presets
 */
export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'dark-mode',
        name: 'Dark Mode',
        description: 'Sleek, modern dark theme perfect for cannabis brands',
        tagline: 'Premium dark aesthetic',
        thumbnail: '/themes/dark-mode.png',
        darkMode: true,
        colors: {
            primary: '#8B5CF6', // Violet
            primaryForeground: '#FFFFFF',
            secondary: '#1F2937', // Slate
            secondaryForeground: '#F9FAFB',
            accent: '#10B981', // Emerald
            accentForeground: '#FFFFFF',
            background: '#0F172A', // Dark slate
            foreground: '#F8FAFC',
            muted: '#1E293B',
            mutedForeground: '#94A3B8',
            card: '#1E293B',
            cardForeground: '#F8FAFC',
            border: '#334155',
        },
        typography: {
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFamily: 'Outfit, Inter, sans-serif',
            headingWeight: '700',
            bodySize: '16px',
            headingSize: {
                h1: '3.5rem',
                h2: '2.5rem',
                h3: '1.75rem',
            },
        },
        layout: {
            borderRadius: '12px',
            containerWidth: '1280px',
            sectionPadding: '6rem',
            cardShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
            buttonStyle: 'gradient',
        },
    },
    {
        id: 'minimalist',
        name: 'Minimalist',
        description: 'Clean, white-space focused design that lets products shine',
        tagline: 'Less is more',
        thumbnail: '/themes/minimalist.png',
        darkMode: false,
        colors: {
            primary: '#18181B', // Zinc 900
            primaryForeground: '#FFFFFF',
            secondary: '#F4F4F5', // Zinc 100
            secondaryForeground: '#18181B',
            accent: '#18181B',
            accentForeground: '#FFFFFF',
            background: '#FFFFFF',
            foreground: '#18181B',
            muted: '#F4F4F5',
            mutedForeground: '#71717A',
            card: '#FFFFFF',
            cardForeground: '#18181B',
            border: '#E4E4E7',
        },
        typography: {
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFamily: 'Inter, sans-serif',
            headingWeight: '600',
            bodySize: '15px',
            headingSize: {
                h1: '3rem',
                h2: '2rem',
                h3: '1.5rem',
            },
        },
        layout: {
            borderRadius: '4px',
            containerWidth: '1200px',
            sectionPadding: '5rem',
            cardShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            buttonStyle: 'solid',
        },
    },
    {
        id: 'strain-focused',
        name: 'Strain-Focused',
        description: 'Cannabis-centric design with strain type color coding',
        tagline: 'Indica • Sativa • Hybrid',
        thumbnail: '/themes/strain-focused.png',
        darkMode: true,
        colors: {
            primary: '#22C55E', // Green (Cannabis)
            primaryForeground: '#FFFFFF',
            secondary: '#1C1917', // Stone 950
            secondaryForeground: '#FAFAF9',
            accent: '#A855F7', // Purple (Indica)
            accentForeground: '#FFFFFF',
            background: '#0C0A09', // Stone 950
            foreground: '#FAFAF9',
            muted: '#1C1917',
            mutedForeground: '#A8A29E',
            card: '#1C1917',
            cardForeground: '#FAFAF9',
            border: '#292524',
        },
        typography: {
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFamily: 'Outfit, Inter, sans-serif',
            headingWeight: '800',
            bodySize: '16px',
            headingSize: {
                h1: '4rem',
                h2: '2.5rem',
                h3: '1.75rem',
            },
        },
        layout: {
            borderRadius: '16px',
            containerWidth: '1400px',
            sectionPadding: '6rem',
            cardShadow: '0 20px 50px rgba(34, 197, 94, 0.15)',
            buttonStyle: 'gradient',
        },
    },
    {
        id: 'luxury',
        name: 'Luxury',
        description: 'Premium, boutique aesthetic for high-end brands',
        tagline: 'Elevated experience',
        thumbnail: '/themes/luxury.png',
        darkMode: true,
        colors: {
            primary: '#D4AF37', // Gold
            primaryForeground: '#0A0A0A',
            secondary: '#171717', // Neutral 900
            secondaryForeground: '#FAFAFA',
            accent: '#F5F5F4', // Stone 100
            accentForeground: '#0A0A0A',
            background: '#0A0A0A', // Neutral 950
            foreground: '#FAFAFA',
            muted: '#171717',
            mutedForeground: '#A3A3A3',
            card: '#171717',
            cardForeground: '#FAFAFA',
            border: '#262626',
        },
        typography: {
            fontFamily: 'Cormorant Garamond, Georgia, serif',
            headingFamily: 'Playfair Display, Georgia, serif',
            headingWeight: '500',
            bodySize: '17px',
            headingSize: {
                h1: '4rem',
                h2: '2.75rem',
                h3: '2rem',
            },
        },
        layout: {
            borderRadius: '2px',
            containerWidth: '1100px',
            sectionPadding: '8rem',
            cardShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
            buttonStyle: 'outline',
        },
    },
];

/**
 * Convert theme preset to CSS custom properties
 */
export function themeToCSS(theme: ThemePreset): string {
    return `
    :root {
      --primary: ${theme.colors.primary};
      --primary-foreground: ${theme.colors.primaryForeground};
      --secondary: ${theme.colors.secondary};
      --secondary-foreground: ${theme.colors.secondaryForeground};
      --accent: ${theme.colors.accent};
      --accent-foreground: ${theme.colors.accentForeground};
      --background: ${theme.colors.background};
      --foreground: ${theme.colors.foreground};
      --muted: ${theme.colors.muted};
      --muted-foreground: ${theme.colors.mutedForeground};
      --card: ${theme.colors.card};
      --card-foreground: ${theme.colors.cardForeground};
      --border: ${theme.colors.border};
      --radius: ${theme.layout.borderRadius};
      --font-sans: ${theme.typography.fontFamily};
      --font-heading: ${theme.typography.headingFamily};
    }
  `;
}

/**
 * Get theme by ID
 */
export function getThemeById(id: string): ThemePreset | undefined {
    const theme = THEME_PRESETS.find(t => t.id === id);
    if (!theme) {
        logger.warn('Theme not found', { themeId: id });
    }
    return theme;
}

/**
 * Apply theme to storefront config
 */
export function applyThemeToConfig(
    currentConfig: Record<string, unknown>,
    theme: ThemePreset
): Record<string, unknown> {
    logger.debug('Applying theme to config', { themeId: theme.id });

    return {
        ...currentConfig,
        theme_id: theme.id,
        colors: theme.colors,
        typography: theme.typography,
        layout: theme.layout,
        dark_mode: theme.darkMode,
    };
}
