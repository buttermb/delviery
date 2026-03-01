/**
 * StorefrontBuilder - Orchestrator Component
 * Dual-mode builder: Simple (Easy Mode) and Advanced (Full Builder)
 *
 * Simple Mode: Preset packs, feature toggles, basic content editing
 * Advanced Mode: Full drag-and-drop, custom sections, responsive settings
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MarketplaceStore, type SectionConfig, type ExtendedThemeConfig } from '@/types/marketplace-extended';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    GripVertical, Trash2, ArrowLeft, Layout,
    Monitor, Smartphone, Tablet, Copy, Eye, EyeOff, Undo2, Redo2,
    Image, MessageSquare, HelpCircle, Mail, Sparkles, X, ZoomIn, ZoomOut,
    Code, Globe, GlobeLock, AlertCircle, Settings2, Wand2, Loader2, Store, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { EasyModeEditor } from '@/components/admin/storefront/EasyModeEditor';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { NewsletterSection } from '@/components/shop/sections/NewsletterSection';
import { GallerySection } from '@/components/shop/sections/GallerySection';
import { FAQSection } from '@/components/shop/sections/FAQSection';
import { CustomHTMLSection } from '@/components/shop/sections/CustomHTMLSection';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ThemePresetStrip, ThemePresetGrid } from '@/components/admin/storefront/ThemePresetSelector';
import { type ThemePreset } from '@/lib/storefrontThemes';
import { useEasyModeBuilder } from '@/hooks/useEasyModeBuilder';
import { detectAdvancedCustomizations } from '@/lib/storefrontPresets';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { SectionEditor } from '@/components/admin/storefront/SectionEditors';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { useDebounce } from '@/hooks/useDebounce';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Define available section types (8 total)
const SECTION_TYPES = {
    hero: { label: 'Hero Section', icon: Layout, component: HeroSection },
    features: { label: 'Features Grid', icon: Sparkles, component: FeaturesSection },
    product_grid: { label: 'Product Grid', icon: Layout, component: ProductGridSection },
    testimonials: { label: 'Testimonials', icon: MessageSquare, component: TestimonialsSection },
    newsletter: { label: 'Newsletter', icon: Mail, component: NewsletterSection },
    gallery: { label: 'Gallery', icon: Image, component: GallerySection },
    faq: { label: 'FAQ', icon: HelpCircle, component: FAQSection },
    custom_html: { label: 'Custom HTML', icon: Code, component: CustomHTMLSection },
};

// Templates for quick setup
const TEMPLATES = {
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

// Sortable section item component
function SortableSectionItem({
    section,
    isSelected,
    onSelect,
    onRemove,
    onDuplicate,
    onToggleVisibility,
    sectionLabel
}: {
    section: SectionConfig;
    isSelected: boolean;
    onSelect: () => void;
    onRemove: (e: React.MouseEvent) => void;
    onDuplicate: (e: React.MouseEvent) => void;
    onToggleVisibility: (e: React.MouseEvent) => void;
    sectionLabel: string;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: section.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isHidden = section.visible === false;

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            data-testid={`builder-section-${section.type}`}
            data-section-type={section.type}
            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                } ${isHidden ? 'opacity-50' : ''}`}
        >
            <div className="flex items-center gap-3">
                <button
                    {...attributes}
                    {...listeners}
                    className="touch-none cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-medium">{sectionLabel}</span>
                {isHidden && <EyeOff className="w-3 h-3 text-muted-foreground" />}
            </div>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={onToggleVisibility}
                    aria-label={isHidden ? "Show section" : "Hide section"}
                >
                    {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={onDuplicate}
                    aria-label="Duplicate section"
                >
                    <Copy className="w-3 h-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                    aria-label="Remove section"
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}

interface StorefrontBuilderProps {
    isFullScreen?: boolean;
    onRequestClose?: () => void;
    onDirtyChange?: (isDirty: boolean) => void;
}

export function StorefrontBuilder({
    isFullScreen = false,
    onRequestClose,
    onDirtyChange,
}: StorefrontBuilderProps) {
    const { tenant } = useTenantAdminAuth();
    const { navigateToAdmin } = useTenantNavigation();
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

    const [activeTab, setActiveTab] = useState('sections');
    const [builderMode, setBuilderMode] = useState<'simple' | 'advanced'>('simple');
    const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [previewZoom, setPreviewZoom] = useState(0.85);

    // Mode switch warning dialog
    const [, setShowModeSwitchWarning] = useState(false);
    const [, setPendingModeSwitch] = useState<'simple' | 'advanced' | null>(null);
    const [, setAdvancedCustomizations] = useState<string[]>([]);

    // Store Creation Dialog State
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreSlug, setNewStoreSlug] = useState('');
    const [slugError, setSlugError] = useState<string | null>(null);
    const [isValidatingSlug, setIsValidatingSlug] = useState(false);
    const [slugAvailable, setSlugAvailable] = useState(false);

    const debouncedStoreSlug = useDebounce(newStoreSlug, 400);

    // Delete Confirmation Dialog State
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

    // Advanced mode dirty tracking
    const [advancedIsDirty, setAdvancedIsDirty] = useState(false);

    // Builder State
    const [layoutConfig, setLayoutConfig] = useState<SectionConfig[]>([]);
    const [themeConfig, setThemeConfig] = useState<ExtendedThemeConfig>({
        colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
        typography: { fontFamily: 'Inter' }
    });
    const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(undefined);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // Handle theme selection (for advanced mode)
    const handleThemeSelect = useCallback((theme: ThemePreset) => {
        logger.debug('Applying theme preset', { themeId: theme.id });
        setSelectedThemeId(theme.id);
        setThemeConfig(prevConfig => ({
            ...prevConfig,
            theme_id: theme.id,
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
        setAdvancedIsDirty(true);
        toast.success('Theme Applied', {
            description: `${theme.name} theme has been applied to your storefront`,
        });
    }, []);

    // History for undo/redo
    const [history, setHistory] = useState<SectionConfig[][]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Fetch Store Config
    const { data: store, isLoading: isLoadingStore } = useQuery({
        queryKey: queryKeys.marketplaceSettings.byTenant(tenant?.id),
        queryFn: async (): Promise<MarketplaceStore | null> => {
            const { data, error } = await supabase
                .from('marketplace_stores')
                .select('*')
                .eq('tenant_id', tenant?.id ?? '')
                .maybeSingle();

            if (error) throw error;
            return data as MarketplaceStore | null;
        },
        enabled: !!tenant?.id,
    });

    // Easy Mode Builder Hook
    const easyModeBuilder = useEasyModeBuilder({
        initialThemeConfig: store?.theme_config as ExtendedThemeConfig | undefined,
        initialLayoutConfig: layoutConfig,
    });

    // Hydrate state from DB
    useEffect(() => {
        if (store) {
            const rawConfig = store.layout_config;
            const config: SectionConfig[] = Array.isArray(rawConfig) ? rawConfig : [];
            setLayoutConfig(config);
            if (store.theme_config) {
                const savedTheme = store.theme_config as ExtendedThemeConfig;
                setThemeConfig(savedTheme);
                if (savedTheme.theme_id) {
                    setSelectedThemeId(savedTheme.theme_id);
                }
            }

            // Initialize history
            setHistory([config]);
            setHistoryIndex(0);

            // Determine initial mode based on existing config
            const hasEasyMode = (store.theme_config as ExtendedThemeConfig)?.easy_mode?.enabled;
            const { hasCustomizations } = detectAdvancedCustomizations(config);

            if (hasEasyMode && !hasCustomizations) {
                setBuilderMode('simple');
            } else if (config.length > 0) {
                // Has existing config but not easy mode - probably was built in advanced
                setBuilderMode('advanced');
            }
        }
    }, [store]);

    // Handle mode switch with warning check
    const handleModeSwitch = useCallback((targetMode: 'simple' | 'advanced') => {
        if (targetMode === builderMode) return;

        if (targetMode === 'simple') {
            // Switching from advanced to simple - check for customizations
            const { hasCustomizations, customizations } = detectAdvancedCustomizations(layoutConfig);

            if (hasCustomizations) {
                setAdvancedCustomizations(customizations);
                setPendingModeSwitch('simple');
                setShowModeSwitchWarning(true);
                return;
            }
        }

        // Safe to switch
        if (targetMode === 'advanced') {
            // Convert easy mode config to full layout config
            if (easyModeBuilder.selectedPreset) {
                const sections = easyModeBuilder.derivedLayoutConfig;
                setLayoutConfig(sections);
                setThemeConfig(easyModeBuilder.derivedThemeConfig);
                saveToHistory(sections);
            }
            toast.success('Advanced Mode', {
                description: 'You now have full control over all sections and styles.',
            });
        }

        setBuilderMode(targetMode);
    }, [builderMode, layoutConfig, easyModeBuilder]);

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
                    theme_config: themeConfig,
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
            const storeData = newStore as { store_name: string };
            toast.success('Store created!', {
                description: `Your storefront "${storeData.store_name}" has been created. 500 credits have been deducted.`,
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
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

    const isSlugChecking = isValidatingSlug || (newStoreSlug !== debouncedStoreSlug && newStoreSlug.length >= 3);

    // Handle store creation with credit deduction
    const handleCreateStore = async () => {
        if (!newStoreName.trim()) {
            toast.error('Store name is required');
            return;
        }

        if (slugError || isSlugChecking || !slugAvailable) return;

        const isValid = await validateSlug(newStoreSlug);
        if (!isValid) return;

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

    // Get the config to save (from easy mode or direct state)
    const getConfigToSave = useCallback(() => {
        if (builderMode === 'simple') {
            return {
                layoutConfig: easyModeBuilder.derivedLayoutConfig,
                themeConfig: easyModeBuilder.derivedThemeConfig,
            };
        }
        return { layoutConfig, themeConfig };
    }, [builderMode, easyModeBuilder, layoutConfig, themeConfig]);

    // Sync layout_config and theme_config to marketplace_profiles so the
    // public shop RPC (get_marketplace_store_by_slug) returns fresh data.
    const syncToMarketplaceProfiles = async (
        layoutCfg: SectionConfig[],
        themeCfg: ExtendedThemeConfig,
    ) => {
        try {
            const { error } = await (supabase as unknown as { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } } })
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

    // Save draft mutation
    const saveDraftMutation = useMutation({
        mutationFn: async () => {
            const { layoutConfig: configToSave, themeConfig: themeToSave } = getConfigToSave();
            const colors = (themeToSave as ExtendedThemeConfig)?.colors;

            const updatePayload: Record<string, unknown> = {
                layout_config: JSON.parse(JSON.stringify(configToSave)),
                theme_config: themeToSave,
                updated_at: new Date().toISOString(),
            };

            // Sync top-level color columns so the shop shell (header/footer) reflects builder changes
            if (colors?.primary) updatePayload.primary_color = colors.primary;
            if (colors?.secondary) updatePayload.secondary_color = colors.secondary;
            if (colors?.accent) updatePayload.accent_color = colors.accent;

            const { error } = await (supabase as unknown as { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } } })
                .from('marketplace_stores')
                .update(updatePayload)
                .eq('tenant_id', tenant?.id ?? '');

            if (error) throw error;

            // Sync to marketplace_profiles so live store RPC picks up changes
            await syncToMarketplaceProfiles(configToSave, themeToSave as ExtendedThemeConfig);
        },
        onSuccess: () => {
            toast.success('Draft saved', { description: 'Your changes have been saved as a draft.' });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
            easyModeBuilder.markClean();
            setAdvancedIsDirty(false);
        },
        onError: (err) => {
            toast.error('Save failed', { description: humanizeError(err) });
            logger.error('Failed to save draft', err);
        }
    });

    // Publish mutation
    const publishMutation = useMutation({
        mutationFn: async () => {
            const { layoutConfig: configToSave, themeConfig: themeToSave } = getConfigToSave();
            const colors = (themeToSave as ExtendedThemeConfig)?.colors;

            const updatePayload: Record<string, unknown> = {
                layout_config: JSON.parse(JSON.stringify(configToSave)),
                theme_config: themeToSave,
                is_public: true,
                updated_at: new Date().toISOString(),
            };

            // Sync top-level color columns so the shop shell (header/footer) reflects builder changes
            if (colors?.primary) updatePayload.primary_color = colors.primary;
            if (colors?.secondary) updatePayload.secondary_color = colors.secondary;
            if (colors?.accent) updatePayload.accent_color = colors.accent;

            const { error } = await (supabase as unknown as { from: (t: string) => { update: (d: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } } })
                .from('marketplace_stores')
                .update(updatePayload)
                .eq('tenant_id', tenant?.id ?? '');

            if (error) throw error;

            // Sync to marketplace_profiles so live store RPC picks up changes
            await syncToMarketplaceProfiles(configToSave, themeToSave as ExtendedThemeConfig);
        },
        onSuccess: () => {
            toast.success('Store published!', { description: 'Your storefront is now live and visible to customers.' });
            queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceSettings.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.shopStore.all });
            easyModeBuilder.markClean();
            setAdvancedIsDirty(false);
        },
        onError: (err) => {
            toast.error('Publish failed', { description: humanizeError(err) });
            logger.error('Failed to publish storefront', err);
        }
    });

    const addSection = (type: keyof typeof SECTION_TYPES) => {
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
        setAdvancedIsDirty(true);
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
        setAdvancedIsDirty(true);
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
        setAdvancedIsDirty(true);
        toast.success('Section duplicated');
    };

    const toggleVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newConfig = layoutConfig.map(s =>
            s.id === id ? { ...s, visible: !(s.visible ?? true) } : s
        );
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        setAdvancedIsDirty(true);
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
        setAdvancedIsDirty(true);
    };

    const updateSectionResponsive = (id: string, device: 'mobile' | 'tablet' | 'desktop', key: string, value: unknown) => {
        const newConfig = layoutConfig.map(s => {
            if (s.id !== id) return s;
            return {
                ...s,
                responsive: {
                    ...s.responsive,
                    [device]: {
                        ...(s.responsive?.[device] || {}),
                        [key]: value
                    }
                }
            };
        });
        setLayoutConfig(newConfig);
        setAdvancedIsDirty(true);
    };

    const applyTemplate = (templateKey: keyof typeof TEMPLATES) => {
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
        setAdvancedIsDirty(true);
        toast.success(`Applied "${template.name}" template`);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layoutConfig.findIndex(s => s.id === active.id);
            const newIndex = layoutConfig.findIndex(s => s.id === over.id);
            const newConfig = arrayMove(layoutConfig, oldIndex, newIndex);
            setLayoutConfig(newConfig);
            saveToHistory(newConfig);
            setAdvancedIsDirty(true);
        }
    };

    const selectedSection = layoutConfig.find(s => s.id === selectedSectionId);

    const getPreviewStyle = () => {
        switch (devicePreview) {
            case 'mobile': return { width: '375px', transform: `scale(${previewZoom})`, transformOrigin: 'top center' };
            case 'tablet': return { width: '768px', transform: `scale(${previewZoom * 0.8})`, transformOrigin: 'top center' };
            default: return { width: '100%', maxWidth: '1000px', transform: `scale(${previewZoom * 0.75})`, transformOrigin: 'top center' };
        }
    };

    const handleSelectSection = (id: string) => {
        setSelectedSectionId(id);
        if (!rightPanelOpen) setRightPanelOpen(true);
    };

    // Notify parent of dirty state changes (both simple and advanced mode)
    useEffect(() => {
        if (onDirtyChange) {
            const isDirty = builderMode === 'simple' ? easyModeBuilder.isDirty : advancedIsDirty;
            onDirtyChange(isDirty);
        }
    }, [easyModeBuilder.isDirty, advancedIsDirty, builderMode, onDirtyChange]);

    // Handle close/back
    const handleClose = useCallback(() => {
        if (onRequestClose) {
            onRequestClose();
        } else {
            navigateToAdmin('storefront');
        }
    }, [onRequestClose, navigateToAdmin]);

    return (
        <div
            className={`flex flex-col bg-muted overflow-hidden ${isFullScreen ? '' : '-m-4 sm:-m-6'}`}
            style={{
                height: isFullScreen ? '100vh' : 'calc(100vh - 56px)',
                width: isFullScreen ? '100%' : 'calc(100% + 1.5rem)'
            }}
        >
            {/* Loading state */}
            {isLoadingStore && (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* No-store empty state */}
            {!isLoadingStore && !store && (
                <div className="flex-1 flex items-center justify-center p-6">
                    <Card className="w-full max-w-md">
                        <CardContent className="pt-6 space-y-6">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Store className="h-6 w-6 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold">Create Your Store</h2>
                                <p className="text-sm text-muted-foreground">
                                    Set up your white-label storefront to start selling to customers.
                                </p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="empty-store-name">Store Name</Label>
                                    <Input
                                        id="empty-store-name"
                                        placeholder="My Awesome Store"
                                        value={newStoreName}
                                        onChange={(e) => {
                                            setNewStoreName(e.target.value);
                                            setNewStoreSlug(generateSlug(e.target.value));
                                            setSlugAvailable(false);
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="empty-store-slug">Store URL Slug</Label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">/shop/</span>
                                        <Input
                                            id="empty-store-slug"
                                            placeholder="my-awesome-store"
                                            value={newStoreSlug}
                                            onChange={(e) => {
                                                setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                                setSlugAvailable(false);
                                            }}
                                            className="flex-1"
                                        />
                                    </div>
                                    {slugError && (
                                        <p className="text-sm text-destructive flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            {slugError}
                                        </p>
                                    )}
                                    {isSlugChecking && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Checking availability...
                                        </p>
                                    )}
                                    {slugAvailable && !isSlugChecking && newStoreSlug.length >= 3 && (
                                        <p className="text-sm text-green-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Slug is available
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Theme</Label>
                                    <ThemePresetStrip
                                        onSelectTheme={handleThemeSelect}
                                        selectedThemeId={selectedThemeId}
                                    />
                                </div>
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleCreateStore}
                                disabled={!newStoreName || !newStoreSlug || !!slugError || isSlugChecking || isCreatingWithCredits || createStoreMutation.isPending}
                            >
                                {(isCreatingWithCredits || createStoreMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {isCreatingWithCredits || createStoreMutation.isPending ? 'Creating...' : 'Create Store (500 credits)'}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Header + Builder (only when store exists) */}
            {!isLoadingStore && store && (<>
            <div className="flex items-center justify-between px-4 py-3 bg-background border-b shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={handleClose} aria-label={isFullScreen ? 'Close editor' : 'Back'}>
                        {isFullScreen ? <X className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    </Button>
                    <span className="font-semibold">{isFullScreen ? 'Storefront Editor' : 'Store Builder'}</span>
                    <div className="flex rounded-md bg-muted p-1">
                        <Button
                            variant={devicePreview === 'desktop' ? 'secondary' : 'ghost'}
                            size="icon" className="h-11 w-11"
                            onClick={() => setDevicePreview('desktop')} aria-label="Desktop preview"><Monitor className="w-4 h-4" /></Button>
                        <Button
                            variant={devicePreview === 'tablet' ? 'secondary' : 'ghost'}
                            size="icon" className="h-11 w-11"
                            onClick={() => setDevicePreview('tablet')} aria-label="Tablet preview"><Tablet className="w-4 h-4" /></Button>
                        <Button
                            variant={devicePreview === 'mobile' ? 'secondary' : 'ghost'}
                            size="icon" className="h-11 w-11"
                            onClick={() => setDevicePreview('mobile')} aria-label="Mobile preview"><Smartphone className="w-4 h-4" /></Button>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={undo}
                            disabled={historyIndex <= 0}
                            aria-label="Undo"
                        >
                            <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            aria-label="Redo"
                        >
                            <Redo2 className="w-4 h-4" />
                        </Button>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.1))}
                            disabled={previewZoom <= 0.5}
                            aria-label="Zoom out"
                        >
                            <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-xs w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 sm:h-6 sm:w-6"
                            onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}
                            disabled={previewZoom >= 1.2}
                            aria-label="Zoom in"
                        >
                            <ZoomIn className="w-3 h-3" />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Store status indicator */}
                    {store && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs">
                            {store.is_public ? (
                                <>
                                    <Globe className="w-3 h-3 text-green-500" />
                                    <span className="text-green-700 dark:text-green-400">Published</span>
                                </>
                            ) : (
                                <>
                                    <GlobeLock className="w-3 h-3 text-yellow-500" />
                                    <span className="text-yellow-700 dark:text-yellow-400">Draft</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Mode Toggle */}
                    <div className="flex bg-muted p-1 rounded-md">
                        <Button
                            variant={builderMode === 'simple' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleModeSwitch('simple')}
                        >
                            <Wand2 className="w-3 h-3" /> Simple
                        </Button>
                        <Button
                            variant={builderMode === 'advanced' ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleModeSwitch('advanced')}
                        >
                            <Settings2 className="w-3 h-3" /> Advanced
                        </Button>
                    </div>

                    <SaveButton
                        isPending={saveDraftMutation.isPending}
                        isSuccess={saveDraftMutation.isSuccess}
                        disabled={publishMutation.isPending}
                        onClick={() => saveDraftMutation.mutate()}
                        variant="outline"
                        size="sm"
                    >
                        Save Draft
                    </SaveButton>
                    <Button
                        disabled={publishMutation.isPending}
                        onClick={() => publishMutation.mutate()}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {publishMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Publish
                    </Button>
                </div>
            </div>

            {builderMode === 'simple' ? (
                /* Simple Mode - Easy Mode Editor */
                <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/20">
                    <EasyModeEditor
                        storeId={store?.id ?? ''}
                        storeSlug={store?.slug ?? ''}
                        selectedPresetId={easyModeBuilder.selectedPreset?.id || null}
                        onSelectPreset={easyModeBuilder.selectPreset}
                        featureToggles={easyModeBuilder.featureToggles}
                        onUpdateToggle={easyModeBuilder.updateFeatureToggle}
                        simpleContent={easyModeBuilder.simpleContent}
                        onUpdateContent={easyModeBuilder.updateSimpleContent}
                        onResetToPreset={easyModeBuilder.resetToPreset}
                        onSave={() => saveDraftMutation.mutate()}
                        onPublish={() => publishMutation.mutate()}
                        isSaving={saveDraftMutation.isPending || publishMutation.isPending}
                        isDirty={easyModeBuilder.isDirty}
                    />
                </div>
            ) : (
                /* Advanced Builder Layout */
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Left Sidebar - Narrower for more preview space */}
                    <div className="w-56 bg-background border-r flex flex-col shrink-0 z-10">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
                            <TabsList className="mx-3 mt-3 mb-2 grid grid-cols-3 h-8">
                                <TabsTrigger value="sections" className="text-xs px-2">Sections</TabsTrigger>
                                <TabsTrigger value="theme" className="text-xs px-2">Theme</TabsTrigger>
                                <TabsTrigger value="templates" className="text-xs px-2">Templates</TabsTrigger>
                            </TabsList>

                            {/* Sections Tab */}
                            <TabsContent value="sections" className="flex-1 overflow-hidden m-0">
                                <ScrollArea className="h-full">
                                    <div className="p-3 space-y-3">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Add Section</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(Object.entries(SECTION_TYPES) as [keyof typeof SECTION_TYPES, typeof SECTION_TYPES[keyof typeof SECTION_TYPES]][]).map(([key, { label, icon: Icon }]) => (
                                                <Button
                                                    key={key}
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex flex-col items-center gap-1 h-auto py-3 text-xs"
                                                    onClick={() => addSection(key)}
                                                >
                                                    <Icon className="w-4 h-4" />
                                                    <span className="truncate w-full text-center">{label}</span>
                                                </Button>
                                            ))}
                                        </div>
                                        <Separator />
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Layer Order</p>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={layoutConfig.map(s => s.id)} strategy={verticalListSortingStrategy}>
                                                <div className="space-y-1">
                                                    {layoutConfig.map((section) => (
                                                        <SortableSectionItem
                                                            key={section.id}
                                                            section={section}
                                                            isSelected={selectedSectionId === section.id}
                                                            onSelect={() => handleSelectSection(section.id)}
                                                            onRemove={(e) => requestRemoveSection(section.id, e)}
                                                            onDuplicate={(e) => duplicateSection(section.id, e)}
                                                            onToggleVisibility={(e) => toggleVisibility(section.id, e)}
                                                            sectionLabel={SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.label || section.type}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                        {layoutConfig.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-4">
                                                No sections yet. Add one above or pick a template.
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* Theme Tab */}
                            <TabsContent value="theme" className="flex-1 overflow-hidden m-0">
                                <ScrollArea className="h-full">
                                    <div className="p-3 space-y-3">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Theme Presets</p>
                                        <ThemePresetGrid
                                            selectedThemeId={selectedThemeId}
                                            onSelectTheme={handleThemeSelect}
                                        />
                                        <Separator />
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Custom Colors</p>
                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Primary</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input type="color" className="w-8 h-8 p-0 border-0 cursor-pointer rounded" value={themeConfig.colors?.primary ?? '#000000'} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, primary: e.target.value } }))} />
                                                    <Input className="flex-1 h-8 text-xs" value={themeConfig.colors?.primary ?? ''} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, primary: e.target.value } }))} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Accent</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input type="color" className="w-8 h-8 p-0 border-0 cursor-pointer rounded" value={themeConfig.colors?.accent ?? '#3b82f6'} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, accent: e.target.value } }))} />
                                                    <Input className="flex-1 h-8 text-xs" value={themeConfig.colors?.accent ?? ''} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, accent: e.target.value } }))} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Background</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input type="color" className="w-8 h-8 p-0 border-0 cursor-pointer rounded" value={themeConfig.colors?.background ?? '#ffffff'} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, background: e.target.value } }))} />
                                                    <Input className="flex-1 h-8 text-xs" value={themeConfig.colors?.background ?? ''} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, background: e.target.value } }))} />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Text</Label>
                                                <div className="flex gap-2 items-center">
                                                    <Input type="color" className="w-8 h-8 p-0 border-0 cursor-pointer rounded" value={themeConfig.colors?.text ?? '#000000'} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, text: e.target.value } }))} />
                                                    <Input className="flex-1 h-8 text-xs" value={themeConfig.colors?.text ?? ''} onChange={(e) => setThemeConfig(prev => ({ ...prev, colors: { ...prev.colors, text: e.target.value } }))} />
                                                </div>
                                            </div>
                                        </div>
                                        <Separator />
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Typography</p>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Font Family</Label>
                                            <Select value={themeConfig.typography?.fontFamily ?? 'Inter'} onValueChange={(v) => setThemeConfig(prev => ({ ...prev, typography: { ...prev.typography, fontFamily: v } }))}>
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select font" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Inter">Inter</SelectItem>
                                                    <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                                                    <SelectItem value="Montserrat">Montserrat</SelectItem>
                                                    <SelectItem value="Roboto">Roboto</SelectItem>
                                                    <SelectItem value="Poppins">Poppins</SelectItem>
                                                    <SelectItem value="DM Sans">DM Sans</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>

                            {/* Templates Tab */}
                            <TabsContent value="templates" className="flex-1 overflow-hidden m-0">
                                <ScrollArea className="h-full">
                                    <div className="p-3 space-y-2">
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Quick Start Templates</p>
                                        {Object.entries(TEMPLATES).map(([key, template]) => (
                                            <Card
                                                key={key}
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => applyTemplate(key as keyof typeof TEMPLATES)}
                                            >
                                                <CardContent className="p-3">
                                                    <p className="text-sm font-medium">{template.name}</p>
                                                    <p className="text-xs text-muted-foreground">{template.description}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {template.sections.length} sections: {template.sections.join(', ')}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </div>

                {/* Center: Live Preview - uses transform scaling */}
                <div className="flex-1 bg-muted flex items-start justify-center p-4 overflow-auto relative min-w-0 min-h-0">
                    <div
                        className="bg-background shadow-2xl overflow-visible transition-all duration-300 relative"
                        style={{
                            ...getPreviewStyle(),
                            minHeight: '800px',
                        }}
                    >
                        {/* Simulated Header */}
                        <div className="h-16 border-b flex items-center px-6 justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50">
                            <span className="font-bold text-lg">{store?.store_name ?? 'Store Name'}</span>
                            <div className="hidden md:flex gap-6 text-sm">
                                <span>Home</span>
                                <span>Shop</span>
                                <span>Contact</span>
                            </div>
                        </div>

                        {/* Sections Render */}
                        <div className="min-h-[calc(100%-4rem)] bg-background" style={{ backgroundColor: themeConfig.colors?.background }}>
                            {layoutConfig.filter(s => s.visible !== false).map((section) => {
                                const Component = SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.component as React.ComponentType<{ content: Record<string, unknown>; styles: Record<string, unknown>; storeId?: string }>;
                                if (!Component) return <div key={section.id} className="p-4 text-destructive">Unknown: {section.type}</div>;

                                return (
                                    <div
                                        key={section.id}
                                        className={`relative group ${selectedSectionId === section.id ? 'ring-2 ring-primary ring-inset z-10' : ''}`}
                                        onClick={() => handleSelectSection(section.id)}
                                    >
                                        <Component content={section.content} styles={section.styles} storeId={store?.id} />

                                        {/* Hover overlay for selection */}
                                        {selectedSectionId !== section.id && (
                                            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors cursor-pointer" />
                                        )}
                                    </div>
                                );
                            })}
                            {layoutConfig.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                    <Layout className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg font-medium mb-2">Your store canvas is empty</p>
                                    <p className="text-sm mb-6">Get started with a template or add sections manually</p>
                                    <div className="flex gap-3">
                                        <Button variant="default" onClick={() => applyTemplate('standard')}>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Quick Start (Standard)
                                        </Button>
                                        <Button variant="outline" onClick={() => setActiveTab('templates')}>
                                            Browse Templates
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Property Editor - collapsible */}
                {selectedSection && rightPanelOpen && (
                    <div className="w-72 bg-background border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Editing</h3>
                                <p className="font-medium text-sm">{SECTION_TYPES[selectedSection.type as keyof typeof SECTION_TYPES]?.label}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-6 sm:w-6" onClick={() => setRightPanelOpen(false)} aria-label="Close editor panel">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <SectionEditor
                                section={selectedSection}
                                onUpdateContent={(key, value) => updateSection(selectedSection.id, 'content', key, value)}
                                onUpdateStyles={(key, value) => updateSection(selectedSection.id, 'styles', key, value)}
                                onUpdateResponsive={(device, key, value) => updateSectionResponsive(selectedSection.id, device, key, value)}
                            />
                        </ScrollArea>
                    </div>
                )}
            </div>
            )}
            </>)}

            {/* Create Store Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Create Your Storefront</DialogTitle>
                        <DialogDescription>
                            Create a new white-label storefront. This will deduct 500 credits from your account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="store-name">Store Name</Label>
                            <Input
                                id="store-name"
                                placeholder="My Awesome Store"
                                value={newStoreName}
                                onChange={(e) => {
                                    setNewStoreName(e.target.value);
                                    setNewStoreSlug(generateSlug(e.target.value));
                                    setSlugAvailable(false);
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="store-slug">Store URL Slug</Label>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">/shop/</span>
                                <Input
                                    id="store-slug"
                                    placeholder="my-awesome-store"
                                    value={newStoreSlug}
                                    onChange={(e) => {
                                        setNewStoreSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                        setSlugAvailable(false);
                                    }}
                                    className="flex-1"
                                />
                            </div>
                            {slugError && (
                                <p className="text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    {slugError}
                                </p>
                            )}
                            {isSlugChecking && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Checking availability...
                                </p>
                            )}
                            {slugAvailable && !isSlugChecking && newStoreSlug.length >= 3 && (
                                <p className="text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Slug is available
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateStore}
                            disabled={!newStoreName || !newStoreSlug || !!slugError || isSlugChecking || isCreatingWithCredits || createStoreMutation.isPending}
                        >
                            {(isCreatingWithCredits || createStoreMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {isCreatingWithCredits || createStoreMutation.isPending ? 'Creating...' : 'Create Store (500 credits)'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Section Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={!!sectionToDelete}
                onOpenChange={(open) => !open && cancelRemoveSection()}
                onConfirm={confirmRemoveSection}
                title="Delete Section?"
                description="Are you sure you want to delete this section? This action cannot be undone."
                itemType="section"
            />

            {/* Out of Credits Modal */}
            <OutOfCreditsModal
                open={showOutOfCreditsModal}
                onOpenChange={(open) => { if (!open) closeOutOfCreditsModal(); }}
                actionAttempted={blockedAction ?? undefined}
            />
        </div>
    );
}

