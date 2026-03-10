import { describe, it, expect } from 'vitest';
import {
    PRESET_PACKS,
    getPresetById,
    getPresetTheme,
    generateSectionsFromPreset,
    TEMPLATE_SECTIONS,
} from '../storefrontPresets';
import { THEME_PRESETS } from '../storefrontThemes';

describe('storefrontPresets', () => {
    describe('PRESET_PACKS', () => {
        it('should have exactly 6 preset packs', () => {
            expect(PRESET_PACKS).toHaveLength(6);
        });

        it('should have all required preset IDs', () => {
            const ids = PRESET_PACKS.map((p) => p.id);
            expect(ids).toContain('quick-dark');
            expect(ids).toContain('quick-light');
            expect(ids).toContain('pro-standard');
            expect(ids).toContain('pro-nature');
            expect(ids).toContain('luxury-full');
            expect(ids).toContain('landing-focus');
        });

        it('every preset should reference a valid theme', () => {
            const themeIds = THEME_PRESETS.map((t) => t.id);
            for (const preset of PRESET_PACKS) {
                expect(themeIds).toContain(preset.themeId);
            }
        });

        it('every preset should reference a valid template', () => {
            const validTemplates = Object.keys(TEMPLATE_SECTIONS);
            for (const preset of PRESET_PACKS) {
                expect(validTemplates).toContain(preset.templateId);
            }
        });
    });

    describe('getPresetById', () => {
        it('should return preset for valid ID', () => {
            const preset = getPresetById('pro-standard');
            expect(preset).toBeDefined();
            expect(preset?.name).toBe('Professional');
        });

        it('should return undefined for invalid ID', () => {
            const preset = getPresetById('does-not-exist');
            expect(preset).toBeUndefined();
        });
    });

    describe('getPresetTheme', () => {
        it('should return the linked theme for a preset', () => {
            const preset = getPresetById('luxury-full')!;
            const theme = getPresetTheme(preset);
            expect(theme).toBeDefined();
            expect(theme?.id).toBe('luxury');
            expect(theme?.darkMode).toBe(true);
        });
    });

    describe('generateSectionsFromPreset', () => {
        it('should generate sections matching template section count', () => {
            for (const preset of PRESET_PACKS) {
                const sections = generateSectionsFromPreset(preset);
                const expectedCount = TEMPLATE_SECTIONS[preset.templateId].length;
                expect(sections).toHaveLength(expectedCount);
            }
        });

        it('should include hero as first section for all presets', () => {
            for (const preset of PRESET_PACKS) {
                const sections = generateSectionsFromPreset(preset);
                expect(sections[0].type).toBe('hero');
            }
        });

        it('should set hero_variant for Professional preset', () => {
            const preset = getPresetById('pro-standard')!;
            const sections = generateSectionsFromPreset(preset);
            const hero = sections[0];
            expect(hero.content.hero_variant).toBe('split-features');
            expect(hero.content.hero_features).toBeDefined();
            expect(Array.isArray(hero.content.hero_features)).toBe(true);
        });

        it('should set hero_variant for Nature Focused preset', () => {
            const preset = getPresetById('pro-nature')!;
            const sections = generateSectionsFromPreset(preset);
            const hero = sections[0];
            expect(hero.content.hero_variant).toBe('split-features');
            expect(hero.content.label).toBe('FARM TO TABLE');
        });

        it('should set hero_variant for Luxury preset', () => {
            const preset = getPresetById('luxury-full')!;
            const sections = generateSectionsFromPreset(preset);
            const hero = sections[0];
            expect(hero.content.hero_variant).toBe('luxury-centered');
            expect(hero.content.label).toBe('CURATED COLLECTION');
        });

        it('should set hero_variant for Landing Page preset', () => {
            const preset = getPresetById('landing-focus')!;
            const sections = generateSectionsFromPreset(preset);
            const hero = sections[0];
            expect(hero.content.hero_variant).toBe('split-gallery');
            expect(hero.content.countdown).toBeDefined();
        });

        it('should set centered hero for Quick Launch presets', () => {
            for (const id of ['quick-dark', 'quick-light']) {
                const preset = getPresetById(id)!;
                const sections = generateSectionsFromPreset(preset);
                const hero = sections[0];
                expect(hero.content.hero_variant).toBe('centered');
            }
        });

        it('should generate unique section IDs', () => {
            const preset = getPresetById('luxury-full')!;
            const sections = generateSectionsFromPreset(preset);
            const ids = sections.map((s) => s.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });

        it('should include hero styles with gradient and card colors', () => {
            const preset = getPresetById('pro-standard')!;
            const sections = generateSectionsFromPreset(preset);
            const hero = sections[0];
            expect(hero.styles.background_gradient_start).toBeDefined();
            expect(hero.styles.background_gradient_end).toBeDefined();
            expect(hero.styles.text_color).toBeDefined();
            expect(hero.styles.card_bg).toBeDefined();
            expect(hero.styles.card_text).toBeDefined();
        });

        it('should set visibility based on feature toggles', () => {
            // Luxury has showTestimonials: true
            const luxury = getPresetById('luxury-full')!;
            const luxurySections = generateSectionsFromPreset(luxury);
            const testimonials = luxurySections.find((s) => s.type === 'testimonials');
            expect(testimonials?.visible).toBe(true);

            // Quick Launch has showTestimonials: false (no testimonials section at all since it's minimal template)
            const quick = getPresetById('quick-dark')!;
            const quickSections = generateSectionsFromPreset(quick);
            const quickTestimonials = quickSections.find((s) => s.type === 'testimonials');
            expect(quickTestimonials).toBeUndefined(); // minimal template doesn't include it
        });
    });
});
