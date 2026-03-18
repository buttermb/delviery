/**
 * BuilderThemePanel
 * UI for managing global storefront theme colors and typography
 */

import { Paintbrush } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemePresetGrid } from '@/components/admin/storefront/ThemePresetSelector';
import { type ThemeConfig } from './storefront-builder.config';

interface BuilderThemePanelProps {
    themeConfig: ThemeConfig;
    setThemeConfig: React.Dispatch<React.SetStateAction<ThemeConfig>>;
    selectedThemeId?: string;
    onSelectThemePreset: (preset: any) => void;
}

export function BuilderThemePanel({
    themeConfig,
    setThemeConfig,
    selectedThemeId,
    onSelectThemePreset
}: BuilderThemePanelProps) {
    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b shrink-0 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Paintbrush className="w-4 h-4" />
                <span>Store Theme</span>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-muted-foreground">Presets</Label>
                        <ThemePresetGrid
                            selectedThemeId={selectedThemeId}
                            onSelectTheme={onSelectThemePreset}
                        />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-muted-foreground">Global Colors</Label>
                        <div className="grid gap-3 border rounded-md p-3 bg-muted/20">
                            {(['primary', 'secondary', 'accent', 'background', 'text'] as const).map(colorKey => (
                                <div key={colorKey} className="flex items-center justify-between group">
                                    <Label className="text-xs font-medium cursor-pointer" htmlFor={`color-${colorKey}`}>{colorKey.charAt(0).toUpperCase() + colorKey.slice(1)}</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={`color-${colorKey}`}
                                            type="color"
                                            className="w-7 h-7 p-0 border-0 cursor-pointer rounded overflow-hidden"
                                            value={themeConfig.colors?.[colorKey] || '#000000'}
                                            onChange={(e) => setThemeConfig(prev => ({
                                                ...prev,
                                                colors: { ...prev.colors, [colorKey]: e.target.value }
                                            }))}
                                        />
                                        <Input
                                            className="w-20 h-7 text-xs font-mono uppercase bg-background"
                                            value={themeConfig.colors?.[colorKey] || '#000000'}
                                            onChange={(e) => setThemeConfig(prev => ({
                                                ...prev,
                                                colors: { ...prev.colors, [colorKey]: e.target.value }
                                            }))}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <Label className="text-sm font-semibold text-muted-foreground">Typography</Label>
                        <div className="border rounded-md p-3 bg-muted/20 space-y-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Primary Font</Label>
                                <Select
                                    value={themeConfig.typography?.fontFamily || 'Inter'}
                                    onValueChange={(value) => setThemeConfig(prev => ({
                                        ...prev,
                                        typography: { ...prev.typography, fontFamily: value }
                                    }))}
                                >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select font" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Inter"><span style={{ fontFamily: 'Inter' }}>Inter</span></SelectItem>
                                        <SelectItem value="Space Grotesk"><span style={{ fontFamily: 'Space Grotesk' }}>Space Grotesk</span></SelectItem>
                                        <SelectItem value="DM Sans"><span style={{ fontFamily: 'DM Sans' }}>DM Sans</span></SelectItem>
                                        <SelectItem value="Playfair Display"><span style={{ fontFamily: 'Playfair Display' }}>Playfair Display</span></SelectItem>
                                        <SelectItem value="Montserrat"><span style={{ fontFamily: 'Montserrat' }}>Montserrat</span></SelectItem>
                                        <SelectItem value="Outfit"><span style={{ fontFamily: 'Outfit' }}>Outfit</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
