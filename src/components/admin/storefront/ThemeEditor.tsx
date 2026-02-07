/**
 * ThemeEditor Component
 * Full theme customization with color pickers, font selectors, and custom CSS textarea.
 * Saves and loads CustomTheme from the database via marketplace_stores.theme_config.
 */

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Palette, Type, Spacing, Sparkles, Code } from 'lucide-react';
import { logger } from '@/lib/logger';
import {
    type CustomTheme,
    DEFAULT_CUSTOM_THEME,
    FONT_OPTIONS,
    customThemeToCSS,
} from '@/lib/storefrontThemes';

interface ThemeEditorProps {
    theme: CustomTheme;
    onChange: (theme: CustomTheme) => void;
    onSave?: (theme: CustomTheme) => void;
    isSaving?: boolean;
}

/** Color picker + hex input combo field */
function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <div className="flex gap-2 items-center">
                <Input
                    type="color"
                    className="w-8 h-8 p-0 border-0 cursor-pointer rounded"
                    value={value || '#000000'}
                    onChange={(e) => onChange(e.target.value)}
                />
                <Input
                    className="flex-1 h-8 text-xs font-mono"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="#000000"
                />
            </div>
        </div>
    );
}

export function ThemeEditor({ theme, onChange, onSave, isSaving }: ThemeEditorProps) {
    const [previewCSS, setPreviewCSS] = useState('');

    const updateColor = useCallback(
        (key: keyof CustomTheme['colors'], value: string) => {
            onChange({
                ...theme,
                colors: { ...theme.colors, [key]: value },
            });
        },
        [theme, onChange]
    );

    const updateTypography = useCallback(
        (key: keyof CustomTheme['typography'], value: string) => {
            onChange({
                ...theme,
                typography: { ...theme.typography, [key]: value },
            });
        },
        [theme, onChange]
    );

    const updateSpacing = useCallback(
        (key: keyof CustomTheme['spacing'], value: string) => {
            onChange({
                ...theme,
                spacing: { ...theme.spacing, [key]: value },
            });
        },
        [theme, onChange]
    );

    const updateEffects = useCallback(
        (key: keyof CustomTheme['effects'], value: string) => {
            onChange({
                ...theme,
                effects: { ...theme.effects, [key]: value },
            });
        },
        [theme, onChange]
    );

    const updateCustomCSS = useCallback(
        (value: string) => {
            onChange({ ...theme, customCSS: value });
        },
        [theme, onChange]
    );

    const handlePreviewCSS = useCallback(() => {
        const css = customThemeToCSS(theme);
        setPreviewCSS(css);
        logger.debug('Generated theme CSS preview', { themeColors: theme.colors });
    }, [theme]);

    const handleReset = useCallback(() => {
        onChange(DEFAULT_CUSTOM_THEME);
        logger.debug('Theme reset to defaults');
    }, [onChange]);

    return (
        <div className="space-y-4">
            <Accordion type="multiple" defaultValue={['colors', 'typography', 'spacing', 'css']} className="w-full">
                {/* Colors Section */}
                <AccordionItem value="colors">
                    <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Palette className="w-4 h-4 text-muted-foreground" />
                            Colors
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <ColorField label="Background" value={theme.colors.background} onChange={(v) => updateColor('background', v)} />
                        <ColorField label="Text" value={theme.colors.text} onChange={(v) => updateColor('text', v)} />
                        <ColorField label="Primary" value={theme.colors.primary} onChange={(v) => updateColor('primary', v)} />
                        <ColorField label="Accent" value={theme.colors.accent} onChange={(v) => updateColor('accent', v)} />
                        <ColorField label="Muted" value={theme.colors.muted} onChange={(v) => updateColor('muted', v)} />
                        <ColorField label="Border" value={theme.colors.border} onChange={(v) => updateColor('border', v)} />
                    </AccordionContent>
                </AccordionItem>

                {/* Typography Section */}
                <AccordionItem value="typography">
                    <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Type className="w-4 h-4 text-muted-foreground" />
                            Typography
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Heading Font</Label>
                            <Select value={theme.typography.headingFont} onValueChange={(v) => updateTypography('headingFont', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FONT_OPTIONS.map((font) => (
                                        <SelectItem key={font.value} value={font.value}>
                                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Body Font</Label>
                            <Select value={theme.typography.bodyFont} onValueChange={(v) => updateTypography('bodyFont', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FONT_OPTIONS.map((font) => (
                                        <SelectItem key={font.value} value={font.value}>
                                            <span style={{ fontFamily: font.value }}>{font.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Base Font Size</Label>
                            <Select value={theme.typography.baseFontSize} onValueChange={(v) => updateTypography('baseFontSize', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="14px">14px (Small)</SelectItem>
                                    <SelectItem value="15px">15px</SelectItem>
                                    <SelectItem value="16px">16px (Default)</SelectItem>
                                    <SelectItem value="17px">17px</SelectItem>
                                    <SelectItem value="18px">18px (Large)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Font Preview */}
                        <Card className="bg-muted/50">
                            <CardContent className="p-3">
                                <p
                                    className="text-lg font-bold mb-1"
                                    style={{ fontFamily: theme.typography.headingFont }}
                                >
                                    Heading Preview
                                </p>
                                <p
                                    className="text-sm"
                                    style={{
                                        fontFamily: theme.typography.bodyFont,
                                        fontSize: theme.typography.baseFontSize,
                                    }}
                                >
                                    Body text preview with selected font.
                                </p>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* Spacing & Effects Section */}
                <AccordionItem value="spacing">
                    <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            Spacing &amp; Effects
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Border Radius</Label>
                            <Select value={theme.spacing.borderRadius} onValueChange={(v) => updateSpacing('borderRadius', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0px">None (0px)</SelectItem>
                                    <SelectItem value="2px">Sharp (2px)</SelectItem>
                                    <SelectItem value="4px">Subtle (4px)</SelectItem>
                                    <SelectItem value="8px">Medium (8px)</SelectItem>
                                    <SelectItem value="12px">Rounded (12px)</SelectItem>
                                    <SelectItem value="16px">Extra Rounded (16px)</SelectItem>
                                    <SelectItem value="9999px">Pill</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Radius preview */}
                            <div className="flex gap-2 pt-1">
                                <div
                                    className="w-12 h-8 bg-primary/20 border"
                                    style={{ borderRadius: theme.spacing.borderRadius }}
                                />
                                <div
                                    className="flex-1 h-8 bg-primary/10 border"
                                    style={{ borderRadius: theme.spacing.borderRadius }}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Section Spacing</Label>
                            <Select value={theme.spacing.sectionSpacing} onValueChange={(v) => updateSpacing('sectionSpacing', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2rem">Compact (2rem)</SelectItem>
                                    <SelectItem value="4rem">Normal (4rem)</SelectItem>
                                    <SelectItem value="6rem">Spacious (6rem)</SelectItem>
                                    <SelectItem value="8rem">Airy (8rem)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Card Shadow</Label>
                            <Select
                                value={theme.effects.cardShadow}
                                onValueChange={(v) => updateEffects('cardShadow', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="0 1px 3px rgba(0,0,0,0.08)">Subtle</SelectItem>
                                    <SelectItem value="0 4px 12px rgba(0,0,0,0.1)">Medium</SelectItem>
                                    <SelectItem value="0 10px 40px rgba(0,0,0,0.15)">Bold</SelectItem>
                                    <SelectItem value="0 25px 60px rgba(0,0,0,0.25)">Dramatic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Backdrop Blur</Label>
                            <Select
                                value={theme.effects.backdropBlur}
                                onValueChange={(v) => updateEffects('backdropBlur', v)}
                            >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0px">None</SelectItem>
                                    <SelectItem value="4px">Light (4px)</SelectItem>
                                    <SelectItem value="8px">Medium (8px)</SelectItem>
                                    <SelectItem value="16px">Heavy (16px)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Custom CSS Section */}
                <AccordionItem value="css">
                    <AccordionTrigger className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-muted-foreground" />
                            Custom CSS
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 pt-2">
                        <p className="text-xs text-muted-foreground">
                            Add custom CSS rules. Use <code className="bg-muted px-1 rounded">--storefront-*</code> variables for consistency.
                        </p>
                        <Textarea
                            value={theme.customCSS}
                            onChange={(e) => updateCustomCSS(e.target.value)}
                            placeholder={`.storefront-hero {\n  background: linear-gradient(...);\n}\n\n.product-card:hover {\n  transform: scale(1.02);\n}`}
                            rows={8}
                            className="font-mono text-xs"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={handlePreviewCSS}
                        >
                            Preview Generated CSS
                        </Button>
                        {previewCSS && (
                            <pre className="p-3 bg-muted rounded text-xs font-mono overflow-auto max-h-40">
                                {previewCSS}
                            </pre>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <Separator />

            {/* Actions */}
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleReset} className="flex-1">
                    Reset to Defaults
                </Button>
                {onSave && (
                    <Button
                        size="sm"
                        onClick={() => onSave(theme)}
                        disabled={isSaving}
                        className="flex-1"
                    >
                        {isSaving ? 'Saving...' : 'Save Theme'}
                    </Button>
                )}
            </div>
        </div>
    );
}
