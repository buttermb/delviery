/**
 * BuilderPropertyEditor
 * Right sidebar panel for editing content and styles of the selected section
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { type SectionConfig, SECTION_TYPES, sectionDefaults } from './storefront-builder.config';

interface BuilderPropertyEditorProps {
    selectedSection: SectionConfig;
    onClose: () => void;
    onUpdateSection: (id: string, field: 'content' | 'styles', key: string, value: unknown) => void;
}

export function BuilderPropertyEditor({
    selectedSection,
    onClose,
    onUpdateSection,
}: BuilderPropertyEditorProps) {
    return (
        <div className="w-72 bg-background border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200">
            <div className="p-4 border-b flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Editing</h3>
                    <p className="font-medium text-sm">{SECTION_TYPES[selectedSection.type as keyof typeof SECTION_TYPES]?.label}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
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
                                        value={(selectedSection.content[key] as string) || ''}
                                        onChange={(e) => onUpdateSection(selectedSection.id, 'content', key, e.target.value)}
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
                                                    value={(selectedSection.styles[key] as string) || '#ffffff'}
                                                    onChange={(e) => onUpdateSection(selectedSection.id, 'styles', key, e.target.value)}
                                                />
                                                <Input
                                                    type="text"
                                                    value={(selectedSection.styles[key] as string) || ''}
                                                    onChange={(e) => onUpdateSection(selectedSection.id, 'styles', key, e.target.value)}
                                                    className="flex-1"
                                                />
                                            </div>
                                        ) : (
                                            <Input
                                                value={(selectedSection.styles[key] as string) || ''}
                                                onChange={(e) => onUpdateSection(selectedSection.id, 'styles', key, e.target.value)}
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
    );
}
