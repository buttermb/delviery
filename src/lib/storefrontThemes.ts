/**
 * Storefront Theme Presets
 * Pre-built themes optimized for cannabis storefronts
 * Following FloraIQ patterns: interfaces, no `any`, @/ imports
 */

import { logger } from '@/lib/logger';

/**
 * CSS custom properties for storefront themes
 * Using --storefront-* prefix for namespacing
 */
export interface StorefrontCSSVariables {
    '--storefront-bg': string;
    '--storefront-text': string;
    '--storefront-primary': string;
    '--storefront-accent': string;
    '--storefront-card-bg': string;
    '--storefront-border': string;
    '--storefront-radius': string;
    '--storefront-shadow': string;
}

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
 * Theme font pairing configuration
 */
export interface ThemeFonts {
    heading: string;
    body: string;
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
    fonts: ThemeFonts;
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
    cssVariables: StorefrontCSSVariables;
}

/**
 * Pre-built theme presets
 *
 * 4 themes with CSS variables:
 * 1. Dark Mode - #0a0a0a bg, #22c55e primary, neon accents
 * 2. Minimalist - #ffffff bg, #0f172a primary, clean
 * 3. Strain Focused - #fefce8 bg, #65a30d primary, nature
 * 4. Luxury - #0c0a09 bg, #d4af37 gold primary
 */
export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'dark-mode',
        name: 'Dark Mode',
        description: 'Sleek, modern dark theme with neon accents for cannabis brands',
        tagline: 'Neon-lit cannabis aesthetic',
        thumbnail: '/themes/dark-mode.png',
        darkMode: true,
        colors: {
            primary: '#22c55e', // Neon green
            primaryForeground: '#0a0a0a',
            secondary: '#171717', // Neutral 900
            secondaryForeground: '#fafafa',
            accent: '#00ff88', // Neon accent
            accentForeground: '#0a0a0a',
            background: '#0a0a0a', // Near black
            foreground: '#fafafa',
            muted: '#171717',
            mutedForeground: '#a3a3a3',
            card: '#171717',
            cardForeground: '#fafafa',
            border: '#262626',
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
            fonts: {
                heading: 'Outfit',
                body: 'Inter',
            },
        },
        layout: {
            borderRadius: '12px',
            containerWidth: '1280px',
            sectionPadding: '6rem',
            cardShadow: '0 10px 40px rgba(34, 197, 94, 0.2)',
            buttonStyle: 'gradient',
        },
        cssVariables: {
            '--storefront-bg': '#0a0a0a',
            '--storefront-text': '#fafafa',
            '--storefront-primary': '#22c55e',
            '--storefront-accent': '#00ff88',
            '--storefront-card-bg': '#171717',
            '--storefront-border': '#262626',
            '--storefront-radius': '12px',
            '--storefront-shadow': '0 10px 40px rgba(34, 197, 94, 0.2)',
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
            primary: '#0f172a', // Slate 900
            primaryForeground: '#ffffff',
            secondary: '#f8fafc', // Slate 50
            secondaryForeground: '#0f172a',
            accent: '#3b82f6', // Blue accent
            accentForeground: '#ffffff',
            background: '#ffffff', // White
            foreground: '#0f172a',
            muted: '#f1f5f9',
            mutedForeground: '#5b6f82', // WCAG AA: ≥4.5:1 on both #ffffff and #f1f5f9
            card: '#ffffff',
            cardForeground: '#0f172a',
            border: '#e2e8f0',
        },
        typography: {
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFamily: 'Inter, sans-serif',
            headingWeight: '600',
            bodySize: '16px',
            headingSize: {
                h1: '3rem',
                h2: '2rem',
                h3: '1.5rem',
            },
            fonts: {
                heading: 'Inter',
                body: 'Inter',
            },
        },
        layout: {
            borderRadius: '8px',
            containerWidth: '1200px',
            sectionPadding: '5rem',
            cardShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
            buttonStyle: 'solid',
        },
        cssVariables: {
            '--storefront-bg': '#ffffff',
            '--storefront-text': '#0f172a',
            '--storefront-primary': '#0f172a',
            '--storefront-accent': '#3b82f6',
            '--storefront-card-bg': '#ffffff',
            '--storefront-border': '#e2e8f0',
            '--storefront-radius': '8px',
            '--storefront-shadow': '0 1px 3px rgba(0, 0, 0, 0.08)',
        },
    },
    {
        id: 'strain-focused',
        name: 'Strain Focused',
        description: 'Nature-inspired design celebrating cannabis strains',
        tagline: 'Indica • Sativa • Hybrid',
        thumbnail: '/themes/strain-focused.png',
        darkMode: false,
        colors: {
            primary: '#65a30d', // Lime 600
            primaryForeground: '#ffffff',
            secondary: '#fef9c3', // Yellow 100
            secondaryForeground: '#365314',
            accent: '#84cc16', // Lime 500
            accentForeground: '#1a2e05',
            background: '#fefce8', // Yellow 50
            foreground: '#365314',
            muted: '#ecfccb',
            mutedForeground: '#4d7c0f',
            card: '#fffef5',
            cardForeground: '#365314',
            border: '#d9f99d',
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
            fonts: {
                heading: 'Outfit',
                body: 'Inter',
            },
        },
        layout: {
            borderRadius: '16px',
            containerWidth: '1400px',
            sectionPadding: '6rem',
            cardShadow: '0 4px 20px rgba(101, 163, 13, 0.12)',
            buttonStyle: 'gradient',
        },
        cssVariables: {
            '--storefront-bg': '#fefce8',
            '--storefront-text': '#365314',
            '--storefront-primary': '#65a30d',
            '--storefront-accent': '#84cc16',
            '--storefront-card-bg': '#fffef5',
            '--storefront-border': '#d9f99d',
            '--storefront-radius': '16px',
            '--storefront-shadow': '0 4px 20px rgba(101, 163, 13, 0.12)',
        },
    },
    {
        id: 'luxury',
        name: 'Luxury',
        description: 'Premium, boutique aesthetic for high-end cannabis brands',
        tagline: 'Elevated experience',
        thumbnail: '/themes/luxury.png',
        darkMode: true,
        colors: {
            primary: '#d4af37', // Gold
            primaryForeground: '#0c0a09',
            secondary: '#1c1917', // Stone 900
            secondaryForeground: '#fafaf9',
            accent: '#f5f5f4', // Stone 100
            accentForeground: '#0c0a09',
            background: '#0c0a09', // Stone 950
            foreground: '#fafaf9',
            muted: '#1c1917',
            mutedForeground: '#a8a29e',
            card: '#1c1917',
            cardForeground: '#fafaf9',
            border: '#292524',
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
            fonts: {
                heading: 'Playfair Display',
                body: 'Cormorant Garamond',
            },
        },
        layout: {
            borderRadius: '2px',
            containerWidth: '1100px',
            sectionPadding: '8rem',
            cardShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
            buttonStyle: 'outline',
        },
        cssVariables: {
            '--storefront-bg': '#0c0a09',
            '--storefront-text': '#fafaf9',
            '--storefront-primary': '#d4af37',
            '--storefront-accent': '#f5f5f4',
            '--storefront-card-bg': '#1c1917',
            '--storefront-border': '#292524',
            '--storefront-radius': '2px',
            '--storefront-shadow': '0 25px 60px rgba(0, 0, 0, 0.5)',
        },
    },
];

