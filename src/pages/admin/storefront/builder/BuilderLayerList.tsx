/**
 * BuilderLayerList
 * Drag-and-drop sortable list of active sections on the page.
 */

import { useState } from 'react';
import { Layers, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SortableSectionItem } from './SortableSectionItem';
import { type StorefrontSection, SECTION_REGISTRY } from './storefront-builder.config';

interface BuilderLayerListProps {
    layoutConfig: StorefrontSection[];
    setLayoutConfig: (config: StorefrontSection[]) => void;
    saveToHistory: (config: StorefrontSection[]) => void;
    selectedSectionId: string | null;
    onSelectSection: (id: string) => void;
    onRemoveSection: (id: string, e: React.MouseEvent) => void;
    onDuplicateSection: (id: string, e: React.MouseEvent) => void;
    onToggleVisibility: (id: string, e: React.MouseEvent) => void;
}

export function BuilderLayerList({
    layoutConfig,
    setLayoutConfig,
    saveToHistory,
    selectedSectionId,
    onSelectSection,
    onRemoveSection,
    onDuplicateSection,
    onToggleVisibility
}: BuilderLayerListProps) {
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

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b shrink-0 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers className="w-4 h-4" />
                <span>Page Layers</span>
            </div>

            <ScrollArea className="flex-1 p-4">
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
                        <div className="space-y-2">
                            {layoutConfig.map((section) => (
                                <SortableSectionItem
                                    key={section.id}
                                    section={section}
                                    isSelected={selectedSectionId === section.id}
                                    onSelect={() => onSelectSection(section.id)}
                                    onRemove={(e) => onRemoveSection(section.id, e)}
                                    onDuplicate={(e) => onDuplicateSection(section.id, e)}
                                    onToggleVisibility={(e) => onToggleVisibility(section.id, e)}
                                    sectionLabel={SECTION_REGISTRY[section.type as keyof typeof SECTION_REGISTRY]?.label || section.type}
                                />
                            ))}
                        </div>
                    </SortableContext>
                    
                    <DragOverlay>
                        {activeDragId ? (() => {
                            const section = layoutConfig.find(s => s.id === activeDragId);
                            if (!section) return null;
                            return (
                                <div className="flex items-center gap-3 p-3 rounded-md border border-primary bg-background shadow-lg opacity-90 scale-105 transition-transform">
                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">
                                        {SECTION_REGISTRY[section.type as keyof typeof SECTION_REGISTRY]?.label || section.type}
                                    </span>
                                </div>
                            );
                        })() : null}
                    </DragOverlay>
                </DndContext>
                
                {layoutConfig.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg mt-4 bg-muted/20">
                        <Layers className="w-8 h-8 opacity-20 mx-auto mb-3" />
                        <p className="text-sm font-medium">No layers yet</p>
                        <p className="text-xs mt-1">Add sections from the Library tab</p>
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