// Helper to get defaults dynamically
function sectionDefaults(type: string) {
    if (type === 'hero') return {
        content: {
            heading_line_1: 'Premium',
            heading_line_2: 'Flower',
            heading_line_3: 'Delivered',
            subheading: 'Curated strains. Same-day delivery.',
            cta_primary_text: 'Explore Collection',
            cta_primary_link: '/shop',
            cta_secondary_text: 'View Menu',
            cta_secondary_link: '/menu',
            trust_badges: true
        },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#022c22', text_color: '#ffffff', accent_color: '#34d399' }
    };
    if (type === 'features') return {
        content: {
            heading_small: 'The Difference',
            heading_large: 'Excellence in Every Detail',
            features: [
                { icon: 'clock', title: 'Same-Day Delivery', description: 'Order before 9 PM for delivery within the hour.' },
                { icon: 'shield', title: 'Lab Verified', description: 'Every strain tested for purity and quality.' },
                { icon: 'lock', title: 'Discreet Service', description: 'Unmarked packaging. Your privacy is our priority.' },
                { icon: 'star', title: 'Premium Selection', description: 'Hand-picked strains. Top-shelf quality.' },
            ]
        },
        styles: { background_color: '#171717', text_color: '#ffffff', icon_color: '#34d399' }
    };
    if (type === 'product_grid') return {
        content: {
            heading: 'Shop Premium Collection',
            subheading: 'Premium indoor-grown flower from licensed cultivators',
            show_search: true,
            show_categories: true,
            initial_categories_shown: 2,
            show_premium_filter: true
        },
        styles: { background_color: '#f4f4f5', text_color: '#000000', accent_color: '#10b981' }
    };
    if (type === 'testimonials') return {
        content: {
            heading: 'What Our Customers Say',
            subheading: 'Join thousands of satisfied customers',
            testimonials: [
                { name: 'Sarah M.', role: 'Verified Customer', quote: 'The quality is unmatched. Fast delivery and exactly what I was looking for.', rating: 5 },
                { name: 'Michael R.', role: 'Regular Customer', quote: 'Best service in the city. Professional, discreet, and always reliable.', rating: 5 },
                { name: 'Jessica L.', role: 'New Customer', quote: 'Impressed with the selection and the speed of delivery. Highly recommend!', rating: 5 },
            ]
        },
        styles: { background_color: '#ffffff', text_color: '#000000', accent_color: '#10b981', card_background: '#f9fafb' }
    };
    if (type === 'newsletter') return {
        content: { heading: 'Stay in the Loop', subheading: 'Subscribe for exclusive drops, deals, and updates.', button_text: 'Subscribe', placeholder_text: 'Enter your email', success_message: 'Thanks for subscribing!' },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#1f2937', text_color: '#ffffff', accent_color: '#10b981', button_color: '#10b981' }
    };
    if (type === 'gallery') return {
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
            ]
        },
        styles: { background_color: '#000000', text_color: '#ffffff', accent_color: '#10b981' }
    };
    if (type === 'faq') return {
        content: {
            heading: 'Frequently Asked Questions',
            subheading: 'Got questions? We\'ve got answers.',
            faqs: [
                { question: 'What are your delivery hours?', answer: 'We deliver 7 days a week from 10 AM to 10 PM. Same-day delivery available.' },
                { question: 'How do I track my order?', answer: 'You\'ll receive a tracking link via SMS and email once dispatched.' },
                { question: 'What payment methods do you accept?', answer: 'We accept cash, debit cards, and all major credit cards.' },
                { question: 'Is there a minimum order?', answer: 'Minimum order is $50 for delivery. Orders above $100 get free delivery.' },
            ]
        },
        styles: { background_color: '#f9fafb', text_color: '#000000', accent_color: '#10b981', border_color: '#e5e7eb' }
    };
    if (type === 'custom_html') return {
        content: { html_content: '<p>Add your custom HTML content here</p>', section_title: '' },
        styles: { background_color: '#ffffff', text_color: '#000000', padding_y: '4rem', max_width: '1200px' }
    };
    return { content: {}, styles: {} };
}

