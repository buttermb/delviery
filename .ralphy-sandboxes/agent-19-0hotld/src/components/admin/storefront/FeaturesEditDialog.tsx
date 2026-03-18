/**
 * FeaturesEditDialog
 * Full-screen dialog for editing features section items with an icon picker.
 * Supports add/remove feature items, icon selection from lucide-react,
 * and inline title/description editing.
 */

import { useState, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { FEATURES_ICON_MAP, type FeatureIconKey } from '@/components/shop/sections/featuresIconMap';

interface FeatureItem {
    icon: string;
    title: string;
    description: string;
}

interface FeaturesEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    features: FeatureItem[];
    onSave: (features: FeatureItem[]) => void;
}

const ICON_KEYS = Object.keys(FEATURES_ICON_MAP) as FeatureIconKey[];

function IconPickerPopover({
    value,
    onChange,
}: {
    value: string;
    onChange: (icon: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search) return ICON_KEYS;
        const lower = search.toLowerCase();
        return ICON_KEYS.filter((key) => key.includes(lower));
    }, [search]);

    const SelectedIcon = FEATURES_ICON_MAP[value as FeatureIconKey];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full justify-between gap-2 text-xs"
                >
                    <span className="flex items-center gap-2">
                        {SelectedIcon ? (
                            <SelectedIcon className="w-4 h-4" />
                        ) : null}
                        <span className="capitalize">{value.replace(/-/g, ' ')}</span>
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <div className="p-2 border-b">
                    <Input
                        placeholder="Search icons..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs"
                    />
                </div>
                <ScrollArea className="h-48">
                    <div className="grid grid-cols-6 gap-1 p-2">
                        {filtered.map((key) => {
                            const Icon = FEATURES_ICON_MAP[key];
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`flex items-center justify-center w-9 h-9 rounded-md transition-colors ${
                                        value === key
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                        onChange(key);
                                        setOpen(false);
                                        setSearch('');
                                    }}
                                    title={key}
                                >
                                    <Icon className="w-4 h-4" />
                                </button>
                            );
                        })}
                        {filtered.length === 0 && (
                            <div className="col-span-6 py-4 text-center text-xs text-muted-foreground">
                                No icons found
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export function FeaturesEditDialog({
    open,
    onOpenChange,
    features: initialFeatures,
    onSave,
}: FeaturesEditDialogProps) {
    const [features, setFeatures] = useState<FeatureItem[]>([]);

    // Sync local state when dialog opens
    const handleOpenChange = useCallback(
        (newOpen: boolean) => {
            if (newOpen) {
                setFeatures(initialFeatures.length > 0 ? [...initialFeatures] : [
                    { icon: 'clock', title: 'Fast Delivery', description: 'Quick and reliable service.' },
                    { icon: 'shield', title: 'Quality Assured', description: 'Lab-tested for your safety.' },
                    { icon: 'star', title: 'Premium Selection', description: 'Hand-picked products.' },
                ]);
            }
            onOpenChange(newOpen);
        },
        [initialFeatures, onOpenChange],
    );

    const updateFeature = (index: number, key: keyof FeatureItem, value: string) => {
        setFeatures((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [key]: value };
            return updated;
        });
    };

    const addFeature = () => {
        setFeatures((prev) => [
            ...prev,
            { icon: 'star', title: 'New Feature', description: 'Feature description' },
        ]);
    };

    const removeFeature = (index: number) => {
        setFeatures((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onSave(features);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Edit Features</DialogTitle>
                    <DialogDescription>
                        Add, remove, and customize feature items with icons.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-4 py-2">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="p-4 border rounded-lg space-y-3 relative group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Feature {index + 1}
                                        </span>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeFeature(index)}
                                        aria-label={`Remove feature ${index + 1}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Icon</Label>
                                    <IconPickerPopover
                                        value={feature.icon}
                                        onChange={(icon) => updateFeature(index, 'icon', icon)}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Title</Label>
                                    <Input
                                        value={feature.title}
                                        onChange={(e) =>
                                            updateFeature(index, 'title', e.target.value)
                                        }
                                        placeholder="Feature title"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Description</Label>
                                    <Textarea
                                        value={feature.description}
                                        onChange={(e) =>
                                            updateFeature(index, 'description', e.target.value)
                                        }
                                        placeholder="Feature description"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        ))}

                        {features.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No features yet. Add one to get started.
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <div className="pt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={addFeature}
                    >
                        <Plus className="w-4 h-4 mr-1.5" /> Add Feature
                    </Button>
                </div>

                <DialogFooter className="pt-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        Save Features
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
