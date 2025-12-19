// Marketplace tables not in generated types yet

import { useState, useEffect, useCallback } from 'react';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
    Plus, GripVertical, Trash2, Save, ArrowLeft, Layout, Palette, Type, 
    Monitor, Smartphone, Tablet, Copy, Eye, EyeOff, Undo2, Redo2, 
    FileText, Image, MessageSquare, HelpCircle, Mail, Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { TestimonialsSection } from '@/components/shop/sections/TestimonialsSection';
import { NewsletterSection } from '@/components/shop/sections/NewsletterSection';
import { GallerySection } from '@/components/shop/sections/GallerySection';
import { FAQSection } from '@/components/shop/sections/FAQSection';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Define available section types
const SECTION_TYPES = {
    hero: { label: 'Hero Section', icon: Layout, component: HeroSection },
    features: { label: 'Features Grid', icon: Sparkles, component: FeaturesSection },
    product_grid: { label: 'Product Grid', icon: Layout, component: ProductGridSection },
    testimonials: { label: 'Testimonials', icon: MessageSquare, component: TestimonialsSection },
    newsletter: { label: 'Newsletter', icon: Mail, component: NewsletterSection },
    gallery: { label: 'Gallery', icon: Image, component: GallerySection },
    faq: { label: 'FAQ', icon: HelpCircle, component: FAQSection },
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
    content: Record<string, any>;
    styles: Record<string, any>;
    visible?: boolean;
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
            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
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
    const [activeTab, setActiveTab] = useState('sections');
    const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

    // Builder State
    const [layoutConfig, setLayoutConfig] = useState<SectionConfig[]>([]);
    const [themeConfig, setThemeConfig] = useState<any>({
        colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
        typography: { fontFamily: 'Inter' }
    });
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

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
                console.warn("Using mock data as DB fetch failed:", e);
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
                    layout_config: JSON.parse(JSON.stringify(layoutConfig)),
                    theme_config: themeConfig,
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
            console.error(err);
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

    // Preview Scale Calculation
    const getPreviewStyle = () => {
        switch (devicePreview) {
            case 'mobile': return { width: '375px', height: '100%' };
            case 'tablet': return { width: '768px', height: '100%' };
            default: return { width: '100%', height: '100%' };
        }
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
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Preview Live</Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left Sidebar: Controls */}
                <div className="w-80 bg-background border-r flex flex-col shrink-0 z-10 min-h-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-3 p-4 pb-0 h-auto bg-transparent">
                            <TabsTrigger value="sections">Sections</TabsTrigger>
                            <TabsTrigger value="theme">Theme</TabsTrigger>
                            <TabsTrigger value="templates">Templates</TabsTrigger>
                        </TabsList>
                        <Separator />

                        <TabsContent value="sections" className="flex-1 overflow-hidden flex flex-col m-0">
                            <ScrollArea className="flex-1 px-4 py-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Add Section</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(SECTION_TYPES).map(([key, { label, icon: Icon }]) => (
                                                <Button 
                                                    key={key}
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => addSection(key as keyof typeof SECTION_TYPES)} 
                                                    className="justify-start text-xs"
                                                >
                                                    <Plus className="w-3 h-3 mr-1" />
                                                    {label.split(' ')[0]}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label>Page Sections</Label>
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={handleDragEnd}
                                        >
                                            <SortableContext
                                                items={layoutConfig.map(s => s.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-2">
                                                    {layoutConfig.map((section) => (
                                                        <SortableSectionItem
                                                            key={section.id}
                                                            section={section}
                                                            isSelected={selectedSectionId === section.id}
                                                            onSelect={() => setSelectedSectionId(section.id)}
                                                            onRemove={(e) => removeSection(section.id, e)}
                                                            onDuplicate={(e) => duplicateSection(section.id, e)}
                                                            onToggleVisibility={(e) => toggleVisibility(section.id, e)}
                                                            sectionLabel={SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.label || section.type}
                                                        />
                                                    ))}
                                                </div>
                                            </SortableContext>
                                        </DndContext>
                                        {layoutConfig.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                                No sections added
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="theme" className="flex-1 overflow-hidden flex flex-col m-0 p-4">
                            <ScrollArea className="flex-1">
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <Label>Global Colors</Label>
                                        <div className="grid gap-3">
                                            {['primary', 'secondary', 'accent', 'background', 'text'].map(colorKey => (
                                                <div key={colorKey} className="flex items-center justify-between">
                                                    <span className="text-sm text-muted-foreground capitalize">{colorKey}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Input 
                                                            type="color" 
                                                            className="w-8 h-8 p-0 border-0 cursor-pointer"
                                                            value={themeConfig.colors?.[colorKey] || '#000000'}
                                                            onChange={(e) => setThemeConfig({ 
                                                                ...themeConfig, 
                                                                colors: { ...themeConfig.colors, [colorKey]: e.target.value } 
                                                            })}
                                                        />
                                                        <Input
                                                            className="w-24 h-8 text-xs"
                                                            value={themeConfig.colors?.[colorKey] || '#000000'}
                                                            onChange={(e) => setThemeConfig({ 
                                                                ...themeConfig, 
                                                                colors: { ...themeConfig.colors, [colorKey]: e.target.value } 
                                                            })}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-3">
                                        <Label>Typography</Label>
                                        <Select
                                            value={themeConfig.typography?.fontFamily || 'Inter'}
                                            onValueChange={(value) => setThemeConfig({
                                                ...themeConfig,
                                                typography: { ...themeConfig.typography, fontFamily: value }
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Inter">Inter</SelectItem>
                                                <SelectItem value="Space Grotesk">Space Grotesk</SelectItem>
                                                <SelectItem value="DM Sans">DM Sans</SelectItem>
                                                <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                                                <SelectItem value="Montserrat">Montserrat</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="templates" className="flex-1 overflow-hidden flex flex-col m-0 p-4">
                            <ScrollArea className="flex-1">
                                <div className="space-y-3">
                                    <Label>Quick Templates</Label>
                                    <p className="text-xs text-muted-foreground">Start with a pre-built layout</p>
                                    <div className="space-y-2">
                                        {Object.entries(TEMPLATES).map(([key, template]) => (
                                            <Card 
                                                key={key}
                                                className="cursor-pointer hover:border-primary transition-colors"
                                                onClick={() => applyTemplate(key as keyof typeof TEMPLATES)}
                                            >
                                                <CardContent className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-medium text-sm">{template.name}</p>
                                                            <p className="text-xs text-muted-foreground">{template.description}</p>
                                                        </div>
                                                        <FileText className="w-4 h-4 text-muted-foreground" />
                                                    </div>
                                                    <div className="flex gap-1 mt-2 flex-wrap">
                                                        {template.sections.map((s, i) => (
                                                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
                                                                {SECTION_TYPES[s as keyof typeof SECTION_TYPES]?.label.split(' ')[0]}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Center: Live Preview */}
                <div className="flex-1 bg-muted flex items-center justify-center p-4 md:p-8 overflow-hidden relative min-w-0 min-h-0">
                    <div
                        className="bg-background shadow-2xl overflow-y-auto transition-all duration-300 relative max-h-full min-h-0"
                        style={{
                            width: devicePreview === 'mobile' ? '375px' : devicePreview === 'tablet' ? '768px' : '100%',
                            maxWidth: devicePreview === 'desktop' ? 'calc(100% - 2rem)' : undefined,
                            height: '100%',
                            scrollbarWidth: 'none',
                        }}
                    >
                        {/* Simulated Header */}
                        <div className="h-16 border-b flex items-center px-6 justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50">
                            <span className="font-bold text-lg">{store?.store_name || 'Store Name'}</span>
                            <div className="hidden md:flex gap-6 text-sm">
                                <span>Home</span>
                                <span>Shop</span>
                                <span>Contact</span>
                            </div>
                        </div>

                        {/* Sections Render */}
                        <div className="min-h-[calc(100%-4rem)] bg-background" style={{ backgroundColor: themeConfig.colors?.background }}>
                            {layoutConfig.filter(s => s.visible !== false).map((section) => {
                                const Component = SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.component as any;
                                if (!Component) return <div key={section.id} className="p-4 text-destructive">Unknown: {section.type}</div>;

                                return (
                                    <div
                                        key={section.id}
                                        className={`relative group ${selectedSectionId === section.id ? 'ring-2 ring-primary ring-inset z-10' : ''}`}
                                        onClick={() => setSelectedSectionId(section.id)}
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
                                <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                                    <Layout className="w-16 h-16 mb-4 opacity-50" />
                                    <p>Your store canvas is empty</p>
                                    <Button variant="link" onClick={() => { setActiveTab('templates'); }}>Choose a Template</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Property Editor */}
                {selectedSection && (
                    <div className="w-80 bg-background border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-1">Editing</h3>
                            <p className="font-medium">{SECTION_TYPES[selectedSection.type as keyof typeof SECTION_TYPES]?.label}</p>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <Accordion type="single" collapsible defaultValue="content" className="w-full">
                                <AccordionItem value="content">
                                    <AccordionTrigger>Content</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        {Object.keys(sectionDefaults(selectedSection.type).content).map((key) => (
                                            <div key={key} className="space-y-2">
                                                <Label className="capitalize text-xs">{key.replace(/_/g, ' ')}</Label>
                                                <Input
                                                    value={selectedSection.content[key] || ''}
                                                    onChange={(e) => updateSection(selectedSection.id, 'content', key, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                                <AccordionItem value="styles">
                                    <AccordionTrigger>Styles</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        {Object.keys(sectionDefaults(selectedSection.type).styles).map((key) => {
                                            const isColor = key.includes('color') || key.includes('gradient');
                                            return (
                                                <div key={key} className="space-y-2">
                                                    <Label className="capitalize text-xs">{key.replace(/_/g, ' ')}</Label>
                                                    {isColor ? (
                                                        <div className="flex gap-2">
                                                            <Input
                                                                type="color"
                                                                className="w-10 h-10 p-0"
                                                                value={selectedSection.styles[key] || '#ffffff'}
                                                                onChange={(e) => updateSection(selectedSection.id, 'styles', key, e.target.value)}
                                                            />
                                                            <Input
                                                                type="text"
                                                                value={selectedSection.styles[key] || ''}
                                                                onChange={(e) => updateSection(selectedSection.id, 'styles', key, e.target.value)}
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <Input
                                                            value={selectedSection.styles[key] || ''}
                                                            onChange={(e) => updateSection(selectedSection.id, 'styles', key, e.target.value)}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to get defaults dynamically so we don't crash on new props
function sectionDefaults(type: string) {
    if (type === 'hero') return {
        content: { heading_line_1: 'Premium', heading_line_2: 'Flower', heading_line_3: 'Delivered', subheading: 'Premium delivery service.' },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#022c22', text_color: '#ffffff', accent_color: '#34d399' }
    };
    if (type === 'features') return {
        content: { heading_small: 'The Difference', heading_large: 'Excellence' },
        styles: { background_color: '#171717', text_color: '#ffffff', icon_color: '#34d399' }
    };
    if (type === 'product_grid') return {
        content: { heading: 'Shop Collection', subheading: 'Curated selection.' },
        styles: { background_color: '#f4f4f5', text_color: '#000000', accent_color: '#10b981' }
    };
    if (type === 'testimonials') return {
        content: { heading: 'What Our Customers Say', subheading: 'Join thousands of satisfied customers' },
        styles: { background_color: '#ffffff', text_color: '#000000', accent_color: '#10b981', card_background: '#f9fafb' }
    };
    if (type === 'newsletter') return {
        content: { heading: 'Stay in the Loop', subheading: 'Subscribe for exclusive drops.', button_text: 'Subscribe', placeholder_text: 'Enter your email', success_message: 'Thanks for subscribing!' },
        styles: { background_gradient_start: '#000000', background_gradient_end: '#1f2937', text_color: '#ffffff', accent_color: '#10b981', button_color: '#10b981' }
    };
    if (type === 'gallery') return {
        content: { heading: 'Gallery', subheading: 'A curated visual experience' },
        styles: { background_color: '#000000', text_color: '#ffffff', accent_color: '#10b981' }
    };
    if (type === 'faq') return {
        content: { heading: 'Frequently Asked Questions', subheading: 'Got questions? We\'ve got answers.' },
        styles: { background_color: '#f9fafb', text_color: '#000000', accent_color: '#10b981', border_color: '#e5e7eb' }
    };
    return { content: {}, styles: {} };
}
