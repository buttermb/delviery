import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
    THEME_PRESETS,
    getThemeById,
    themeToCSS,
    applyThemeToConfig,
    applyCSSVariables,
    loadGoogleFonts,
    type ThemePreset,
    type StorefrontCSSVariables,
} from '../storefrontThemes';

describe('storefrontThemes', () => {
    describe('THEME_PRESETS', () => {
        it('should have exactly 4 themes', () => {
            expect(THEME_PRESETS).toHaveLength(4);
        });

        it('should have all required theme IDs', () => {
            const themeIds = THEME_PRESETS.map((t) => t.id);
            expect(themeIds).toContain('dark-mode');
            expect(themeIds).toContain('minimalist');
            expect(themeIds).toContain('strain-focused');
            expect(themeIds).toContain('luxury');
        });

        describe('Dark Mode theme', () => {
            let darkMode: ThemePreset;

            beforeAll(() => {
                darkMode = THEME_PRESETS.find((t) => t.id === 'dark-mode')!;
            });

            it('should have correct background color (#0a0a0a)', () => {
                expect(darkMode.colors.background).toBe('#0a0a0a');
                expect(darkMode.cssVariables['--storefront-bg']).toBe('#0a0a0a');
            });

            it('should have correct primary color (#22c55e)', () => {
                expect(darkMode.colors.primary).toBe('#22c55e');
                expect(darkMode.cssVariables['--storefront-primary']).toBe('#22c55e');
            });

            it('should have neon accent', () => {
                expect(darkMode.colors.accent).toBe('#00ff88');
                expect(darkMode.cssVariables['--storefront-accent']).toBe('#00ff88');
            });

            it('should be dark mode', () => {
                expect(darkMode.darkMode).toBe(true);
            });

            it('should have font pairings', () => {
                expect(darkMode.typography.fonts.heading).toBe('Outfit');
                expect(darkMode.typography.fonts.body).toBe('Inter');
            });
        });

        describe('Minimalist theme', () => {
            let minimalist: ThemePreset;

            beforeAll(() => {
                minimalist = THEME_PRESETS.find((t) => t.id === 'minimalist')!;
            });

            it('should have correct background color (#ffffff)', () => {
                expect(minimalist.colors.background).toBe('#ffffff');
                expect(minimalist.cssVariables['--storefront-bg']).toBe('#ffffff');
            });

            it('should have correct primary color (#0f172a)', () => {
                expect(minimalist.colors.primary).toBe('#0f172a');
                expect(minimalist.cssVariables['--storefront-primary']).toBe('#0f172a');
            });

            it('should NOT be dark mode', () => {
                expect(minimalist.darkMode).toBe(false);
            });

            it('should have font pairings', () => {
                expect(minimalist.typography.fonts.heading).toBe('Inter');
                expect(minimalist.typography.fonts.body).toBe('Inter');
            });
        });

        describe('Strain Focused theme', () => {
            let strainFocused: ThemePreset;

            beforeAll(() => {
                strainFocused = THEME_PRESETS.find((t) => t.id === 'strain-focused')!;
            });

            it('should have correct background color (#fefce8)', () => {
                expect(strainFocused.colors.background).toBe('#fefce8');
                expect(strainFocused.cssVariables['--storefront-bg']).toBe('#fefce8');
            });

            it('should have correct primary color (#65a30d)', () => {
                expect(strainFocused.colors.primary).toBe('#65a30d');
                expect(strainFocused.cssVariables['--storefront-primary']).toBe('#65a30d');
            });

            it('should NOT be dark mode (nature theme)', () => {
                expect(strainFocused.darkMode).toBe(false);
            });

            it('should have font pairings', () => {
                expect(strainFocused.typography.fonts.heading).toBe('Outfit');
                expect(strainFocused.typography.fonts.body).toBe('Inter');
            });
        });

        describe('Luxury theme', () => {
            let luxury: ThemePreset;

            beforeAll(() => {
                luxury = THEME_PRESETS.find((t) => t.id === 'luxury')!;
            });

            it('should have correct background color (#0c0a09)', () => {
                expect(luxury.colors.background).toBe('#0c0a09');
                expect(luxury.cssVariables['--storefront-bg']).toBe('#0c0a09');
            });

            it('should have gold primary color (#d4af37)', () => {
                expect(luxury.colors.primary).toBe('#d4af37');
                expect(luxury.cssVariables['--storefront-primary']).toBe('#d4af37');
            });

            it('should be dark mode', () => {
                expect(luxury.darkMode).toBe(true);
            });

            it('should have elegant font pairings', () => {
                expect(luxury.typography.fonts.heading).toBe('Playfair Display');
                expect(luxury.typography.fonts.body).toBe('Cormorant Garamond');
            });
        });

        describe('all themes have required CSS variables', () => {
            const requiredVariables: (keyof StorefrontCSSVariables)[] = [
                '--storefront-bg',
                '--storefront-text',
                '--storefront-primary',
                '--storefront-accent',
                '--storefront-card-bg',
                '--storefront-border',
                '--storefront-radius',
                '--storefront-shadow',
            ];

            THEME_PRESETS.forEach((theme) => {
                it(`${theme.name} should have all required CSS variables`, () => {
                    requiredVariables.forEach((varName) => {
                        expect(theme.cssVariables[varName]).toBeDefined();
                        expect(theme.cssVariables[varName]).not.toBe('');
                    });
                });

                it(`${theme.name} should have font pairings`, () => {
                    expect(theme.typography.fonts.heading).toBeDefined();
                    expect(theme.typography.fonts.body).toBeDefined();
                });
            });
        });
    });

    describe('getThemeById', () => {
        it('should return theme when found', () => {
            const theme = getThemeById('dark-mode');
            expect(theme).toBeDefined();
            expect(theme?.id).toBe('dark-mode');
        });

        it('should return undefined for unknown theme ID', () => {
            const theme = getThemeById('non-existent-theme');
            expect(theme).toBeUndefined();
        });

        it('should return correct theme for each ID', () => {
            expect(getThemeById('minimalist')?.name).toBe('Minimalist');
            expect(getThemeById('strain-focused')?.name).toBe('Strain Focused');
            expect(getThemeById('luxury')?.name).toBe('Luxury');
        });
    });

    describe('themeToCSS', () => {
        it('should generate CSS with storefront variables', () => {
            const theme = getThemeById('dark-mode')!;
            const css = themeToCSS(theme);

            expect(css).toContain('--storefront-bg: #0a0a0a');
            expect(css).toContain('--storefront-text: #fafafa');
            expect(css).toContain('--storefront-primary: #22c55e');
            expect(css).toContain('--storefront-accent: #00ff88');
            expect(css).toContain('--storefront-card-bg: #171717');
            expect(css).toContain('--storefront-border: #262626');
            expect(css).toContain('--storefront-radius: 12px');
        });

        it('should include font pairings', () => {
            const theme = getThemeById('luxury')!;
            const css = themeToCSS(theme);

            expect(css).toContain('--storefront-font-heading: Playfair Display');
            expect(css).toContain('--storefront-font-body: Cormorant Garamond');
        });

        it('should include legacy variables for shadcn compatibility', () => {
            const theme = getThemeById('minimalist')!;
            const css = themeToCSS(theme);

            expect(css).toContain('--primary:');
            expect(css).toContain('--background:');
            expect(css).toContain('--foreground:');
            expect(css).toContain('--border:');
        });
    });

    describe('applyThemeToConfig', () => {
        it('should merge theme into config', () => {
            const theme = getThemeById('dark-mode')!;
            const existingConfig = { store_name: 'Test Store', custom_field: 'value' };

            const result = applyThemeToConfig(existingConfig, theme);

            expect(result.store_name).toBe('Test Store');
            expect(result.custom_field).toBe('value');
            expect(result.theme_id).toBe('dark-mode');
            expect(result.colors).toEqual(theme.colors);
            expect(result.typography).toEqual(theme.typography);
            expect(result.layout).toEqual(theme.layout);
            expect(result.dark_mode).toBe(true);
        });

        it('should override existing theme values', () => {
            const theme = getThemeById('minimalist')!;
            const existingConfig = { theme_id: 'old-theme', dark_mode: true };

            const result = applyThemeToConfig(existingConfig, theme);

            expect(result.theme_id).toBe('minimalist');
            expect(result.dark_mode).toBe(false);
        });
    });

    describe('applyCSSVariables', () => {
        it('should set CSS variables on element', () => {
            const theme = getThemeById('luxury')!;
            const element = document.createElement('div');

            applyCSSVariables(element, theme);

            expect(element.style.getPropertyValue('--storefront-bg')).toBe('#0c0a09');
            expect(element.style.getPropertyValue('--storefront-primary')).toBe('#d4af37');
            expect(element.style.getPropertyValue('--storefront-font-heading')).toBe('Playfair Display');
            expect(element.style.getPropertyValue('--storefront-font-body')).toBe('Cormorant Garamond');
        });
    });

    describe('loadGoogleFonts', () => {
        afterEach(() => {
            const link = document.getElementById('storefront-theme-fonts');
            if (link) link.remove();
        });

        it('should create a link element with display=swap', () => {
            loadGoogleFonts(['Playfair Display', 'Inter']);

            const link = document.getElementById('storefront-theme-fonts') as HTMLLinkElement;
            expect(link).toBeTruthy();
            expect(link.rel).toBe('stylesheet');
            expect(link.href).toContain('display=swap');
            expect(link.href).toContain('Playfair+Display');
            expect(link.href).toContain('Inter');
        });

        it('should reuse existing link element', () => {
            loadGoogleFonts(['Inter']);
            loadGoogleFonts(['Outfit']);

            const links = document.querySelectorAll('#storefront-theme-fonts');
            expect(links).toHaveLength(1);
            expect((links[0] as HTMLLinkElement).href).toContain('Outfit');
        });

        it('should skip system fonts', () => {
            loadGoogleFonts(['system-ui', 'sans-serif']);

            const link = document.getElementById('storefront-theme-fonts');
            expect(link).toBeNull();
        });

        it('should deduplicate font names', () => {
            loadGoogleFonts(['Inter', 'Inter', 'Outfit']);

            const link = document.getElementById('storefront-theme-fonts') as HTMLLinkElement;
            const interMatches = link.href.match(/family=Inter/g);
            expect(interMatches).toHaveLength(1);
        });
    });
});