/**
 * Convert theme preset to CSS custom properties
 * Includes both legacy variables and new --storefront-* prefixed variables
 */
export function themeToCSS(theme: ThemePreset): string {
    const css = theme.cssVariables;
    return `
    :root {
      /* Storefront-specific CSS variables */
      --storefront-bg: ${css['--storefront-bg']};
      --storefront-text: ${css['--storefront-text']};
      --storefront-primary: ${css['--storefront-primary']};
      --storefront-accent: ${css['--storefront-accent']};
      --storefront-card-bg: ${css['--storefront-card-bg']};
      --storefront-border: ${css['--storefront-border']};
      --storefront-radius: ${css['--storefront-radius']};
      --storefront-shadow: ${css['--storefront-shadow']};

      /* Font pairings */
      --storefront-font-heading: ${theme.typography.fonts.heading};
      --storefront-font-body: ${theme.typography.fonts.body};

      /* Legacy variables for shadcn/ui compatibility */
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
 * Apply CSS variables to a DOM element
 */
export function applyCSSVariables(
    element: HTMLElement,
    theme: ThemePreset
): void {
    const css = theme.cssVariables;
    Object.entries(css).forEach(([key, value]) => {
        element.style.setProperty(key, value);
    });

    // Also set font pairings
    element.style.setProperty('--storefront-font-heading', theme.typography.fonts.heading);
    element.style.setProperty('--storefront-font-body', theme.typography.fonts.body);

    logger.debug('Applied CSS variables to element', { themeId: theme.id });
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
 * Custom theme interface for user-defined themes
 * Includes CSS variables, typography, spacing, effects, and raw custom CSS
 */
export interface CustomTheme {
    /** Color palette */
    colors: {
        background: string;
        text: string;
        primary: string;
        accent: string;
        muted: string;
        border: string;
    };
    /** Typography settings */
    typography: {
        headingFont: string;
        bodyFont: string;
        baseFontSize: string;
    };
    /** Spacing and border radius */
    spacing: {
        borderRadius: string;
        sectionSpacing: string;
    };
    /** Visual effects */
    effects: {
        cardShadow: string;
        backdropBlur: string;
    };
    /** Raw custom CSS string to inject */
    customCSS: string;
}

/** Default custom theme values */
export const DEFAULT_CUSTOM_THEME: CustomTheme = {
    colors: {
        background: '#ffffff',
        text: '#0f172a',
        primary: '#22c55e',
        accent: '#3b82f6',
        muted: '#f1f5f9',
        border: '#e2e8f0',
    },
    typography: {
        headingFont: 'Inter',
        bodyFont: 'Inter',
        baseFontSize: '16px',
    },
    spacing: {
        borderRadius: '8px',
        sectionSpacing: '4rem',
    },
    effects: {
        cardShadow: '0 1px 3px rgba(0,0,0,0.08)',
        backdropBlur: '0px',
    },
    customCSS: '',
};

/** Available font options for theme editor */
export const FONT_OPTIONS = [
    { label: 'Inter', value: 'Inter' },
    { label: 'Playfair Display', value: 'Playfair Display' },
    { label: 'Montserrat', value: 'Montserrat' },
    { label: 'Roboto', value: 'Roboto' },
    { label: 'Poppins', value: 'Poppins' },
    { label: 'DM Sans', value: 'DM Sans' },
    { label: 'Outfit', value: 'Outfit' },
    { label: 'Cormorant Garamond', value: 'Cormorant Garamond' },
] as const;

/**
 * Convert a CustomTheme to CSS variables string for injection
 */
export function customThemeToCSS(theme: CustomTheme): string {
    return `
    :root {
      --storefront-bg: ${theme.colors.background};
      --storefront-text: ${theme.colors.text};
      --storefront-primary: ${theme.colors.primary};
      --storefront-accent: ${theme.colors.accent};
      --storefront-card-bg: ${theme.colors.muted};
      --storefront-border: ${theme.colors.border};
      --storefront-radius: ${theme.spacing.borderRadius};
      --storefront-shadow: ${theme.effects.cardShadow};
      --storefront-font-heading: ${theme.typography.headingFont};
      --storefront-font-body: ${theme.typography.bodyFont};
    }
    ${theme.customCSS}
  `;
}

/**
 * Convert a CustomTheme to a ThemePreset-compatible config object
 */
export function customThemeToConfig(theme: CustomTheme): Record<string, unknown> {
    return {
        colors: {
            primary: theme.colors.primary,
            accent: theme.colors.accent,
            background: theme.colors.background,
            text: theme.colors.text,
        },
        typography: {
            fontFamily: theme.typography.bodyFont,
            headingFamily: theme.typography.headingFont,
        },
        layout: {
            borderRadius: theme.spacing.borderRadius,
        },
        customCSS: theme.customCSS,
    };
}

/**
 * Apply storefront CSS variables to a DOM element from simple color settings.
 * Used by the live preview panel to reflect theme changes immediately without save.
 */
export function applyPreviewCSSVariables(
    element: HTMLElement,
    colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
        cardBg: string;
        border: string;
    },
    fontFamily?: string
): void {
    element.style.setProperty('--storefront-primary', colors.primary);
    element.style.setProperty('--storefront-accent', colors.accent);
    element.style.setProperty('--storefront-bg', colors.background);
    element.style.setProperty('--storefront-text', colors.text);
    element.style.setProperty('--storefront-card-bg', colors.cardBg);
    element.style.setProperty('--storefront-border', colors.border);
    element.style.setProperty('--storefront-secondary', colors.secondary);
    if (fontFamily) {
        element.style.setProperty('--storefront-font-heading', fontFamily);
        element.style.setProperty('--storefront-font-body', fontFamily);
    }
    logger.debug('Applied preview CSS variables', { primary: colors.primary });
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
