/**
 * StorefrontBuilder Module
 * Barrel export for all builder sub-components and utilities
 */

export { BuilderHeader } from './BuilderHeader';
export { BuilderLeftPanel } from './BuilderLeftPanel';
export { BuilderPreview } from './BuilderPreview';
export { BuilderPropertyEditor } from './BuilderPropertyEditor';
export { BuilderCreateStore } from './BuilderCreateStore';
export { BuilderMobileDrawer } from './BuilderMobileDrawer';

export { SortableSectionItem } from './SortableSectionItem';
export { useStorefrontBuilder } from './useStorefrontBuilder';
export { useBuilderKeyboardShortcuts } from './useBuilderKeyboardShortcuts';
export { useBuilderAutosave } from './useBuilderAutosave';
export { useBuilderLayout } from './useBuilderLayout';
export {
    SECTION_REGISTRY,
    SECTION_CATEGORIES,
    TEMPLATES,
    createSectionDefaults,
    DEFAULT_THEME,
    type StorefrontSection,
    type ThemeConfig,
    type SectionTypeKey,
    type TemplateKey,
    type SectionCategory,
} from './storefront-builder.config';
