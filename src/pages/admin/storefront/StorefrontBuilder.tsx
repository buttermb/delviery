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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
    BuilderHeader,
    BuilderLeftPanel,
    BuilderPreview,
    BuilderPropertyEditor,
    BuilderCreateStoreDialog,
    useStorefrontBuilder,
} from './builder';

export function StorefrontBuilder() {
    const builder = useStorefrontBuilder();

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

export default function StorefrontBuilder() {
    const { tenant } = useTenantAdminAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();

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
                // @ts-ignore - marketplace_stores table may not be in generated types
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

    const saveMutation = useMutation({
        mutationFn: async () => {
            // @ts-ignore - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    layout_config: JSON.parse(JSON.stringify(layoutConfig)) as any,
                    theme_config: themeConfig as any,
                    updated_at: new Date().toISOString()
                })
                .eq('tenant_id', tenant?.id);

            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Store saved", description: "Your storefront changes have been published." });
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

    const removeSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newConfig = layoutConfig.filter(s => s.id !== id);
        setLayoutConfig(newConfig);
        saveToHistory(newConfig);
        if (selectedSectionId === id) setSelectedSectionId(null);
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

    const updateSection = (id: string, field: 'content' | 'styles', key: string, value: any) => {
        const newConfig = layoutConfig.map(s => {
            if (s.id !== id) return s;
            return {
                ...s,
                [field]: { ...s[field], [key]: value }
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
            <BuilderHeader
                store={builder.store}
                isLoading={builder.isLoading}
                devicePreview={builder.devicePreview}
                setDevicePreview={builder.setDevicePreview}
                previewZoom={builder.previewZoom}
                setPreviewZoom={builder.setPreviewZoom}
                historyIndex={builder.historyIndex}
                historyLength={builder.history.length}
                undo={builder.undo}
                redo={builder.redo}
                rightPanelOpen={builder.rightPanelOpen}
                setRightPanelOpen={builder.setRightPanelOpen}
                hasSelectedSection={!!builder.selectedSection}
                onCreateStore={() => builder.setShowCreateDialog(true)}
                onSaveDraft={() => builder.saveDraftMutation.mutate()}
                isSaving={builder.saveDraftMutation.isPending}
                onPublish={() => builder.publishMutation.mutate()}
                isPublishing={builder.publishMutation.isPending}
                onUnpublish={() => builder.unpublishMutation.mutate()}
                isUnpublishing={builder.unpublishMutation.isPending}
            />

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

                {/* Right Property Editor */}
                {builder.selectedSection && builder.rightPanelOpen && (
                    <BuilderPropertyEditor
                        selectedSection={builder.selectedSection}
                        onClose={() => builder.setRightPanelOpen(false)}
                        onUpdateSection={builder.updateSection}
                    />
                )}
            </div>

            {/* Create Store Dialog */}
            <BuilderCreateStoreDialog
                open={builder.showCreateDialog}
                onOpenChange={builder.setShowCreateDialog}
                storeName={builder.newStoreName}
                onStoreNameChange={builder.setNewStoreName}
                storeSlug={builder.newStoreSlug}
                onStoreSlugChange={builder.setNewStoreSlug}
                slugError={builder.slugError}
                onSlugErrorChange={builder.setSlugError}
                isValidatingSlug={builder.isValidatingSlug}
                generateSlug={builder.generateSlug}
                validateSlug={builder.validateSlug}
                onSubmit={builder.handleCreateStore}
                isSubmitting={builder.isCreatingWithCredits || builder.createStoreMutation.isPending}
            />

            {/* Delete Section Confirmation Dialog */}
            <AlertDialog open={!!builder.sectionToDelete} onOpenChange={(open) => !open && builder.cancelRemoveSection()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this section? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={builder.cancelRemoveSection}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={builder.confirmRemoveSection} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Out of Credits Modal */}
            <OutOfCreditsModal
                open={builder.showOutOfCreditsModal}
                onOpenChange={builder.closeOutOfCreditsModal}
                actionAttempted={builder.blockedAction ?? undefined}
            />
        </div>
    );
}

// Default export for lazy loading compatibility
export default StorefrontBuilder;
