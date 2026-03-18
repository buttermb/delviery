/**
 * BuilderTemplateGallery
 * Visual picker for predefined storefront layout templates
 */

import { useState } from 'react';
import { LayoutTemplate, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TEMPLATES, SECTION_REGISTRY, type TemplateKey } from './storefront-builder.config';

interface BuilderTemplateGalleryProps {
    onApplyTemplate: (templateKey: TemplateKey) => void;
}

export function BuilderTemplateGallery({ onApplyTemplate }: BuilderTemplateGalleryProps) {
    const [pendingTemplate, setPendingTemplate] = useState<{ key: TemplateKey; name: string } | null>(null);

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b shrink-0 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <LayoutTemplate className="w-4 h-4" />
                <span>Templates</span>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    <div>
                        <Label className="text-sm font-semibold text-muted-foreground">Starter Layouts</Label>
                        <p className="text-xs text-muted-foreground mt-1">Replace your current layout with a pre-built structure.</p>
                    </div>
                    
                    <div className="grid gap-3">
                        {Object.entries(TEMPLATES).map(([key, template]) => (
                            <Card
                                key={key}
                                className="cursor-pointer border-border hover:border-primary transition-all hover:bg-muted/30 group"
                                onClick={() => setPendingTemplate({ key: key as TemplateKey, name: template.name })}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-sm group-hover:text-primary transition-colors">{template.name}</p>
                                            <p className="text-xs text-muted-foreground">{template.description}</p>
                                        </div>
                                        <FileText className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {template.sections.map((s, i) => (
                                            <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded border font-medium text-muted-foreground">
                                                {SECTION_REGISTRY[s as keyof typeof SECTION_REGISTRY]?.label.split(' ')[0] || s}
                                            </span>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </ScrollArea>

            <AlertDialog open={!!pendingTemplate} onOpenChange={(open) => !open && setPendingTemplate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apply Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Applying "{pendingTemplate?.name}" will replace your current section layout. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (pendingTemplate) {
                                onApplyTemplate(pendingTemplate.key);
                                setPendingTemplate(null);
                            }
                        }}>
                            Apply Template
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
