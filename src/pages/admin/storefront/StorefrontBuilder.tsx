// Marketplace tables not in generated types yet

import { useState, useEffect } from 'react';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, GripVertical, Trash2, Save, ArrowLeft, Layout, Palette, Type, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HeroSection } from '@/components/shop/sections/HeroSection';
import { FeaturesSection } from '@/components/shop/sections/FeaturesSection';
import { ProductGridSection } from '@/components/shop/sections/ProductGridSection';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Define available section types
const SECTION_TYPES = {
    hero: { label: 'Hero Section', component: HeroSection, defaultContent: {}, defaultStyles: {} },
    features: { label: 'Features Grid', component: FeaturesSection, defaultContent: {}, defaultStyles: {} },
    product_grid: { label: 'Product Grid', component: ProductGridSection, defaultContent: {}, defaultStyles: {} },
};

export default function StorefrontBuilder() {
    const { tenant } = useTenantAdminAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('sections');
    const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

    // Builder State
    const [layoutConfig, setLayoutConfig] = useState<any[]>([]);
    const [themeConfig, setThemeConfig] = useState<any>({
        colors: { primary: '#000000', secondary: '#ffffff', accent: '#3b82f6', background: '#ffffff', text: '#000000' },
        typography: { fontFamily: 'Inter' }
    });
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

    // Fetch Store Config
    const { data: store, isLoading } = useQuery({
        queryKey: ['marketplace-settings', tenant?.id],
        queryFn: async (): Promise<MarketplaceStore> => {
            // Fetch from marketplace_stores via RPC or direct select
            // We'll use direct select as we have the table now
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
                    layout_config: [], // Start empty
                    theme_config: { colors: { primary: '#000000', background: '#ffffff' } }
                } as MarketplaceStore;
            }
        },
        enabled: !!tenant?.id,
    });

    // Hydrate state from DB
    useEffect(() => {
        if (store) {
            if (store.layout_config) setLayoutConfig(store.layout_config as any[]);
            if (store.theme_config) setThemeConfig(store.theme_config);
        }
    }, [store]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            // Optimistically try to save. If columns don't exist, this will fail.
            // @ts-ignore - marketplace_stores table may not be in generated types
            const { error } = await supabase
                .from('marketplace_stores')
                .update({
                    layout_config: layoutConfig,
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
        const newSection = {
            id: crypto.randomUUID(),
            type,
            content: { ...SECTION_TYPES[type].defaultContent },
            styles: { ...SECTION_TYPES[type].defaultStyles }
        };
        setLayoutConfig([...layoutConfig, newSection]);
        setSelectedSectionId(newSection.id);
    };

    const removeSection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setLayoutConfig(layoutConfig.filter(s => s.id !== id));
        if (selectedSectionId === id) setSelectedSectionId(null);
    };

    const updateSection = (id: string, field: 'content' | 'styles', key: string, value: any) => {
        setLayoutConfig(layoutConfig.map(s => {
            if (s.id !== id) return s;
            return {
                ...s,
                [field]: { ...s[field], [key]: value }
            };
        }));
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
        <div className="h-screen flex flex-col bg-neutral-100 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-semibold">Store Builder</span>
                    <div className="flex rounded-md bg-neutral-100 p-1">
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
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Preview Live</Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                        <Save className="w-4 h-4 mr-2" />
                        {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Controls */}
                <div className="w-80 bg-white border-r flex flex-col shrink-0 z-10">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-2 p-4 pb-0 h-auto bg-transparent">
                            <TabsTrigger value="sections">Sections</TabsTrigger>
                            <TabsTrigger value="theme">Theme</TabsTrigger>
                        </TabsList>
                        <Separator />

                        <TabsContent value="sections" className="flex-1 overflow-hidden flex flex-col m-0">
                            <ScrollArea className="flex-1 px-4 py-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Add Section</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button variant="outline" size="sm" onClick={() => addSection('hero')} className="justify-start"><Plus className="w-3 h-3 mr-2" />Hero</Button>
                                            <Button variant="outline" size="sm" onClick={() => addSection('features')} className="justify-start"><Plus className="w-3 h-3 mr-2" />Features</Button>
                                            <Button variant="outline" size="sm" onClick={() => addSection('product_grid')} className="justify-start"><Plus className="w-3 h-3 mr-2" />Products</Button>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-2">
                                        <Label>Page Sections</Label>
                                        <div className="space-y-2">
                                            {layoutConfig.map((section, index) => (
                                                <div
                                                    key={section.id}
                                                    onClick={() => setSelectedSectionId(section.id)}
                                                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${selectedSectionId === section.id ? 'border-primary bg-primary/5' : 'hover:bg-neutral-50'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <GripVertical className="w-4 h-4 text-neutral-400 cursor-move" />
                                                        <span className="text-sm font-medium">
                                                            {SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.label || section.type}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-neutral-400 hover:text-red-500"
                                                        onClick={(e) => removeSection(section.id, e)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {layoutConfig.length === 0 && (
                                                <div className="text-center py-8 text-neutral-400 text-sm border-2 border-dashed rounded-lg">
                                                    No sections added
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="theme" className="flex-1 overflow-hidden flex flex-col m-0 p-4">
                            {/* Theme controls here */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Global Colors</Label>
                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-500">Primary</span>
                                            <Input type="color" className="w-12 h-6 p-0 border-0"
                                                value={themeConfig.colors.primary}
                                                onChange={(e) => setThemeConfig({ ...themeConfig, colors: { ...themeConfig.colors, primary: e.target.value } })}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-neutral-500">Background</span>
                                            <Input type="color" className="w-12 h-6 p-0 border-0"
                                                value={themeConfig.colors.background}
                                                onChange={(e) => setThemeConfig({ ...themeConfig, colors: { ...themeConfig.colors, background: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Center: Live Preview */}
                <div className="flex-1 bg-neutral-100 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
                    <div
                        className="bg-white shadow-2xl overflow-y-auto transition-all duration-300 relative"
                        style={{
                            ...getPreviewStyle(),
                            scrollbarWidth: 'none',
                        }}
                    >
                        {/* Simulated Header */}
                        <div className="h-16 border-b flex items-center px-6 justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50">
                            <span className="font-bold text-lg">{store?.store_name || 'Store Name'}</span>
                            <div className="hidden md:flex gap-6 text-sm">
                                <span>Home</span>
                                <span>Shop</span>
                                <span>Contact</span>
                            </div>
                        </div>

                        {/* Sections Render */}
                        <div className="min-h-[calc(100%-4rem)] bg-white" style={{ backgroundColor: themeConfig.colors.background }}>
                            {layoutConfig.map((section) => {
                                const Component = SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.component;
                                if (!Component) return <div key={section.id} className="p-4 text-red-500">Unknown component type: {section.type}</div>;

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
                                <div className="flex flex-col items-center justify-center py-32 text-neutral-400">
                                    <Layout className="w-16 h-16 mb-4 opacity-50" />
                                    <p>Your store canvas is empty</p>
                                    <Button variant="link" onClick={() => { setActiveTab('sections'); addSection('hero'); }}>Add a Hero Section</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Property Editor */}
                {selectedSection && (
                    <div className="w-80 bg-white border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200">
                        <div className="p-4 border-b">
                            <h3 className="font-semibold text-sm uppercase text-neutral-500 mb-1">Editing</h3>
                            <p className="font-medium">{SECTION_TYPES[selectedSection.type as keyof typeof SECTION_TYPES]?.label}</p>
                        </div>
                        <ScrollArea className="flex-1 p-4">
                            <Accordion type="single" collapsible defaultValue="content" className="w-full">
                                <AccordionItem value="content">
                                    <AccordionTrigger>Content</AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2">
                                        {Object.keys(sectionDefaults(selectedSection.type).content).map((key) => (
                                            <div key={key} className="space-y-2">
                                                <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
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
                                                    <Label className="capitalize">{key.replace(/_/g, ' ')}</Label>
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
    return { content: {}, styles: {} };
}
