/**
 * useEasyModeBuilder Hook
 * State management for Easy Mode storefront configuration
 */

import { useState, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import {
    type PresetPack,
    type FeatureToggles,
    type SimpleContent,
    type EasyModeConfig,
    PRESET_PACKS,
    getPresetById,
    getPresetTheme,
    generateSectionsFromPreset,
    detectAdvancedCustomizations,
    DEFAULT_FEATURE_TOGGLES,
    DEFAULT_SIMPLE_CONTENT,
} from '@/lib/storefrontPresets';
import { type SectionConfig, type ExtendedThemeConfig } from '@/types/marketplace-extended';

interface UseEasyModeBuilderProps {
    initialThemeConfig?: ExtendedThemeConfig | null;
    initialLayoutConfig?: SectionConfig[];
}

interface UseEasyModeBuilderReturn {
    // Preset selection
    selectedPreset: PresetPack | null;
    selectPreset: (presetId: string) => void;
    availablePresets: PresetPack[];

    // Feature toggles
    featureToggles: FeatureToggles;
    updateFeatureToggle: (key: keyof FeatureToggles, value: boolean) => void;
    resetFeatureToggles: () => void;

    // Simple content
    simpleContent: SimpleContent;
    updateSimpleContent: <K extends keyof SimpleContent>(key: K, value: SimpleContent[K]) => void;
    resetSimpleContent: () => void;

    // Derived configs for preview and save
    derivedLayoutConfig: SectionConfig[];
    derivedThemeConfig: ExtendedThemeConfig;

    // Easy mode config (for persistence)
    easyModeConfig: EasyModeConfig;

    // State
    isDirty: boolean;
    hasCustomizations: boolean;
    customizationsList: string[];

    // Actions
    resetToPreset: () => void;
    applyPreset: (presetId: string) => { layoutConfig: SectionConfig[]; themeConfig: ExtendedThemeConfig };
    markClean: () => void;
}

export function useEasyModeBuilder({
    initialThemeConfig,
    initialLayoutConfig = [],
}: UseEasyModeBuilderProps): UseEasyModeBuilderReturn {
    // Initialize from existing easy_mode config or defaults
    const existingEasyMode = initialThemeConfig?.easy_mode;

    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
        existingEasyMode?.preset_id || PRESET_PACKS[0].id
    );

    const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(
        existingEasyMode?.feature_toggles || DEFAULT_FEATURE_TOGGLES
    );

    const [simpleContent, setSimpleContent] = useState<SimpleContent>(
        existingEasyMode?.simple_content || DEFAULT_SIMPLE_CONTENT
    );

    const [customModifications, setCustomModifications] = useState<string[]>(
        existingEasyMode?.custom_modifications ?? []
    );

    const [isDirty, setIsDirty] = useState(false);

    // Get the selected preset object
    const selectedPreset = useMemo(
        () => (selectedPresetId ? getPresetById(selectedPresetId) || null : null),
        [selectedPresetId]
    );

    // Select a preset and apply its defaults
    const selectPreset = useCallback((presetId: string) => {
        const preset = getPresetById(presetId);
        if (!preset) {
            logger.warn('Attempted to select unknown preset', { presetId });
            return;
        }

        logger.debug('Selecting preset', { presetId, presetName: preset.name });

        setSelectedPresetId(presetId);
        setFeatureToggles(preset.featureToggles);
        setSimpleContent(preset.defaultContent);
        setCustomModifications([]);
        setIsDirty(true);
    }, []);

    // Update a single feature toggle
    const updateFeatureToggle = useCallback((key: keyof FeatureToggles, value: boolean) => {
        setFeatureToggles(prev => ({
            ...prev,
            [key]: value,
        }));

        // Track that user modified this toggle
        setCustomModifications(prev => {
            const toggleKey = `toggle:${key}`;
            if (!prev.includes(toggleKey)) {
                return [...prev, toggleKey];
            }
            return prev;
        });

        setIsDirty(true);
    }, []);

    // Reset feature toggles to preset defaults
    const resetFeatureToggles = useCallback(() => {
        if (selectedPreset) {
            setFeatureToggles(selectedPreset.featureToggles);
            setCustomModifications(prev => prev.filter(m => !m.startsWith('toggle:')));
            setIsDirty(true);
        }
    }, [selectedPreset]);

    // Update simple content field
    const updateSimpleContent = useCallback(<K extends keyof SimpleContent>(
        key: K,
        value: SimpleContent[K]
    ) => {
        setSimpleContent(prev => ({
            ...prev,
            [key]: value,
        }));

        // Track that user modified this content field
        setCustomModifications(prev => {
            const contentKey = `content:${key}`;
            if (!prev.includes(contentKey)) {
                return [...prev, contentKey];
            }
            return prev;
        });

        setIsDirty(true);
    }, []);

    // Reset simple content to preset defaults
    const resetSimpleContent = useCallback(() => {
        if (selectedPreset) {
            setSimpleContent(selectedPreset.defaultContent);
            setCustomModifications(prev => prev.filter(m => !m.startsWith('content:')));
            setIsDirty(true);
        }
    }, [selectedPreset]);

    // Reset everything to current preset defaults
    const resetToPreset = useCallback(() => {
        if (selectedPreset) {
            setFeatureToggles(selectedPreset.featureToggles);
            setSimpleContent(selectedPreset.defaultContent);
            setCustomModifications([]);
            setIsDirty(true);
        }
    }, [selectedPreset]);

    // Apply a preset and return the full configs (for mode switching)
    const applyPreset = useCallback((presetId: string): {
        layoutConfig: SectionConfig[];
        themeConfig: ExtendedThemeConfig;
    } => {
        const preset = getPresetById(presetId);
        if (!preset) {
            logger.error('Cannot apply unknown preset', { presetId });
            return { layoutConfig: [], themeConfig: {} };
        }

        const theme = getPresetTheme(preset);
        const sections = generateSectionsFromPreset(preset);

        const themeConfig: ExtendedThemeConfig = {
            theme_id: theme?.id,
            colors: theme ? {
                primary: theme.colors.primary,
                secondary: theme.colors.secondary,
                accent: theme.colors.accent,
                background: theme.colors.background,
                text: theme.colors.foreground,
            } : undefined,
            typography: theme ? {
                fontFamily: theme.typography.fontFamily.split(',')[0].trim(),
            } : undefined,
            easy_mode: {
                enabled: true,
                preset_id: presetId,
                feature_toggles: preset.featureToggles,
                simple_content: preset.defaultContent,
                custom_modifications: [],
                last_preset_applied_at: new Date().toISOString(),
            },
        };

        return {
            layoutConfig: sections,
            themeConfig,
        };
    }, []);

    // Derive layout config from current state
    const derivedLayoutConfig = useMemo((): SectionConfig[] => {
        if (!selectedPreset) {
            return initialLayoutConfig;
        }

        // Generate sections from preset
        const sections = generateSectionsFromPreset(selectedPreset);

        // Apply visibility toggles
        return sections.map(section => {
            let visible = section.visible;

            // Override visibility based on feature toggles
            switch (section.type) {
                case 'hero':
                    visible = featureToggles.showHero;
                    break;
                case 'features':
                    visible = featureToggles.showFeatures;
                    break;
                case 'testimonials':
                    visible = featureToggles.showTestimonials;
                    break;
                case 'newsletter':
                    visible = featureToggles.showNewsletter;
                    break;
                case 'faq':
                    visible = featureToggles.showFAQ;
                    break;
            }

            // Apply content customizations to hero section
            if (section.type === 'hero') {
                const headlineParts = simpleContent.heroHeadline.split(' ');
                return {
                    ...section,
                    visible,
                    content: {
                        ...section.content,
                        heading_line_1: headlineParts[0] || 'Premium',
                        heading_line_2: headlineParts.slice(1, 2).join(' ') || 'Cannabis',
                        heading_line_3: headlineParts.slice(2).join(' ') || 'Delivered',
                        subheading: simpleContent.heroSubheadline,
                        cta_primary_text: simpleContent.heroCtaText,
                        cta_primary_link: simpleContent.heroCtaLink,
                    },
                };
            }

            // Apply search/category toggles to product grid
            if (section.type === 'product_grid') {
                return {
                    ...section,
                    visible,
                    content: {
                        ...section.content,
                        show_search: featureToggles.enableSearch,
                        show_categories: featureToggles.showCategories,
                        show_premium_filter: featureToggles.showPremiumFilter,
                    },
                };
            }

            return { ...section, visible };
        });
    }, [selectedPreset, featureToggles, simpleContent, initialLayoutConfig]);

    // Derive theme config from current state
    const derivedThemeConfig = useMemo((): ExtendedThemeConfig => {
        const theme = selectedPreset ? getPresetTheme(selectedPreset) : null;

        return {
            theme_id: theme?.id ?? initialThemeConfig?.theme_id,
            colors: theme ? {
                primary: theme.colors.primary,
                secondary: theme.colors.secondary,
                accent: theme.colors.accent,
                background: theme.colors.background,
                text: theme.colors.foreground,
            } : initialThemeConfig?.colors,
            typography: theme ? {
                fontFamily: theme.typography.fontFamily.split(',')[0].trim(),
            } : initialThemeConfig?.typography,
            easy_mode: {
                enabled: true,
                preset_id: selectedPresetId,
                feature_toggles: featureToggles,
                simple_content: simpleContent,
                custom_modifications: customModifications,
                last_preset_applied_at: new Date().toISOString(),
            },
        };
    }, [
        selectedPreset,
        selectedPresetId,
        featureToggles,
        simpleContent,
        customModifications,
        initialThemeConfig,
    ]);

    // Build the easy mode config for persistence
    const easyModeConfig = useMemo((): EasyModeConfig => ({
        enabled: true,
        preset_id: selectedPresetId,
        feature_toggles: featureToggles,
        simple_content: simpleContent,
        custom_modifications: customModifications,
        last_preset_applied_at: new Date().toISOString(),
    }), [selectedPresetId, featureToggles, simpleContent, customModifications]);

    // Detect if current layout has advanced customizations
    const { hasCustomizations, customizations: customizationsList } = useMemo(
        () => detectAdvancedCustomizations(initialLayoutConfig),
        [initialLayoutConfig]
    );

    // Mark state as clean (after save)
    const markClean = useCallback(() => {
        setIsDirty(false);
    }, []);

    return {
        // Preset selection
        selectedPreset,
        selectPreset,
        availablePresets: PRESET_PACKS,

        // Feature toggles
        featureToggles,
        updateFeatureToggle,
        resetFeatureToggles,

        // Simple content
        simpleContent,
        updateSimpleContent,
        resetSimpleContent,

        // Derived configs
        derivedLayoutConfig,
        derivedThemeConfig,

        // Easy mode config
        easyModeConfig,

        // State
        isDirty,
        hasCustomizations,
        customizationsList,

        // Actions
        resetToPreset,
        applyPreset,
        markClean,
    };
}
