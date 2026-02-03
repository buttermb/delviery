import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Palette from "lucide-react/dist/esm/icons/palette";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import Layout from "lucide-react/dist/esm/icons/layout";
import Box from "lucide-react/dist/esm/icons/box";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { ThemePresetSelector, ThemePresetStrip } from "@/components/admin/storefront/ThemePresetSelector";
import { type ThemePreset, THEME_PRESETS } from "@/lib/storefrontThemes";
import { useToast } from "@/hooks/use-toast";
import { StorefrontBannerManager } from "@/components/admin/storefront/StorefrontBannerManager";

interface SectionConfig {
    id: string;
    type: string;
    content: Record<string, unknown>;
    styles: Record<string, unknown>;
    visible?: boolean;
}

interface SimpleViewProps {
    storeId: string;
    storeSlug: string;
    layoutConfig: SectionConfig[];
    setLayoutConfig: (config: SectionConfig[]) => void;
    themeConfig: any;
    setThemeConfig: (config: any) => void;
    onSave: () => void;
    onPublish: () => void;
    isSaving: boolean;
}

export function SimpleStorefrontEditor({
    storeId,
    storeSlug,
    layoutConfig,
    setLayoutConfig,
    themeConfig,
    setThemeConfig,
    onSave,
    onPublish,
    isSaving
}: SimpleViewProps) {
    const { toast } = useToast();
    const [selectedThemeId, setSelectedThemeId] = useState<string>('minimalist');

    // Helper to find specific section visibility
    const isSectionVisible = (type: string) => {
        return layoutConfig.find(s => s.type === type)?.visible !== false;
    };

    // Helper to toggle section visibility
    const toggleSection = (type: string, visible: boolean) => {
        const sectionIndex = layoutConfig.findIndex(s => s.type === type);

        if (sectionIndex >= 0) {
            // Update existing
            const newConfig = [...layoutConfig];
            newConfig[sectionIndex] = { ...newConfig[sectionIndex], visible };
            setLayoutConfig(newConfig);
        } else if (visible) {
            // Config doesn't exist but we want it visible -> Add it
            // Note: In a real app we'd need default content here, 
            // but for now we assume the builder initializes with sections or we rely on the parent to handle defaults.
            // Simplified: we just won't add it if it's missing in simple mode, 
            // assuming the template was applied correctly.
            toast({
                title: "Section not found",
                description: "Switch to Advanced Mode to add this section first.",
            });
        }
    };

    // Specific toggles
    const showHero = isSectionVisible('hero');
    const showFeatures = isSectionVisible('features');
    const showProducts = isSectionVisible('product_grid');
    const showTestimonials = isSectionVisible('testimonials');
    const showNewsletter = isSectionVisible('newsletter');

    const handleThemeSelect = (theme: ThemePreset) => {
        setSelectedThemeId(theme.id);
        setThemeConfig({
            colors: {
                primary: theme.colors.primary,
                secondary: theme.colors.secondary,
                accent: theme.colors.accent,
                background: theme.colors.background,
                text: theme.colors.foreground,
            },
            typography: {
                fontFamily: theme.typography.fontFamily.split(',')[0].trim(),
            }
        });
        toast({ title: `Theme set to ${theme.name}` });
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto p-6 pb-24">
            {/* 1. Quick Theme Selection */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Palette className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Look & Feel</CardTitle>
                            <CardDescription>Choose a preset theme for your store</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <ThemePresetStrip
                        selectedThemeId={selectedThemeId}
                        onSelectTheme={handleThemeSelect}
                    />
                </CardContent>
            </Card>

            {/* 2. Brand Assets */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                            <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <CardTitle>Brand Assets</CardTitle>
                            <CardDescription>Upload your logo and main banner</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Logo Upload would go here - simplified for now */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Store Logo</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer">
                                <Box className="w-8 h-8 text-muted-foreground mb-2" />
                                <span className="text-sm font-medium">Click to upload logo</span>
                                <span className="text-xs text-muted-foreground">Recommended: 512x512px PNG</span>
                            </div>
                        </div>

                        {/* Banner Manager Integration */}
                        <div className="space-y-2">
                            <Label>Main Hero Banner</Label>
                            <div className="border border-input rounded-lg">
                                {/* We reuse the banner manager but maybe simplistic version? 
                                    For now, just a placeholder or the actual manager if user wants 
                                */}
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                    <p>Manage your hero slides in the section below.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <StorefrontBannerManager storeId={storeId} />
                </CardContent>
            </Card>

            {/* 3. Feature Toggles */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                            <Layout className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <CardTitle>Page Sections</CardTitle>
                            <CardDescription>Toggle what appears on your home page</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base">Hero Banner</Label>
                            <p className="text-xs text-muted-foreground">
                                Large image slider at the top
                            </p>
                        </div>
                        <Switch
                            checked={showHero}
                            onCheckedChange={(c) => toggleSection('hero', c)}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base">Featured Products</Label>
                            <p className="text-xs text-muted-foreground">
                                Show your top products grid
                            </p>
                        </div>
                        <Switch
                            checked={showProducts}
                            onCheckedChange={(c) => toggleSection('product_grid', c)}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base">Value Props</Label>
                            <p className="text-xs text-muted-foreground">
                                "Fast Delivery", "Quality", etc.
                            </p>
                        </div>
                        <Switch
                            checked={showFeatures}
                            onCheckedChange={(c) => toggleSection('features', c)}
                        />
                    </div>

                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base">Newsletter</Label>
                            <p className="text-xs text-muted-foreground">
                                Email signup form footer
                            </p>
                        </div>
                        <Switch
                            checked={showNewsletter}
                            onCheckedChange={(c) => toggleSection('newsletter', c)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* 4. Actions */}
            <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-background/80 backdrop-blur p-4 border-t z-10">
                <Button variant="outline" onClick={onSave} disabled={isSaving}>
                    Save Draft
                </Button>
                <Button onClick={onPublish} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Publish Store
                </Button>
            </div>
        </div>
    );
}
