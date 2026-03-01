/**
 * Luxury Theme Styles Hook
 * Provides theme-aware class names and styles for shop pages
 */

import { useShop } from '@/pages/shop/ShopLayout';

interface LuxuryThemeStyles {
    isLuxuryTheme: boolean;
    accentColor: string;
    // Container styles
    containerBg: string;
    cardBg: string;
    cardBorder: string;
    // Text styles  
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    // Input styles
    inputBg: string;
    inputBorder: string;
    inputText: string;
    // Button styles
    buttonGhost: string;
    buttonOutline: string;
    // Misc
    separator: string;
    skeleton: string;
}

export function useLuxuryTheme(): LuxuryThemeStyles {
    const { store } = useShop();

    const isLuxuryTheme = store?.theme_config?.theme === 'luxury';
    const accentColor = store?.theme_config?.colors?.accent || store?.accent_color || '#10b981';

    if (!isLuxuryTheme) {
        // Standard theme - return empty strings (use defaults)
        return {
            isLuxuryTheme: false,
            accentColor,
            containerBg: '',
            cardBg: '',
            cardBorder: '',
            textPrimary: '',
            textSecondary: '',
            textMuted: 'text-muted-foreground',
            inputBg: '',
            inputBorder: '',
            inputText: '',
            buttonGhost: '',
            buttonOutline: '',
            separator: '',
            skeleton: '',
        };
    }

    // Luxury dark theme
    return {
        isLuxuryTheme: true,
        accentColor,
        containerBg: 'bg-black',
        cardBg: 'bg-white/[0.02] backdrop-blur-xl',
        cardBorder: 'border-white/[0.05]',
        textPrimary: 'text-white',
        textSecondary: 'text-white/70',
        textMuted: 'text-white/70',
        inputBg: 'bg-white/5',
        inputBorder: 'border-white/10',
        inputText: 'text-white placeholder:text-white/50',
        buttonGhost: 'text-white/70 hover:text-white hover:bg-white/10',
        buttonOutline: 'border-white/10 text-white hover:bg-white/5',
        separator: 'bg-white/10',
        skeleton: 'bg-white/5',
    };
}

/**
 * Generate luxury-aware class names for common components
 */
export function luxuryClasses(isLuxury: boolean, defaultClass: string, luxuryClass: string): string {
    return isLuxury ? luxuryClass : defaultClass;
}
