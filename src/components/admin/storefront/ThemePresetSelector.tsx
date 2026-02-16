/**
 * Theme Preset Selector Component
 * Displays theme presets with live preview and one-click application
 * Following FloraIQ patterns: interfaces, @/ imports, no `any`
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Palette, Check, Moon, Sun, Sparkles, Crown, Leaf } from 'lucide-react';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { THEME_PRESETS, type ThemePreset } from '@/lib/storefrontThemes';

interface ThemePresetSelectorProps {
    onSelectTheme: (theme: ThemePreset) => void;
    selectedThemeId?: string;
    trigger?: React.ReactNode;
}

const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    'dark-mode': Moon,
    'minimalist': Sun,
    'strain-focused': Leaf,
    'luxury': Crown,
};

/**
 * Theme preview card component
 */
function ThemePreviewCard({
    theme,
    isSelected,
    onSelect,
}: {
    theme: ThemePreset;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const Icon = THEME_ICONS[theme.id] || Palette;

    return (
        <Card
            className={cn(
                'cursor-pointer transition-all duration-200 overflow-hidden group',
                isSelected
                    ? 'ring-2 ring-primary ring-offset-2'
                    : 'hover:shadow-lg hover:border-primary/30'
            )}
            onClick={onSelect}
        >
            {/* Theme Preview Swatch */}
            <div
                className="h-24 relative overflow-hidden"
                style={{ backgroundColor: theme.colors.background }}
            >
                {/* Mock UI elements showing theme colors */}
                <div className="absolute inset-2 flex flex-col gap-1.5">
                    {/* Header bar */}
                    <div
                        className="h-3 rounded-sm"
                        style={{ backgroundColor: theme.colors.card }}
                    />
                    {/* Content area */}
                    <div className="flex-1 flex gap-1.5">
                        <div
                            className="w-1/3 rounded-sm"
                            style={{ backgroundColor: theme.colors.primary }}
                        />
                        <div className="flex-1 flex flex-col gap-1">
                            <div
                                className="h-2 rounded-sm w-3/4"
                                style={{ backgroundColor: theme.colors.muted }}
                            />
                            <div
                                className="h-2 rounded-sm w-1/2"
                                style={{ backgroundColor: theme.colors.muted }}
                            />
                        </div>
                    </div>
                    {/* Footer with accent */}
                    <div
                        className="h-4 rounded-sm flex items-center justify-center"
                        style={{ backgroundColor: theme.colors.accent }}
                    >
                        <div
                            className="h-2 w-12 rounded-sm"
                            style={{ backgroundColor: theme.colors.accentForeground, opacity: 0.6 }}
                        />
                    </div>
                </div>

                {/* Selected checkmark */}
                {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                )}
            </div>

            <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-sm">{theme.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {theme.tagline}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {theme.typography.fonts.heading} / {theme.typography.fonts.body}
                        </p>
                    </div>
                    {theme.darkMode && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Dark
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Main theme preset selector component
 */
export function ThemePresetSelector({
    onSelectTheme,
    selectedThemeId,
    trigger,
}: ThemePresetSelectorProps) {
    const [open, setOpen] = useState(false);
    const [previewTheme, _setPreviewTheme] = useState<ThemePreset | null>(null);

    const handleSelect = (theme: ThemePreset) => {
        logger.debug('Theme selected', { themeId: theme.id });
        onSelectTheme(theme);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="gap-2">
                        <Palette className="h-4 w-4" />
                        Choose Theme
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-500" />
                        Choose a Theme
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="grid grid-cols-2 gap-4 p-1">
                        {THEME_PRESETS.map((theme) => (
                            <ThemePreviewCard
                                key={theme.id}
                                theme={theme}
                                isSelected={selectedThemeId === theme.id}
                                onSelect={() => handleSelect(theme)}
                            />
                        ))}
                    </div>
                </ScrollArea>

                {/* Quick preview section */}
                {previewTheme && (
                    <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold">{previewTheme.name}</h4>
                                <p className="text-sm text-muted-foreground">{previewTheme.description}</p>
                            </div>
                            <Button onClick={() => handleSelect(previewTheme)}>
                                Apply Theme
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Compact theme selector for inline use
 */
export function ThemePresetStrip({
    onSelectTheme,
    selectedThemeId,
}: Omit<ThemePresetSelectorProps, 'trigger'>) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2">
            {THEME_PRESETS.map((theme) => {
                const _Icon = THEME_ICONS[theme.id] || Palette;
                const isSelected = selectedThemeId === theme.id;

                return (
                    <button
                        key={theme.id}
                        onClick={() => onSelectTheme(theme)}
                        className={cn(
                            'flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all',
                            'active:scale-95 touch-manipulation',
                            isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-muted hover:border-muted-foreground/30'
                        )}
                    >
                        <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: theme.colors.primary }}
                        />
                        <span className="text-sm font-medium whitespace-nowrap">{theme.name}</span>
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                    </button>
                );
            })}
        </div>
    );
}

