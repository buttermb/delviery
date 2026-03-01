/**
 * BuilderPreview
 * Center preview area with device-responsive scaling and section rendering
 */

import { Layout, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { type SectionConfig, type ThemeConfig, SECTION_TYPES, type TemplateKey } from './storefront-builder.config';

interface BuilderPreviewProps {
    store: MarketplaceStore | undefined;
    layoutConfig: SectionConfig[];
    themeConfig: ThemeConfig;
    devicePreview: 'desktop' | 'tablet' | 'mobile';
    previewZoom: number;
    selectedSectionId: string | null;
    onSelectSection: (id: string) => void;
    onApplyTemplate: (templateKey: TemplateKey) => void;
    setActiveTab: (tab: string) => void;
    tenantId?: string;
}

export function BuilderPreview({
    store,
    layoutConfig,
    themeConfig,
    devicePreview,
    previewZoom,
    selectedSectionId,
    onSelectSection,
    onApplyTemplate,
    setActiveTab,
    tenantId,
}: BuilderPreviewProps) {
    const getPreviewStyle = () => {
        switch (devicePreview) {
            case 'mobile': return { width: '100%', maxWidth: '375px', transform: `scale(${previewZoom * 0.9})`, transformOrigin: 'top center' };
            case 'tablet': return { width: '100%', maxWidth: '768px', transform: `scale(${previewZoom * 0.85})`, transformOrigin: 'top center' };
            default: return { width: '100%', maxWidth: '1200px', transform: `scale(${previewZoom})`, transformOrigin: 'top center' };
        }
    };

    return (
        <div className="flex-1 bg-muted flex items-start justify-center p-4 overflow-auto relative min-w-0 min-h-0">
            <div
                className="bg-background shadow-2xl overflow-visible transition-all duration-300 relative"
                style={{
                    ...getPreviewStyle(),
                    minHeight: 'calc(100vh - 200px)',
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
                        const sectionType = SECTION_TYPES[section.type as keyof typeof SECTION_TYPES];
                        const Component = sectionType?.component as React.ComponentType<{ content: Record<string, unknown>; styles: Record<string, unknown>; storeId?: string; tenantId?: string }> | undefined;
                        if (!Component) return <div key={section.id} className="p-4 text-destructive">Unknown: {section.type}</div>;

                        return (
                            <div
                                key={section.id}
                                className={`relative group ${selectedSectionId === section.id ? 'ring-2 ring-primary ring-inset z-10' : ''}`}
                                onClick={() => onSelectSection(section.id)}
                            >
                                <Component content={section.content} styles={section.styles} storeId={store?.id} tenantId={tenantId} />

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
                                <Button variant="default" onClick={() => onApplyTemplate('standard')}>
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
    );
}
