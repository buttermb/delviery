/**
 * BuilderPropertyEditor
 * Right sidebar panel for editing content and styles of the selected section.
 * Now features tabbed Content / Style views and responsive design controls.
 */

import { X, Type, Paintbrush, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SectionEditor } from '@/components/admin/storefront/SectionEditors';
import { type StorefrontSection, SECTION_REGISTRY } from './storefront-builder.config';

interface BuilderPropertyEditorProps {
    selectedSection: StorefrontSection;
    onClose: () => void;
    onUpdateSection: (id: string, field: 'content' | 'styles', key: string, value: unknown) => void;
    onUpdateResponsive?: (id: string, device: 'mobile' | 'tablet' | 'desktop', key: string, value: unknown) => void;
}

export function BuilderPropertyEditor({
    selectedSection,
    onClose,
    onUpdateSection,
    onUpdateResponsive,
}: BuilderPropertyEditorProps) {
    const sectionLabel = SECTION_REGISTRY[selectedSection.type as keyof typeof SECTION_REGISTRY]?.label ?? selectedSection.type;

    return (
        <div className="w-72 lg:w-80 bg-background border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200 max-w-[320px]">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div className="min-w-0">
                    <h3 className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Editing</h3>
                    <p className="font-medium text-sm truncate">{sectionLabel}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close property editor">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Tabbed Editor */}
            <Tabs defaultValue="content" className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-3 px-4 pt-2 h-auto bg-transparent rounded-none shrink-0">
                    <TabsTrigger value="content" className="text-xs py-1.5 gap-1">
                        <Type className="w-3 h-3" /> Content
                    </TabsTrigger>
                    <TabsTrigger value="style" className="text-xs py-1.5 gap-1">
                        <Paintbrush className="w-3 h-3" /> Style
                    </TabsTrigger>
                    <TabsTrigger value="responsive" className="text-xs py-1.5 gap-1">
                        <Smartphone className="w-3 h-3" /> Responsive
                    </TabsTrigger>
                </TabsList>

                <Separator />

                {/* Content Tab - Section-specific editor */}
                <TabsContent value="content" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <ScrollArea className="h-full p-4">
                        <SectionEditor
                            section={selectedSection}
                            onUpdateContent={(key, value) => onUpdateSection(selectedSection.id, 'content', key, value)}
                            onUpdateStyles={(key, value) => onUpdateSection(selectedSection.id, 'styles', key, value)}
                            onUpdateResponsive={(device, key, value) => {
                                if (onUpdateResponsive) {
                                    onUpdateResponsive(selectedSection.id, device, key, value);
                                }
                            }}
                        />
                    </ScrollArea>
                </TabsContent>

                {/* Style Tab - Common visual controls */}
                <TabsContent value="style" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <ScrollArea className="h-full p-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Background Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="color"
                                        className="w-8 h-8 p-0 border-0 cursor-pointer rounded overflow-hidden"
                                        value={(selectedSection.styles?.backgroundColor as string) || '#ffffff'}
                                        onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'backgroundColor', e.target.value)}
                                    />
                                    <Input
                                        className="flex-1 h-8 text-xs font-mono uppercase"
                                        value={(selectedSection.styles?.backgroundColor as string) || '#ffffff'}
                                        onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'backgroundColor', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Text Color</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="color"
                                        className="w-8 h-8 p-0 border-0 cursor-pointer rounded overflow-hidden"
                                        value={(selectedSection.styles?.textColor as string) || '#000000'}
                                        onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'textColor', e.target.value)}
                                    />
                                    <Input
                                        className="flex-1 h-8 text-xs font-mono uppercase"
                                        value={(selectedSection.styles?.textColor as string) || '#000000'}
                                        onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'textColor', e.target.value)}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Padding (px)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground">Top / Bottom</Label>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            value={(selectedSection.styles?.paddingY as number) || 48}
                                            onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'paddingY', Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground">Left / Right</Label>
                                        <Input
                                            type="number"
                                            className="h-8 text-xs"
                                            value={(selectedSection.styles?.paddingX as number) || 24}
                                            onChange={(e) => onUpdateSection(selectedSection.id, 'styles', 'paddingX', Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground">Layout Width</Label>
                                <Select
                                    value={(selectedSection.styles?.maxWidth as string) || 'container'}
                                    onValueChange={(val) => onUpdateSection(selectedSection.id, 'styles', 'maxWidth', val)}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="full">Full Width</SelectItem>
                                        <SelectItem value="container">Container (1200px)</SelectItem>
                                        <SelectItem value="narrow">Narrow (800px)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                {/* Responsive Tab */}
                <TabsContent value="responsive" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <ScrollArea className="h-full p-4">
                        <div className="space-y-4">
                            <div className="bg-muted/50 rounded-lg p-3 text-center text-xs text-muted-foreground border">
                                <Smartphone className="w-6 h-6 opacity-30 mx-auto mb-2" />
                                <p className="font-medium mb-1">Responsive Controls</p>
                                <p>Override padding, font sizes, and visibility per device breakpoint.</p>
                            </div>

                            {(['mobile', 'tablet', 'desktop'] as const).map((device) => (
                                <div key={device} className="space-y-2 border rounded-md p-3">
                                    <Label className="text-xs font-semibold capitalize">{device}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Pad Y</Label>
                                            <Input
                                                type="number"
                                                className="h-7 text-xs"
                                                placeholder="inherit"
                                                value={(selectedSection.responsive?.[device]?.paddingY as number) ?? ''}
                                                onChange={(e) => {
                                                    if (onUpdateResponsive) {
                                                        onUpdateResponsive(selectedSection.id, device, 'paddingY', e.target.value ? Number(e.target.value) : undefined);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground">Pad X</Label>
                                            <Input
                                                type="number"
                                                className="h-7 text-xs"
                                                placeholder="inherit"
                                                value={(selectedSection.responsive?.[device]?.paddingX as number) ?? ''}
                                                onChange={(e) => {
                                                    if (onUpdateResponsive) {
                                                        onUpdateResponsive(selectedSection.id, device, 'paddingX', e.target.value ? Number(e.target.value) : undefined);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
        </div>
    );
}
