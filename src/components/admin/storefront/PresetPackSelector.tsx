/**
 * PresetPackSelector Component
 * Grid of preset pack cards for one-click storefront setup
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Rocket from "lucide-react/dist/esm/icons/rocket";
import Sun from "lucide-react/dist/esm/icons/sun";
import Briefcase from "lucide-react/dist/esm/icons/briefcase";
import Leaf from "lucide-react/dist/esm/icons/leaf";
import Crown from "lucide-react/dist/esm/icons/crown";
import Megaphone from "lucide-react/dist/esm/icons/megaphone";
import Check from "lucide-react/dist/esm/icons/check";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { type PresetPack, PRESET_PACKS, getPresetTheme } from '@/lib/storefrontPresets';

interface PresetPackSelectorProps {
    selectedPresetId: string | null;
    onSelectPreset: (presetId: string) => void;
    showCategoryTabs?: boolean;
}

const ICON_MAP = {
    rocket: Rocket,
    sun: Sun,
    briefcase: Briefcase,
    leaf: Leaf,
    crown: Crown,
    megaphone: Megaphone,
} as const;

const CATEGORY_LABELS = {
    'quick-start': 'Quick Start',
    professional: 'Professional',
    premium: 'Premium',
} as const;

export function PresetPackSelector({
    selectedPresetId,
    onSelectPreset,
    showCategoryTabs = false,
}: PresetPackSelectorProps) {
    const categories = ['quick-start', 'professional', 'premium'] as const;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4" />
                    <span>Choose Your Starting Point</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    One-click setup with theme, layout, and settings - you can always customize later
                </p>
            </div>

            {/* Preset Grid - 2 cols on tablet, 3 on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {PRESET_PACKS.map(preset => (
                    <PresetPackCard
                        key={preset.id}
                        preset={preset}
                        isSelected={selectedPresetId === preset.id}
                        onSelect={() => onSelectPreset(preset.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface PresetPackCardProps {
    preset: PresetPack;
    isSelected: boolean;
    onSelect: () => void;
}

function PresetPackCard({ preset, isSelected, onSelect }: PresetPackCardProps) {
    const Icon = ICON_MAP[preset.icon];
    const theme = getPresetTheme(preset);

    // Get theme colors for preview
    const primaryColor = theme?.colors.primary || '#000000';
    const backgroundColor = theme?.colors.background || '#ffffff';
    const accentColor = theme?.colors.accent || '#10b981';
    const isDark = theme?.darkMode ?? false;

    return (
        <Card
            className={cn(
                'relative cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden group',
                isSelected
                    ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
                    : 'hover:border-primary/50'
            )}
            onClick={onSelect}
        >
            {/* Selected indicator */}
            {isSelected && (
                <div className="absolute top-3 right-3 z-10">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                </div>
            )}

            {/* Color preview strip */}
            <div
                className="h-20 relative overflow-hidden"
                style={{ backgroundColor }}
            >
                {/* Simulated UI preview */}
                <div className="absolute inset-0 p-3 flex flex-col">
                    {/* Mini navbar */}
                    <div className="flex items-center justify-between mb-2">
                        <div
                            className="w-16 h-2 rounded"
                            style={{ backgroundColor: isDark ? '#ffffff30' : '#00000020' }}
                        />
                        <div className="flex gap-1">
                            <div
                                className="w-6 h-2 rounded"
                                style={{ backgroundColor: isDark ? '#ffffff20' : '#00000010' }}
                            />
                            <div
                                className="w-6 h-2 rounded"
                                style={{ backgroundColor: isDark ? '#ffffff20' : '#00000010' }}
                            />
                        </div>
                    </div>
                    {/* Mini hero */}
                    <div className="flex-1 flex flex-col justify-center">
                        <div
                            className="w-20 h-2 rounded mb-1"
                            style={{ backgroundColor: primaryColor }}
                        />
                        <div
                            className="w-12 h-1.5 rounded"
                            style={{ backgroundColor: isDark ? '#ffffff40' : '#00000030' }}
                        />
                    </div>
                    {/* Mini CTA button */}
                    <div
                        className="w-8 h-2 rounded self-start"
                        style={{ backgroundColor: accentColor }}
                    />
                </div>
            </div>

            <CardContent className="p-5">
                {/* Icon and name */}
                <div className="flex items-start gap-3 mb-3">
                    <div
                        className="p-2.5 rounded-xl shrink-0"
                        style={{ backgroundColor: `${primaryColor}15` }}
                    >
                        <Icon className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base">{preset.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            {preset.tagline}
                        </p>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                    {preset.description}
                </p>

                {/* Category badge and template indicator */}
                <div className="flex items-center justify-between">
                    <Badge
                        variant="secondary"
                        className="text-xs px-3 py-1"
                    >
                        {CATEGORY_LABELS[preset.category]}
                    </Badge>

                    {/* Template indicator */}
                    <span className="text-sm text-muted-foreground font-medium">
                        {preset.templateId === 'minimal' && '2 sections'}
                        {preset.templateId === 'standard' && '3 sections'}
                        {preset.templateId === 'full' && '6 sections'}
                        {preset.templateId === 'landing' && '4 sections'}
                    </span>
                </div>

                {/* Recommended for tags */}
                {preset.recommendedFor.length > 0 && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
                        {preset.recommendedFor.slice(0, 3).map(tag => (
                            <span
                                key={tag}
                                className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Compact inline strip version for smaller spaces
 */
export function PresetPackStrip({
    selectedPresetId,
    onSelectPreset,
}: PresetPackSelectorProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            {PRESET_PACKS.map(preset => {
                const Icon = ICON_MAP[preset.icon];
                const theme = getPresetTheme(preset);
                const isSelected = selectedPresetId === preset.id;

                return (
                    <button
                        key={preset.id}
                        onClick={() => onSelectPreset(preset.id)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0',
                            isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        )}
                    >
                        {/* Color dot */}
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: theme?.colors.primary || '#000' }}
                        />
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium whitespace-nowrap">
                            {preset.name}
                        </span>
                        {isSelected && (
                            <Check className="w-4 h-4 text-primary ml-1" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
