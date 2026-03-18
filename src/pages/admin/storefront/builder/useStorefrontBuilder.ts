/**
 * useStorefrontBuilder Hook
 * Encapsulates all state management, mutations, and actions for the StorefrontBuilder
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { toast } from 'sonner';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';
import { logger } from '@/lib/logger';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { type ThemePreset } from '@/lib/storefrontThemes';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { useDebounce } from '@/hooks/useDebounce';
import {
    type SectionConfig,
    type ThemeConfig,
    type TemplateKey,
    TEMPLATES,
    sectionDefaults,
    DEFAULT_THEME,
} from './storefront-builder.config';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function useStorefrontBuilder() {
    const { tenant } = useTenantAdminAuth();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

    // Credit gated action hook for store creation
    const {
        execute: executeCreditAction,
        showOutOfCreditsModal,
        closeOutOfCreditsModal,
        blockedAction,
        isExecuting: isCreatingWithCredits,
    } = useCreditGatedAction();

    // URL params for menu → storefront conversion
    const fromMenuId = searchParams.get('from_menu');
    const menuName = searchParams.get('menu_name');

    // Log if this is a menu → storefront conversion
    useEffect(() => {
        if (fromMenuId) {
            logger.info('StorefrontBuilder opened from menu', { menuId: fromMenuId, menuName });
            toast.info('Creating Storefront from Menu', {
                description: `Starting with products from "${menuName ?? 'your menu'}"`,
            });
        }
    }, [fromMenuId, menuName]);

    // UI State
    const [activeTab, setActiveTab] = useState('sections');
    const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [previewZoom, setPreviewZoom] = useState(0.85);

    // Store Creation Dialog State
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreSlug, setNewStoreSlug] = useState('');
    const [slugError, setSlugError] = useState<string | null>(null);
    const [isValidatingSlug, setIsValidatingSlug] = useState(false);
    const [slugAvailable, setSlugAvailable] = useState(false);

    // Debounced slug for async validation
    const debouncedStoreSlug = useDebounce(newStoreSlug, 400);

    // Delete Confirmation Dialog State
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

    // Dirty tracking
    const [isDirty, setIsDirty] = useState(false);

    // Builder State
    const [layoutConfig, setLayoutConfig] = useState<SectionConfig[]>([]);
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(DEFAULT_THEME);
    const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(undefined);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // History for undo/redo
    const [history, setHistory] = useState<SectionConfig[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Handle theme selection
    const handleThemeSelect = useCallback((theme: ThemePreset) => {
        logger.debug('Applying theme preset', { themeId: theme.id });
        setSelectedThemeId(theme.id);
        setThemeConfig(prevConfig => ({
            ...prevConfig,
            colors: {
                primary: theme.colors.primary,
                secondary: theme.colors.secondary,
                accent: theme.colors.accent,
                background: theme.colors.background,
                text: theme.colors.foreground,
            },
            typography: {
                fontFamily: theme.typography.fontFamily.split(',')[0].trim(),
            }
        }));
        setIsDirty(true);
        toast.success('Theme Applied', {
            description: `${theme.name} theme has been applied to your storefront`,
        });
    }, []);

    // Sync layout_config and theme_config to marketplace_profiles so the
    // public shop RPC (get_marketplace_store_by_slug) returns fresh data.
    // The RPC reads from marketplace_profiles, not marketplace_stores.
    const syncToMarketplaceProfiles = async (
        layoutCfg: SectionConfig[],
        themeCfg: ThemeConfig,
    ) => {
        try {
            const { error } = await supabase
                .from('marketplace_profiles')
                .update({
                    layout_config: JSON.parse(JSON.stringify(layoutCfg)),
                    theme_config: themeCfg,
                })
                .eq('tenant_id', tenant?.id ?? '');
            if (error) {
                logger.warn('Failed to sync config to marketplace_profiles', error);
            }
        } catch (e) {
            logger.warn('marketplace_profiles sync error', e);
        }
    };

    // Fetch Store Config
    const { data: store, isLoading } = useQuery({
        queryKey: queryKeys.marketplaceSettings.byTenant(tenant?.id),
        queryFn: async (): Promise<MarketplaceStore | null> => {
            const { data, error } = await supabase
                .from('marketplace_stores')
                .select('id, tenant_id, store_name, slug, tagline, description, logo_url, banner_url, primary_color, secondary_color, accent_color, font_family, is_active, is_public, layout_config, theme_config, operating_hours, checkout_settings, created_at, updated_at')
                .eq('tenant_id', tenant?.id ?? '')
                .maybeSingle();

            if (error) throw error;
            return data as MarketplaceStore | null;
        },
        enabled: !!tenant?.id,
        retry: 2,
    });

    // Hydrate state from DB
    useEffect(() => {
        if (store) {
            const rawConfig = store.layout_config;
            const config: SectionConfig[] = Array.isArray(rawConfig) ? rawConfig : [];
            setLayoutConfig(config);
            if (store.theme_config) setThemeConfig(store.theme_config as ThemeConfig);
            setHistory([config]);
            setHistoryIndex(0);
        }
    }, [store]);

    // Save to history
    const saveToHistory = useCallback((newConfig: SectionConfig[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newConfig);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // Undo
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setLayoutConfig(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    // Redo
    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setLayoutConfig(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    // Debounced slug uniqueness validation
    useEffect(() => {
        if (!debouncedStoreSlug) {
            setSlugError(null);
            setSlugAvailable(false);
            return;
        }

        if (debouncedStoreSlug.length < 3) {
            setSlugError('Slug must be at least 3 characters');
            setSlugAvailable(false);
            return;
        }

        if (!SLUG_REGEX.test(debouncedStoreSlug)) {
            setSlugError('Only lowercase letters, numbers, and hyphens allowed');
            setSlugAvailable(false);
            return;
        }

        let cancelled = false;
        setIsValidatingSlug(true);

        (async () => {
            try {
                const { data, error } = await supabase
                    .from('marketplace_stores')
                    .select('id')
                    .eq('slug', debouncedStoreSlug)
                    .maybeSingle();

                if (cancelled) return;
                if (error) throw error;

                if (data) {
                    setSlugError('This slug is already taken');
                    setSlugAvailable(false);
                } else {
                    setSlugError(null);
                    setSlugAvailable(true);
                }
            } catch (err) {
                if (cancelled) return;
                logger.error('Failed to validate slug', err);
                setSlugError('Failed to check availability');
                setSlugAvailable(false);
            } finally {
                if (!cancelled) setIsValidatingSlug(false);
            }
        })();

        return () => { cancelled = true; };
    }, [debouncedStoreSlug]);

    // Auto-generate slug from store name
    const generateSlug = useCallback((name: string): string => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }, []);

    // Whether slug is still being checked (debounce in-flight or validation pending)
    const isSlugChecking = isValidatingSlug || (newStoreSlug !== debouncedStoreSlug && newStoreSlug.length >= 3);

    // Create store mutation (deducts 500 credits)
    const createStoreMutation = useMutation({
        mutationFn: async (data: { storeName: string; slug: string }) => {
            if (!tenant?.id) throw new Error('No tenant context available');

            const trimmedName = data.storeName.trim();
            if (!trimmedName) throw new Error('Store name is required');

            const { data: newStore, error } = await supabase
                .from('marketplace_stores')
                .insert({
                    tenant_id: tenant.id,
                    store_name: trimmedName,
                    slug: data.slug,
                    layout_config: [],
                    theme_config: themeConfig as unknown as Record<string, unknown>,
                    is_active: true,
                    is_public: false,
                    require_age_verification: false,
                    minimum_age: 21,
                    payment_methods: ['cash', 'card'],
                    delivery_zones: [],
                    default_delivery_fee: 0,
                    checkout_settings: {},
                    operating_hours: {},
                })
                .select()
                .maybeSingle();

            if (error) throw error;
            return newStore;
        },
        onSuccess: (newStore: unknown) => {
            const storeData = newStore as { store_name: string } | null;
            toast.success('Store created!', {
                description: `Your storefront "${storeData?.store_name ?? 'New Store'}" has been created. 500 credits have been deducted.`,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
            setShowCreateDialog(false);
            setNewStoreName('');
            setNewStoreSlug('');
            setSlugAvailable(false);
        },
        onError: (err) => {
            toast.error('Creation failed', { description: humanizeError(err) });
            logger.error('Failed to create storefront', err);
        }
    });

    // Handle store creation with credit deduction
    const handleCreateStore = async () => {
        if (!newStoreName.trim()) {
            toast.error('Store name is required');
            return;
        }

        if (slugError || isSlugChecking || !slugAvailable) return;

        await executeCreditAction({
            actionKey: 'storefront_create',
            action: async () => {
                return createStoreMutation.mutateAsync({
                    storeName: newStoreName,
                    slug: newStoreSlug,
                });
            },
            onSuccess: () => {
                logger.info('Storefront created successfully', { slug: newStoreSlug });
            },
            onError: (err) => {
                logger.error('Storefront creation failed', err);
            },
        });
    };

    // Save draft mutation
    const saveDraftMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id) throw new Error('No tenant context available');

            const configPayload = JSON.parse(JSON.stringify(layoutConfig));
            const colors = themeConfig.colors;

            const updatePayload: Record<string, unknown> = {
                layout_config: configPayload,
                theme_config: themeConfig as unknown as Record<string, unknown>,
                updated_at: new Date().toISOString(),
            };

            // Sync top-level color columns so the shop shell reflects builder changes
            if (colors?.primary) updatePayload.primary_color = colors.primary;
            if (colors?.secondary) updatePayload.secondary_color = colors.secondary;
            if (colors?.accent) updatePayload.accent_color = colors.accent;

            const { error } = await supabase
                .from('marketplace_stores')
                .update(updatePayload)
                .eq('tenant_id', tenant.id);

            if (error) throw error;

            // Sync to marketplace_profiles so live store RPC picks up changes
            await syncToMarketplaceProfiles(layoutConfig, themeConfig);
        },
        onSuccess: () => {
            toast.success('Draft saved', { description: 'Your changes have been saved as a draft.' });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
            setIsDirty(false);
        },
        onError: (err) => {
            toast.error('Save failed', { description: humanizeError(err) });
            logger.error('Failed to save draft', err);
        }
    });

    // Publish mutation
    const publishMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id) throw new Error('No tenant context available');

            const configPayload = JSON.parse(JSON.stringify(layoutConfig));
            const colors = themeConfig.colors;

            const updatePayload: Record<string, unknown> = {
                layout_config: configPayload,
                theme_config: themeConfig as unknown as Record<string, unknown>,
                is_public: true,
                updated_at: new Date().toISOString(),
            };

            // Sync top-level color columns so the shop shell reflects builder changes
            if (colors?.primary) updatePayload.primary_color = colors.primary;
            if (colors?.secondary) updatePayload.secondary_color = colors.secondary;
            if (colors?.accent) updatePayload.accent_color = colors.accent;

            const { error } = await supabase
                .from('marketplace_stores')
                .update(updatePayload)
                .eq('tenant_id', tenant.id);

            if (error) throw error;

            // Sync to marketplace_profiles so live store RPC picks up changes
            await syncToMarketplaceProfiles(layoutConfig, themeConfig);
        },
        onSuccess: () => {
            toast.success('Store published!', { description: 'Your storefront is now live and visible to customers.' });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
            setIsDirty(false);
        },
        onError: (err) => {
            toast.error('Publish failed', { description: humanizeError(err) });
            logger.error('Failed to publish storefront', err);
        }
    });

    // Unpublish mutation
    const unpublishMutation = useMutation({
        mutationFn: async () => {
            if (!tenant?.id) throw new Error('No tenant context available');

            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    is_public: false,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('Store unpublished', { description: 'Your storefront is now in draft mode.' });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
        },
        onError: (err) => {
            toast.error('Unpublish failed', { description: humanizeError(err) });
            logger.error('Failed to unpublish storefront', err);
        }
    });

    // Section actions
    const addSection = (type: string) => {
        const newSection: SectionConfig = {
            id: crypto.randomUUID(),
            type,
            content: { ...sectionDefaults(type).content },
            styles: { ...sectionDefaults(type).styles },
            visible: true
        };
        const newConfig = [...layoutConfig, newSection];
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        setSelectedSectionId(newSection.id);
        setIsDirty(true);
    };

    const requestRemoveSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSectionToDelete(id);
    };

    const confirmRemoveSection = () => {
        if (!sectionToDelete) return;
        const newConfig = layoutConfig.filter(s => s.id !== sectionToDelete);
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        if (selectedSectionId === sectionToDelete) setSelectedSectionId(null);
        setSectionToDelete(null);
        setIsDirty(true);
        toast.success('Section deleted');
    };

    const cancelRemoveSection = () => {
        setSectionToDelete(null);
    };

    const duplicateSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const sectionToDuplicate = layoutConfig.find(s => s.id === id);
        if (!sectionToDuplicate) return;

        const duplicated: SectionConfig = {
            ...sectionToDuplicate,
            id: crypto.randomUUID(),
            content: { ...sectionToDuplicate.content },
            styles: { ...sectionToDuplicate.styles }
        };

        const index = layoutConfig.findIndex(s => s.id === id);
        const newConfig = [...layoutConfig.slice(0, index + 1), duplicated, ...layoutConfig.slice(index + 1)];
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        setSelectedSectionId(duplicated.id);
        setIsDirty(true);
        toast.success('Section duplicated');
    };

    const toggleVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newConfig = layoutConfig.map(s =>
            s.id === id ? { ...s, visible: !(s.visible ?? true) } : s
        );
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        setIsDirty(true);
    };

    const updateSection = (id: string, field: 'content' | 'styles', key: string, value: unknown) => {
        const newConfig = layoutConfig.map(s => {
            if (s.id !== id) return s;
            return {
                ...s,
                [field]: { ...s[field], [key]: value }
            };
        });
        setLayoutConfig(newConfig);
        setIsDirty(true);
    };

    const applyTemplate = (templateKey: TemplateKey) => {
        const template = TEMPLATES[templateKey];
        const newSections: SectionConfig[] = template.sections.map(type => ({
            id: crypto.randomUUID(),
            type,
            content: { ...sectionDefaults(type).content },
            styles: { ...sectionDefaults(type).styles },
            visible: true
        }));
        setLayoutConfig(newSections);
        saveToHistory(newSections);
        setIsDirty(true);
        toast.success(`Applied "${template.name}" template`);
    };

    const handleSelectSection = (id: string) => {
        setSelectedSectionId(id);
        if (!rightPanelOpen) setRightPanelOpen(true);
    };

    const selectedSection = layoutConfig.find(s => s.id === selectedSectionId);

    return {
        // Store data
        store,
        isLoading,

        // UI state
        activeTab,
        setActiveTab,
        devicePreview,
        setDevicePreview,
        rightPanelOpen,
        setRightPanelOpen,
        previewZoom,
        setPreviewZoom,

        // Builder state
        layoutConfig,
        setLayoutConfig,
        themeConfig,
        setThemeConfig,
        selectedThemeId,
        selectedSectionId,
        selectedSection,
        isDirty,

        // History
        historyIndex,
        history,
        undo,
        redo,
        saveToHistory,

        // Theme
        handleThemeSelect,

        // Store creation
        showCreateDialog,
        setShowCreateDialog,
        newStoreName,
        setNewStoreName,
        newStoreSlug,
        setNewStoreSlug,
        slugError,
        setSlugError,
        slugAvailable,
        setSlugAvailable,
        isValidatingSlug,
        isSlugChecking,
        generateSlug,
        handleCreateStore,
        createStoreMutation,
        isCreatingWithCredits,

        // Credits
        showOutOfCreditsModal,
        closeOutOfCreditsModal,
        blockedAction,

        // Section actions
        addSection,
        requestRemoveSection,
        confirmRemoveSection,
        cancelRemoveSection,
        duplicateSection,
        toggleVisibility,
        updateSection,
        applyTemplate,
        handleSelectSection,
        sectionToDelete,
        setIsDirty,

        // Mutations
        saveDraftMutation,
        publishMutation,
        unpublishMutation,
    };
}
