/**
 * StorefrontBuilder - Orchestrator Component
 * Composes the modular builder sub-components with shared state from useStorefrontBuilder hook.
 *
 * Sub-modules in ./builder/:
 *  - storefront-builder.config.ts  → Section types, templates, defaults, shared types
 *  - useStorefrontBuilder.ts       → All state management, mutations, and actions
 *  - BuilderHeader.tsx             → Top toolbar (device preview, undo/redo, zoom, actions)
 *  - BuilderLeftPanel.tsx          → Left sidebar (sections, theme, templates tabs)
 *  - BuilderPreview.tsx            → Center preview area with device scaling
 *  - BuilderPropertyEditor.tsx     → Right sidebar (content/styles property editor)
 *  - BuilderCreateStoreDialog.tsx  → Store creation dialog with slug validation
 *  - SortableSectionItem.tsx       → Draggable section item for the section list
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Plus, GripVertical, Trash2, Save, ArrowLeft, Layout,
    Monitor, Smartphone, Tablet, Copy, Eye, EyeOff, Undo2, Redo2,
    FileText, Image, MessageSquare, HelpCircle, Mail, Sparkles, X, ZoomIn, ZoomOut,
    Code, Globe, GlobeLock, AlertCircle, Store
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { ThemePresetStrip } from '@/components/admin/storefront/ThemePresetSelector';
import { THEME_PRESETS, applyThemeToConfig, type ThemePreset } from '@/lib/storefrontThemes';
import { useCreditGatedAction } from '@/hooks/useCreditGatedAction';
import { OutOfCreditsModal } from '@/components/credits/OutOfCreditsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

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

interface SectionConfig {
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
    responsive?: {
        mobile?: { padding_y?: string; hidden?: boolean };
        tablet?: { padding_y?: string; hidden?: boolean };
        desktop?: { padding_y?: string; hidden?: boolean };
    };
}

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
                >
                    {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={onDuplicate}
                >
                    <Copy className="w-3 h-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={onRemove}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
        </div>
    );
}

export function StorefrontBuilder() {
    const { tenant } = useTenantAdminAuth();
    const { toast } = useToast();
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
            toast({
                title: 'Creating Storefront from Menu',
                description: `Starting with products from "${menuName || 'your menu'}"`,
            });
        }
    }, [fromMenuId, menuName, toast]);

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

    // Delete Confirmation Dialog State
    const [sectionToDelete, setSectionToDelete] = useState<string | null>(null);

    // Builder State
    const [layoutConfig, setLayoutConfig] = useState<SectionConfig[]>([]);
    const [themeConfig, setThemeConfig] = useState<{
        colors: { primary: string; secondary: string; accent: string; background: string; text: string };
        typography: { fontFamily: string };
    }>({
        colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
        typography: { fontFamily: 'Inter' }
    });
    const [selectedThemeId, setSelectedThemeId] = useState<string | undefined>(undefined);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // Handle theme selection
    const handleThemeSelect = useCallback((theme: ThemePreset) => {
        logger.debug('Applying theme preset', { themeId: theme.id });
        setSelectedThemeId(theme.id);
        // Apply theme colors to our config structure
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
        toast({
            title: 'Theme Applied',
            description: `${theme.name} theme has been applied to your storefront`,
        });
    }, [toast]);

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
    const { data: store, isLoading } = useQuery({
        queryKey: ['marketplace-settings', tenant?.id],
        queryFn: async (): Promise<MarketplaceStore> => {
            try {
                // @ts-expect-error - marketplace_stores table may not be in generated types
                const { data, error } = await supabase
                    .from('marketplace_stores')
                    .select('*')
                    .eq('tenant_id', tenant?.id)
                    .maybeSingle();

                if (error) throw error;
                return data as MarketplaceStore;
            } catch (e) {
                logger.warn("Using mock data as DB fetch failed", e);
                return {
                    id: 'mock-id',
                    tenant_id: tenant?.id || '',
                    store_name: tenant?.business_name || 'Mock Store',
                    slug: 'mock-store',
                    layout_config: [],
                    theme_config: { colors: { primary: '#000000', background: '#ffffff' } }
                } as MarketplaceStore;
            }
        },
        enabled: !!tenant?.id,
    });

    // Hydrate state from DB
    useEffect(() => {
        if (store) {
            // Ensure layout_config is always an array
            const rawConfig = store.layout_config;
            const config: SectionConfig[] = Array.isArray(rawConfig) ? rawConfig : [];
            setLayoutConfig(config);
            if (store.theme_config) setThemeConfig(store.theme_config);
            // Initialize history
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

    // Slug uniqueness validation
    const validateSlug = useCallback(async (slug: string): Promise<boolean> => {
        if (!slug || slug.length < 3) {
            setSlugError('Slug must be at least 3 characters');
            return false;
        }

        // Check for valid slug format (lowercase, alphanumeric, hyphens only)
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
            setSlugError('Slug can only contain lowercase letters, numbers, and hyphens');
            return false;
        }

        setIsValidatingSlug(true);
        try {
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { data, error } = await supabase
                .from('marketplace_stores')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSlugError('This slug is already taken');
                return false;
            }

            setSlugError(null);
            return true;
        } catch (err) {
            logger.error('Failed to validate slug', err);
            setSlugError('Failed to validate slug');
            return false;
        } finally {
            setIsValidatingSlug(false);
        }
    }, []);

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
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { data: newStore, error } = await supabase
                .from('marketplace_stores')
                .insert({
                    tenant_id: tenant?.id,
                    store_name: data.storeName,
                    slug: data.slug,
                    layout_config: [],
                    theme_config: themeConfig,
                    is_active: true,
                    is_public: false, // Start as draft
                })
                .select()
                .single();

            if (error) throw error;
            return newStore;
        },
        onSuccess: (newStore) => {
            toast({
                title: "Store created!",
                description: `Your storefront "${newStore.store_name}" has been created. 500 credits have been deducted.`
            });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
            setShowCreateDialog(false);
            setNewStoreName('');
            setNewStoreSlug('');
        },
        onError: (err) => {
            toast({
                title: "Creation failed",
                description: "Could not create storefront. Please try again.",
                variant: "destructive"
            });
            logger.error('Failed to create storefront', err);
        }
    });

    // Handle store creation with credit deduction
    const handleCreateStore = async () => {
        // Validate slug first
        const isValid = await validateSlug(newStoreSlug);
        if (!isValid) return;

        // Execute with credit gating (500 credits for storefront_create)
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

    // Save draft mutation (saves without publishing)
    const saveDraftMutation = useMutation({
        mutationFn: async () => {
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    layout_config: JSON.parse(JSON.stringify(layoutConfig)) as unknown,
                    theme_config: themeConfig as unknown,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant?.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Draft saved", description: "Your changes have been saved as a draft." });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
        },
        onError: (err) => {
            toast({
                title: "Save failed",
                description: "Could not save changes. Please try again.",
                variant: "destructive"
            });
            logger.error('Failed to save draft', err);
        }
    });

    // Publish mutation (makes store public)
    const publishMutation = useMutation({
        mutationFn: async () => {
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    layout_config: JSON.parse(JSON.stringify(layoutConfig)) as unknown,
                    theme_config: themeConfig as unknown,
                    is_public: true,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant?.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Store published!", description: "Your storefront is now live and visible to customers." });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
        },
        onError: (err) => {
            toast({
                title: "Publish failed",
                description: "Could not publish storefront. Please try again.",
                variant: "destructive"
            });
            logger.error('Failed to publish storefront', err);
        }
    });

    // Unpublish mutation (returns store to draft)
    const unpublishMutation = useMutation({
        mutationFn: async () => {
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    is_public: false,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant?.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Store unpublished", description: "Your storefront is now in draft mode." });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
        },
        onError: (err) => {
            toast({
                title: "Unpublish failed",
                description: "Could not unpublish storefront. Please try again.",
                variant: "destructive"
            });
            logger.error('Failed to unpublish storefront', err);
        }
    });

    // Deprecated - use saveDraftMutation or publishMutation instead
    const saveMutation = useMutation({
        mutationFn: async () => {
            // @ts-expect-error - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    layout_config: JSON.parse(JSON.stringify(layoutConfig)) as unknown,
                    theme_config: themeConfig as unknown,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant?.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Store saved", description: "Your storefront changes have been saved." });
            queryClient.invalidateQueries({ queryKey: ['marketplace-settings'] });
        },
        onError: (err) => {
            toast({
                title: "Save failed",
                description: "Could not save changes. Is the database migration applied?",
                variant: "destructive"
            });
            logger.error('Failed to save storefront', err);
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
    };

    // Request section deletion (shows confirmation dialog)
    const requestRemoveSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSectionToDelete(id);
    };

    // Confirm and execute section deletion
    const confirmRemoveSection = () => {
        if (!sectionToDelete) return;
        const newConfig = layoutConfig.filter(s => s.id !== sectionToDelete);
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        if (selectedSectionId === sectionToDelete) setSelectedSectionId(null);
        setSectionToDelete(null);
        toast({ title: "Section deleted" });
    };

    // Cancel section deletion
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
        toast({ title: "Section duplicated" });
    };

    const toggleVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newConfig = layoutConfig.map(s =>
            s.id === id ? { ...s, visible: !(s.visible ?? true) } : s
        );
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
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
        toast({ title: `Applied "${template.name}" template` });
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layoutConfig.findIndex(s => s.id === active.id);
            const newIndex = layoutConfig.findIndex(s => s.id === over.id);
            const newConfig = arrayMove(layoutConfig, oldIndex, newIndex);
            setLayoutConfig(newConfig);
            saveToHistory(newConfig);
        }
    };

    const selectedSection = layoutConfig.find(s => s.id === selectedSectionId);

    // Preview scale - use transform to fit content without breaking layout
    const getPreviewStyle = () => {
        // Apply user-controlled zoom
        switch (devicePreview) {
            case 'mobile': return { width: '375px', transform: `scale(${previewZoom * 0.9})`, transformOrigin: 'top center' };
            case 'tablet': return { width: '768px', transform: `scale(${previewZoom * 0.85})`, transformOrigin: 'top center' };
            default: return { width: '1200px', transform: `scale(${previewZoom})`, transformOrigin: 'top center' };
        }
    };

    // Auto-open right panel when selecting a section
    const handleSelectSection = (id: string) => {
        setSelectedSectionId(id);
        if (!rightPanelOpen) setRightPanelOpen(true);
    };

    return (
        <div className="flex flex-col bg-muted overflow-hidden -m-3 sm:-m-4 md:-m-6" style={{ height: 'calc(100vh - 56px)', width: 'calc(100% + 1.5rem)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-background border-b shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-semibold">Store Builder</span>
                    <div className="flex rounded-md bg-muted p-1">
                        <Button
                            variant={devicePreview === 'desktop' ? 'secondary' : 'ghost'}
                            size="icon" className="h-7 w-7"
                            onClick={() => setDevicePreview('desktop')}><Monitor className="w-4 h-4" /></Button>
                        <Button
                            variant={devicePreview === 'tablet' ? 'secondary' : 'ghost'}
                            size="icon" className="h-7 w-7"
                            onClick={() => setDevicePreview('tablet')}><Tablet className="w-4 h-4" /></Button>
                        <Button
                            variant={devicePreview === 'mobile' ? 'secondary' : 'ghost'}
                            size="icon" className="h-7 w-7"
                            onClick={() => setDevicePreview('mobile')}><Smartphone className="w-4 h-4" /></Button>
                    </div>
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={undo}
                            disabled={historyIndex <= 0}
                        >
                            <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
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
                            className="h-6 w-6"
                            onClick={() => setPreviewZoom(Math.max(0.5, previewZoom - 0.1))}
                            disabled={previewZoom <= 0.5}
                        >
                            <ZoomOut className="w-3 h-3" />
                        </Button>
                        <span className="text-xs w-10 text-center">{Math.round(previewZoom * 100)}%</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setPreviewZoom(Math.min(1.2, previewZoom + 0.1))}
                            disabled={previewZoom >= 1.2}
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
                    {/* Toggle right panel button when closed */}
                    {selectedSection && !rightPanelOpen && (
                        <Button variant="outline" size="sm" onClick={() => setRightPanelOpen(true)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Edit Section
                        </Button>
                    )}
                    {/* Create Store button when no store exists */}
                    {!store && !isLoading && (
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Store className="w-4 h-4 mr-2" />
                            Create Store (500 credits)
                        </Button>
                    )}
                    {/* Save Draft button */}
                    {store && (
                        <Button
                            variant="outline"
                            onClick={() => saveDraftMutation.mutate()}
                            disabled={saveDraftMutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                        </Button>
                    )}
                    {/* Publish / Unpublish button */}
                    {store && (
                        store.is_public ? (
                            <Button
                                variant="outline"
                                onClick={() => unpublishMutation.mutate()}
                                disabled={unpublishMutation.isPending}
                            >
                                <GlobeLock className="w-4 h-4 mr-2" />
                                {unpublishMutation.isPending ? 'Unpublishing...' : 'Unpublish'}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => publishMutation.mutate()}
                                disabled={publishMutation.isPending}
                            >
                                <Globe className="w-4 h-4 mr-2" />
                                {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                            </Button>
                        )
                    )}
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left Sidebar */}
                <BuilderLeftPanel
                    activeTab={builder.activeTab}
                    setActiveTab={builder.setActiveTab}
                    layoutConfig={builder.layoutConfig}
                    setLayoutConfig={builder.setLayoutConfig}
                    themeConfig={builder.themeConfig}
                    setThemeConfig={builder.setThemeConfig}
                    selectedSectionId={builder.selectedSectionId}
                    onAddSection={builder.addSection}
                    onSelectSection={builder.handleSelectSection}
                    onRemoveSection={builder.requestRemoveSection}
                    onDuplicateSection={builder.duplicateSection}
                    onToggleVisibility={builder.toggleVisibility}
                    onApplyTemplate={builder.applyTemplate}
                    saveToHistory={builder.saveToHistory}
                />

                {/* Center Preview */}
                <BuilderPreview
                    store={builder.store}
                    layoutConfig={builder.layoutConfig}
                    themeConfig={builder.themeConfig}
                    devicePreview={builder.devicePreview}
                    previewZoom={builder.previewZoom}
                    selectedSectionId={builder.selectedSectionId}
                    onSelectSection={builder.handleSelectSection}
                    onApplyTemplate={builder.applyTemplate}
                    setActiveTab={builder.setActiveTab}
                />
            </div>

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
                                    setSlugError(null);
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
                                        setSlugError(null);
                                    }}
                                    onBlur={() => {
                                        if (newStoreSlug) {
                                            validateSlug(newStoreSlug);
                                        }
                                    }}
                                    className="flex-1"
                                />
                            </div>
                            {slugError && (
                                <p className="text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {slugError}
                                </p>
                            )}
                            {isValidatingSlug && (
                                <p className="text-sm text-muted-foreground">Checking availability...</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateStore}
                            disabled={!newStoreName || !newStoreSlug || isValidatingSlug || isCreatingWithCredits || createStoreMutation.isPending}
                        >
                            {isCreatingWithCredits || createStoreMutation.isPending ? 'Creating...' : 'Create Store (500 credits)'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Section Confirmation Dialog */}
            <AlertDialog open={!!sectionToDelete} onOpenChange={(open) => !open && cancelRemoveSection()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this section? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={cancelRemoveSection}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmRemoveSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Out of Credits Modal */}
            <OutOfCreditsModal
                isOpen={showOutOfCreditsModal}
                onClose={closeOutOfCreditsModal}
                blockedAction={blockedAction ?? undefined}
            />
        </div>
    );
}

// Helper to get defaults dynamically so we don't crash on new props
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

// Default export for compatibility
export default StorefrontBuilder;
