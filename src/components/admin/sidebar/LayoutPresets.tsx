/**
 * Layout Presets Component
 * 
 * UI for selecting predefined sidebar layouts
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { getLayoutPresets } from '@/lib/sidebar/layoutPresets';
import { Check, Download, Upload, RotateCcw, Eye, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CustomPresetBuilder } from './CustomPresetBuilder';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function LayoutPresets() {
  const { preferences, updatePreferences } = useSidebarPreferences();
  const presets = getLayoutPresets();
  const currentPreset = preferences?.layoutPreset || 'default';
  const [importing, setImporting] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  const handleSelectPreset = async (presetId: string) => {
    if (applyingPreset) return; // Prevent multiple clicks
    
    setApplyingPreset(presetId);
    const presetName = presets.find(p => p.id === presetId)?.name || 'layout';
    
    try {
      toast.loading(`Applying ${presetName}...`, { id: 'preset-apply' });
      
      await updatePreferences({
        layoutPreset: presetId,
        hiddenFeatures: [], // Reset hidden features when changing preset
      });
      
      // Wait for sidebar to re-render
      await new Promise(resolve => setTimeout(resolve, 200));
      
      toast.success(`Applied ${presetName}`, { id: 'preset-apply' });
    } catch (error) {
      toast.error('Failed to apply preset', { id: 'preset-apply' });
    } finally {
      setApplyingPreset(null);
    }
  };

  const handleExport = () => {
    const config = {
      version: '1.0',
      timestamp: Date.now(),
      preferences: {
        operationSize: preferences?.operationSize,
        hiddenFeatures: preferences?.hiddenFeatures,
        sectionOrder: preferences?.sectionOrder,
        customSections: preferences?.customSections,
        customMenuItems: preferences?.customMenuItems,
        layoutPreset: preferences?.layoutPreset,
        sidebarBehavior: preferences?.sidebarBehavior,
      },
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidebar-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Configuration exported');
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        
        if (config.preferences) {
          await updatePreferences(config.preferences);
          toast.success('Configuration imported successfully');
        } else {
          toast.error('Invalid configuration file');
        }
      } catch (error) {
        toast.error('Failed to import configuration');
      } finally {
        setImporting(false);
      }
    };
    
    input.click();
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Quick Presets</h3>
            {currentPreset !== 'default' && (
              <Button 
                onClick={() => handleSelectPreset('default')} 
                variant="outline" 
                size="sm"
                disabled={applyingPreset !== null}
              >
                <RotateCcw className="h-3 w-3 mr-2" />
                Reset to Default
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Choose a predefined layout optimized for your workflow
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {presets.map((preset) => {
              const isActive = currentPreset === preset.id;
              const featureCount = preset.visibleFeatures === 'all' 
                ? 'All' 
                : preset.visibleFeatures.length;

              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset.id)}
                  disabled={applyingPreset !== null}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary hover:shadow-md ${
                    isActive 
                      ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20' 
                      : 'border-border'
                  } ${applyingPreset === preset.id ? 'opacity-50 cursor-wait' : ''} ${applyingPreset && applyingPreset !== preset.id ? 'opacity-30' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {preset.id === 'full_featured' && <Star className="h-4 w-4 text-yellow-500" />}
                      <h4 className="font-medium">
                        {applyingPreset === preset.id ? 'Applying...' : preset.name}
                      </h4>
                    </div>
                    {isActive && !applyingPreset && (
                      <Badge variant="default" className="ml-2">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                    {applyingPreset === preset.id && (
                      <Badge variant="secondary" className="ml-2 animate-pulse">
                        Loading...
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {preset.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-muted rounded-md">
                          <Eye className="h-3 w-3" />
                          <span className="font-medium">{featureCount}</span>
                          <span className="text-muted-foreground">
                            {preset.visibleFeatures === 'all' ? 'features' : 'items'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {preset.visibleFeatures === 'all'
                            ? 'Shows all available features'
                            : `Shows ${featureCount} selected features`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      <CustomPresetBuilder />

      <div className="border-t pt-6">
        <h3 className="font-medium mb-2">Import / Export</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Save your custom configuration or import one from another device
        </p>

        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Config
          </Button>
          <Button onClick={handleImport} variant="outline" disabled={importing}>
            <Upload className="h-4 w-4 mr-2" />
            Import Config
          </Button>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
