/**
 * EasyModeEditor Component
 * Main container for the simplified storefront builder experience
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Palette,
    Type,
    Settings2,
    Megaphone,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Eye,
    RefreshCw,
    Loader2,
} from 'lucide-react';
import { PresetPackSelector, PresetPackStrip } from '@/components/admin/storefront/PresetPackSelector';
import { FeatureTogglesPanel } from '@/components/admin/storefront/FeatureTogglesPanel';
import { StorefrontBannerManager } from '@/components/admin/storefront/StorefrontBannerManager';
import { type FeatureToggles, type SimpleContent } from '@/lib/storefrontPresets';

interface EasyModeEditorProps {
    storeId: string;
    storeSlug: string;
    // Preset
    selectedPresetId: string | null;
    onSelectPreset: (presetId: string) => void;
    // Feature toggles
    featureToggles: FeatureToggles;
    onUpdateToggle: (key: keyof FeatureToggles, value: boolean) => void;
    // Simple content
    simpleContent: SimpleContent;
    onUpdateContent: <K extends keyof SimpleContent>(key: K, value: SimpleContent[K]) => void;
    // Actions
    onResetToPreset: () => void;
    onSave: () => void;
    onPublish: () => void;
    isSaving: boolean;
    isDirty: boolean;
}

export function EasyModeEditor({
    storeId,
    storeSlug: _storeSlug,
    selectedPresetId,
    onSelectPreset,
    featureToggles,
    onUpdateToggle,
    simpleContent,
    onUpdateContent,
    onResetToPreset,
    onSave,
    onPublish,
    isSaving,
    isDirty,
}: EasyModeEditorProps) {
    const [activeTab, setActiveTab] = useState<'preset' | 'content' | 'features'>('preset');
    const [heroContentOpen, setHeroContentOpen] = useState(true);
    const [announcementOpen, setAnnouncementOpen] = useState(false);

    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-8">
            {/* Quick Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
                    <TabsTrigger value="preset" className="gap-2">
                        <Palette className="w-4 h-4" />
                        <span>Style</span>
                    </TabsTrigger>
                    <TabsTrigger value="content" className="gap-2">
                        <Type className="w-4 h-4" />
                        <span>Content</span>
                    </TabsTrigger>
                    <TabsTrigger value="features" className="gap-2">
                        <Settings2 className="w-4 h-4" />
                        <span>Features</span>
                    </TabsTrigger>
                </TabsList>

                {/* Style Tab - Preset Selection */}
                <TabsContent value="preset" className="mt-6">
                    <PresetPackSelector
                        selectedPresetId={selectedPresetId}
                        onSelectPreset={onSelectPreset}
                    />

                    {/* Reset button if user has customized */}
                    {isDirty && selectedPresetId && (
                        <div className="mt-4 flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onResetToPreset}
                                className="text-muted-foreground"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reset to Preset Defaults
                            </Button>
                        </div>
                    )}
                </TabsContent>

                {/* Content Tab - Hero & Announcement */}
                <TabsContent value="content" className="mt-6 space-y-4">
                    {/* Announcement Banner */}
                    <Card>
                        <Collapsible open={announcementOpen} onOpenChange={setAnnouncementOpen}>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                                <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">Announcement Banner</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Optional promo text shown above the hero
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {announcementOpen ? (
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="pt-0">
                                    <div className="space-y-2">
                                        <Label htmlFor="announcement">Banner Text</Label>
                                        <Input
                                            id="announcement"
                                            placeholder="Free delivery on orders over $75!"
                                            value={simpleContent.announcementBanner ?? ''}
                                            onChange={(e) => onUpdateContent('announcementBanner', e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Leave empty to hide the announcement bar
                                        </p>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>

                    {/* Hero Content */}
                    <Card>
                        <Collapsible open={heroContentOpen} onOpenChange={setHeroContentOpen}>
                            <CollapsibleTrigger asChild>
                                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <Sparkles className="w-4 h-4 text-primary" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base">Hero Section</CardTitle>
                                                <CardDescription className="text-xs">
                                                    Main headline and call-to-action
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {heroContentOpen ? (
                                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <CardContent className="pt-0 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="headline">Headline</Label>
                                        <Input
                                            id="headline"
                                            placeholder="Premium Cannabis Delivered"
                                            value={simpleContent.heroHeadline}
                                            onChange={(e) => onUpdateContent('heroHeadline', e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            2-4 words work best for impact
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="subheadline">Subheadline</Label>
                                        <Textarea
                                            id="subheadline"
                                            placeholder="Fast, discreet delivery to your door"
                                            value={simpleContent.heroSubheadline}
                                            onChange={(e) => onUpdateContent('heroSubheadline', e.target.value)}
                                            rows={2}
                                        />
                                    </div>

                                    <Separator />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="cta-text">Button Text</Label>
                                            <Input
                                                id="cta-text"
                                                placeholder="Shop Now"
                                                value={simpleContent.heroCtaText}
                                                onChange={(e) => onUpdateContent('heroCtaText', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cta-link">Button Link</Label>
                                            <Input
                                                id="cta-link"
                                                placeholder="/shop"
                                                value={simpleContent.heroCtaLink}
                                                onChange={(e) => onUpdateContent('heroCtaLink', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </CollapsibleContent>
                        </Collapsible>
                    </Card>

                    {/* Banner Manager */}
                    {storeId && (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">Hero Images</CardTitle>
                                        <CardDescription className="text-xs">
                                            Upload background images for your hero slider
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <StorefrontBannerManager storeId={storeId} />
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Features Tab */}
                <TabsContent value="features" className="mt-6">
                    <FeatureTogglesPanel
                        featureToggles={featureToggles}
                        onUpdateToggle={onUpdateToggle}
                    />
                </TabsContent>
            </Tabs>

            {/* Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t py-4 px-6 z-50 shadow-lg">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
                    {/* Current preset indicator */}
                    <div className="hidden lg:block flex-1 min-w-0 overflow-hidden">
                        <PresetPackStrip
                            selectedPresetId={selectedPresetId}
                            onSelectPreset={onSelectPreset}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 ml-auto shrink-0">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={onSave}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isSaving ? 'Saving...' : 'Save Draft'}
                        </Button>
                        <Button
                            onClick={onPublish}
                            size="lg"
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                            Publish Store
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
