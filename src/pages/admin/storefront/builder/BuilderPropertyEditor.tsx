/**
 * BuilderPropertyEditor
 * Right sidebar panel for editing content and styles of the selected section.
 * Delegates to the rich SectionEditor which provides specialised UIs per section type
 * (FAQ add/remove, gallery image management, HTML preview, star ratings, etc.).
 */

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SectionEditor } from '@/components/admin/storefront/SectionEditors';
import { type SectionConfig, SECTION_TYPES } from './storefront-builder.config';

interface BuilderPropertyEditorProps {
    selectedSection: SectionConfig;
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
    return (
        <div className="w-72 bg-background border-l flex flex-col shrink-0 z-10 animate-in slide-in-from-right-10 duration-200">
            <div className="p-4 border-b flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Editing</h3>
                    <p className="font-medium text-sm">{SECTION_TYPES[selectedSection.type as keyof typeof SECTION_TYPES]?.label}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClose} aria-label="Close property editor">
                    <X className="w-4 h-4" />
                </Button>
            </div>
            <ScrollArea className="flex-1 p-4">
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
        </div>
    );
}
