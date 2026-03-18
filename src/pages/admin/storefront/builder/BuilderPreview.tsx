/**
 * BuilderPreview
 * Center preview area with device-responsive scaling and section rendering.
 * Now supports drag-and-drop reordering of sections.
 */

import { useState } from 'react';
import { Layout, Sparkles, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketplaceStore } from '@/types/marketplace-extended';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { type StorefrontSection, type ThemeConfig, SECTION_REGISTRY, type TemplateKey } from './storefront-builder.config';

interface BuilderPreviewProps {
    store: MarketplaceStore | undefined;
    layoutConfig: StorefrontSection[];
    setLayoutConfig: (config: StorefrontSection[]) => void;
    saveToHistory: (config: StorefrontSection[]) => void;
    themeConfig: ThemeConfig;
    devicePreview: 'desktop' | 'tablet' | 'mobile';
    previewZoom: number;
    selectedSectionId: string | null;
    onSelectSection: (id: string) => void;
    onApplyTemplate: (templateKey: TemplateKey) => void;
    setActiveTab: (tab: string) => void;
    tenantId?: string;
}

// Draggable wrapper for preview sections
function PreviewSectionElement({
    section,
    isSelected,
    onSelect,
    storeId,
    tenantId,
    themeConfig: _themeConfig,
}: {
    section: StorefrontSection;
    isSelected: boolean;
    onSelect: () => void;
    storeId?: string;
    tenantId?: string;
    themeConfig: ThemeConfig;
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
        zIndex: isDragging ? 50 : isSelected ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    const sectionType = SECTION_REGISTRY[section.type as keyof typeof SECTION_REGISTRY];
    const Component = sectionType?.component as React.ComponentType<{ content: Record<string, unknown>; styles: Record<string, unknown>; storeId?: string; tenantId?: string }> | undefined;
    
    if (!Component) return <div className="p-4 text-destructive">Unknown: {section.type}</div>;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative group ${isSelected ? 'ring-2 ring-primary ring-inset shadow-lg' : ''} ${section.visible === false ? 'opacity-40 grayscale' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
        >
            {/* Drag Handle Overlay */}
            <div 
                {...attributes} 
                {...listeners}
                className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 text-foreground border shadow-sm px-3 py-1 rounded-full flex items-center gap-2 cursor-grab active:cursor-grabbing z-50 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <GripHorizontal className="w-4 h-4" />
                <span className="text-xs font-medium">{sectionType.label}</span>
            </div>

            <div className="pointer-events-none">
                 <Component content={section.content} styles={section.styles} storeId={storeId} tenantId={tenantId} />
            </div>

            {/* Hover overlay for selection feedback */}
            {!isSelected && !isDragging && (
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors cursor-pointer pointer-events-auto" />
            )}
        </div>
    );
}

export function BuilderPreview({
    store,
    layoutConfig,
    setLayoutConfig,
    saveToHistory,
    themeConfig,
    devicePreview,
    previewZoom,
    selectedSectionId,
    onSelectSection,
    onApplyTemplate,
    setActiveTab,
    tenantId,
}: BuilderPreviewProps) {
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragId(String(event.active.id));
        onSelectSection(String(event.active.id)); // Select upon dragging
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (over && active.id !== over.id) {
            const oldIndex = layoutConfig.findIndex(s => s.id === active.id);
            const newIndex = layoutConfig.findIndex(s => s.id === over.id);
            const newConfig = arrayMove(layoutConfig, oldIndex, newIndex);
            setLayoutConfig(newConfig);
            saveToHistory(newConfig);
        }
    };

    const getPreviewStyle = () => {
        switch (devicePreview) {
            case 'mobile': return { width: '100%', maxWidth: '375px', transform: `scale(${previewZoom * 0.9})`, transformOrigin: 'top center' };
            case 'tablet': return { width: '100%', maxWidth: '768px', transform: `scale(${previewZoom * 0.85})`, transformOrigin: 'top center' };
            default: return { width: '100%', maxWidth: '1200px', transform: `scale(${previewZoom})`, transformOrigin: 'top center' };
        }
    };

    return (
        <div 
            className="flex-1 bg-muted flex items-start justify-center p-4 overflow-auto relative min-w-0 min-h-0"
            onClick={() => onSelectSection('')} // Click outside deselects
        >
            <div
                className="bg-background shadow-2xl overflow-visible transition-all duration-300 relative"
                style={{
                    ...getPreviewStyle(),
                    minHeight: 'calc(100vh - 200px)',
                }}
            >
                {/* Simulated Header */}
                <div className="h-16 border-b flex items-center px-6 justify-between sticky top-0 bg-background/80 backdrop-blur-md z-[60]">
                    <span className="font-bold text-lg">{store?.store_name || 'Store Name'}</span>
                    <div className="hidden md:flex gap-6 text-sm">
                        <span>Home</span>
                        <span>Shop</span>
                        <span>Contact</span>
                    </div>
                </div>

                {/* Sections Render with DnD */}
                <div className="min-h-[calc(100%-4rem)] bg-background relative" style={{ backgroundColor: themeConfig.colors?.background }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={layoutConfig.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="flex flex-col">
                                {layoutConfig.map((section) => (
                                    <PreviewSectionElement
                                        key={section.id}
                                        section={section}
                                        isSelected={selectedSectionId === section.id}
                                        onSelect={() => onSelectSection(section.id)}
                                        storeId={store?.id}
                                        tenantId={tenantId}
                                        themeConfig={themeConfig}
                                    />
                                ))}
                            </div>
                        </SortableContext>

                        <DragOverlay>
                            {activeDragId ? (() => {
                                const section = layoutConfig.find(s => s.id === activeDragId);
                                if (!section) return null;
                                const sectionType = SECTION_REGISTRY[section.type as keyof typeof SECTION_REGISTRY];
                                return (
                                    <div className="bg-background/80 backdrop-blur-sm border-2 border-primary shadow-2xl rounded p-8 flex items-center justify-center scale-105 opacity-90 h-32">
                                        <div className="flex flex-col items-center gap-2 text-primary">
                                            <GripHorizontal className="w-6 h-6" />
                                            <span className="font-semibold text-lg">{sectionType?.label}</span>
                                        </div>
                                    </div>
                                );
                            })() : null}
                        </DragOverlay>
                    </DndContext>

                    {layoutConfig.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                            <Layout className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium mb-2">Your store canvas is empty</p>
                            <p className="text-sm mb-6">Get started with a template or add sections manually</p>
                            <div className="flex gap-3 pointer-events-auto">
                                <Button variant="default" onClick={(e) => { e.stopPropagation(); onApplyTemplate('standard'); }}>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Quick Start (Standard)
                                </Button>
                                <Button variant="outline" onClick={(e) => { e.stopPropagation(); setActiveTab('templates'); }}>
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
