/**
 * BuilderLeftPanel
 * Left sidebar with Sections, Theme, and Templates tabs
 */

import { useState } from 'react';
import { Plus, FileText, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableSectionItem } from './SortableSectionItem';
import {
    type SectionConfig,
    type ThemeConfig,
    type TemplateKey,
    SECTION_TYPES,
    TEMPLATES,
} from './storefront-builder.config';

interface BuilderLeftPanelProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    layoutConfig: SectionConfig[];
    setLayoutConfig: (config: SectionConfig[]) => void;
    themeConfig: ThemeConfig;
    setThemeConfig: (config: ThemeConfig) => void;
    selectedSectionId: string | null;
    onAddSection: (type: string) => void;
    onSelectSection: (id: string) => void;
    onRemoveSection: (id: string, e: React.MouseEvent) => void;
    onDuplicateSection: (id: string, e: React.MouseEvent) => void;
    onToggleVisibility: (id: string, e: React.MouseEvent) => void;
    onApplyTemplate: (templateKey: TemplateKey) => void;
    saveToHistory: (config: SectionConfig[]) => void;
}

export function BuilderLeftPanel({
    activeTab,
    setActiveTab,
    layoutConfig,
    setLayoutConfig,
    themeConfig,
    setThemeConfig,
    selectedSectionId,
    onAddSection,
    onSelectSection,
    onRemoveSection,
    onDuplicateSection,
    onToggleVisibility,
    onApplyTemplate,
    saveToHistory,
}: BuilderLeftPanelProps) {
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
        <div className="w-64 bg-background border-r flex flex-col shrink-0 z-10 min-h-0">
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
                                <div className="grid gap-1.5">
                                    {Object.entries(SECTION_TYPES).map(([key, { label, description, icon: Icon }]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => onAddSection(key)}
                                            className="flex items-start gap-2 rounded-md border border-border px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
                                        >
                                            <Icon className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium leading-tight">{label}</p>
                                                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{description}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Page Sections</Label>
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
                                                    sectionLabel={SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.label || section.type}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                    <DragOverlay>
                                        {activeDragId ? (() => {
                                            const section = layoutConfig.find(s => s.id === activeDragId);
                                            if (!section) return null;
                                            return (
                                                <div className="flex items-center gap-3 p-3 rounded-md border border-primary bg-background shadow-lg">
                                                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">
                                                        {SECTION_TYPES[section.type as keyof typeof SECTION_TYPES]?.label || section.type}
                                                    </span>
                                                </div>
                                            );
                                        })() : null}
                                    </DragOverlay>
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
                                    {(['primary', 'secondary', 'accent', 'background', 'text'] as const).map(colorKey => (
                                        <div key={colorKey} className="flex items-center justify-between">
                                            <span className="text-sm text-muted-foreground capitalize">{colorKey}</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="color"
                                                    className="w-8 h-8 p-0 border-0 cursor-pointer"
                                                    aria-label={`${colorKey} color picker`}
                                                    value={themeConfig.colors?.[colorKey] || '#000000'}
                                                    onChange={(e) => setThemeConfig({
                                                        ...themeConfig,
                                                        colors: { ...themeConfig.colors, [colorKey]: e.target.value }
                                                    })}
                                                />
                                                <Input
                                                    className="w-24 h-8 text-xs"
                                                    aria-label={`${colorKey} color value`}
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
                                    <SelectTrigger
                                        style={{
                                            fontFamily: themeConfig.typography?.fontFamily
                                                ? `"${themeConfig.typography.fontFamily}", sans-serif`
                                                : 'Inter, sans-serif'
                                        }}
                                    >
                                        <SelectValue placeholder="Select font" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Inter">
                                            <span style={{ fontFamily: 'Inter, sans-serif' }}>Inter</span>
                                        </SelectItem>
                                        <SelectItem value="Space Grotesk">
                                            <span style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Space Grotesk</span>
                                        </SelectItem>
                                        <SelectItem value="DM Sans">
                                            <span style={{ fontFamily: '"DM Sans", sans-serif' }}>DM Sans</span>
                                        </SelectItem>
                                        <SelectItem value="Playfair Display">
                                            <span style={{ fontFamily: '"Playfair Display", serif' }}>Playfair Display</span>
                                        </SelectItem>
                                        <SelectItem value="Montserrat">
                                            <span style={{ fontFamily: 'Montserrat, sans-serif' }}>Montserrat</span>
                                        </SelectItem>
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
                                        onClick={() => onApplyTemplate(key as TemplateKey)}
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
    );
}
