/**
 * BuilderLeftPanel
 * Left sidebar with Library, Layers, Theme, and Templates tabs
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { type StorefrontSection, type ThemeConfig, type TemplateKey } from './storefront-builder.config';
import { BuilderSectionLibrary } from './BuilderSectionLibrary';
import { BuilderLayerList } from './BuilderLayerList';
import { BuilderThemePanel } from './BuilderThemePanel';
import { BuilderTemplateGallery } from './BuilderTemplateGallery';

interface BuilderLeftPanelProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    layoutConfig: StorefrontSection[];
    setLayoutConfig: (config: StorefrontSection[]) => void;
    themeConfig: ThemeConfig;
    setThemeConfig: React.Dispatch<React.SetStateAction<ThemeConfig>>;
    selectedThemeId?: string;
    onSelectThemePreset?: (preset: any) => void;
    selectedSectionId: string | null;
    onAddSection: (type: string) => void;
    onSelectSection: (id: string) => void;
    onRemoveSection: (id: string, e: React.MouseEvent) => void;
    onDuplicateSection: (id: string, e: React.MouseEvent) => void;
    onToggleVisibility: (id: string, e: React.MouseEvent) => void;
    onApplyTemplate: (templateKey: TemplateKey) => void;
    saveToHistory: (config: StorefrontSection[]) => void;
}

export function BuilderLeftPanel({
    activeTab,
    setActiveTab,
    layoutConfig,
    setLayoutConfig,
    themeConfig,
    setThemeConfig,
    selectedThemeId,
    onSelectThemePreset,
    selectedSectionId,
    onAddSection,
    onSelectSection,
    onRemoveSection,
    onDuplicateSection,
    onToggleVisibility,
    onApplyTemplate,
    saveToHistory,
}: BuilderLeftPanelProps) {
    // If the active string matches old references, map it to the new ones
    const currentTab = (activeTab === 'sections') ? 'library' : activeTab;

    return (
        <div className="w-64 lg:w-72 bg-background border-r flex flex-col shrink-0 z-10 min-h-0 max-w-[288px]">
            <Tabs value={currentTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="grid w-full grid-cols-4 p-2 h-auto bg-transparent border-b rounded-none shrink-0" style={{ paddingBottom: '0.1rem' }}>
                    <TabsTrigger value="library" className="text-xs py-1.5 px-1">Library</TabsTrigger>
                    <TabsTrigger value="layers" className="text-xs py-1.5 px-1">Layers</TabsTrigger>
                    <TabsTrigger value="theme" className="text-xs py-1.5 px-1">Theme</TabsTrigger>
                    <TabsTrigger value="templates" className="text-xs py-1.5 px-1">Templates</TabsTrigger>
                </TabsList>

                <TabsContent value="library" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <BuilderSectionLibrary onAddSection={onAddSection} />
                </TabsContent>

                <TabsContent value="layers" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <BuilderLayerList
                        layoutConfig={layoutConfig}
                        setLayoutConfig={setLayoutConfig}
                        saveToHistory={saveToHistory}
                        selectedSectionId={selectedSectionId}
                        onSelectSection={onSelectSection}
                        onRemoveSection={onRemoveSection}
                        onDuplicateSection={onDuplicateSection}
                        onToggleVisibility={onToggleVisibility}
                    />
                </TabsContent>

                <TabsContent value="theme" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <BuilderThemePanel
                        themeConfig={themeConfig}
                        setThemeConfig={setThemeConfig}
                        selectedThemeId={selectedThemeId}
                        onSelectThemePreset={onSelectThemePreset!}
                    />
                </TabsContent>

                <TabsContent value="templates" className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden">
                    <BuilderTemplateGallery onApplyTemplate={onApplyTemplate} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
