import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { sanitizeHtml } from '@/lib/utils/sanitize';
import { type SectionEditorProps, ColorField } from '@/components/admin/storefront/SectionEditors';

export default function CustomHTMLEditor({ section, onUpdateContent, onUpdateStyles }: SectionEditorProps) {
    const content = section.content as Record<string, unknown>;
    const styles = section.styles as Record<string, unknown>;
    const [showPreview, setShowPreview] = useState(false);

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['content', 'styles']} className="w-full">
                <AccordionItem value="content">
                    <AccordionTrigger className="text-sm font-medium">Content</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Section Title (optional)</Label>
                            <Input
                                value={(content.section_title as string) ?? ''}
                                onChange={(e) => onUpdateContent('section_title', e.target.value)}
                                placeholder="Optional title above HTML"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">HTML Content</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => setShowPreview(!showPreview)}
                                >
                                    {showPreview ? 'Edit' : 'Preview'}
                                </Button>
                            </div>
                            {showPreview ? (
                                <div
                                    className="p-3 border rounded-lg min-h-[120px] prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: sanitizeHtml((content.html_content as string) ?? '') }}
                                />
                            ) : (
                                <Textarea
                                    value={(content.html_content as string) ?? ''}
                                    onChange={(e) => onUpdateContent('html_content', e.target.value)}
                                    placeholder="<p>Your HTML content here</p>"
                                    rows={8}
                                    className="text-xs font-mono"
                                />
                            )}
                            <p className="text-xs text-muted-foreground">
                                HTML is sanitized for security. Allowed tags: p, br, strong, em, u, a, ul, ol, li, h1-h6, span, div, img.
                            </p>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="styles">
                    <AccordionTrigger className="text-sm font-medium">Layout &amp; Colors</AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField
                            label="Background"
                            value={(styles.background_color as string) || '#ffffff'}
                            onChange={(v) => onUpdateStyles('background_color', v)}
                        />
                        <ColorField
                            label="Text Color"
                            value={(styles.text_color as string) || '#000000'}
                            onChange={(v) => onUpdateStyles('text_color', v)}
                        />
                        <div className="space-y-1.5">
                            <Label className="text-xs">Vertical Padding</Label>
                            <Select
                                value={(styles.padding_y as string) || '4rem'}
                                onValueChange={(v) => onUpdateStyles('padding_y', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select padding" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2rem">Small (2rem)</SelectItem>
                                    <SelectItem value="4rem">Medium (4rem)</SelectItem>
                                    <SelectItem value="6rem">Large (6rem)</SelectItem>
                                    <SelectItem value="8rem">Extra Large (8rem)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Max Width</Label>
                            <Select
                                value={(styles.max_width as string) || '1200px'}
                                onValueChange={(v) => onUpdateStyles('max_width', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select width" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="800px">Narrow (800px)</SelectItem>
                                    <SelectItem value="1000px">Medium (1000px)</SelectItem>
                                    <SelectItem value="1200px">Wide (1200px)</SelectItem>
                                    <SelectItem value="100%">Full Width</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
