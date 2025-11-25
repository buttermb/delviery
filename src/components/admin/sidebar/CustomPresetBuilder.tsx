/**
 * Custom Preset Builder Component
 * 
 * Allows users to create custom sidebar layouts by selecting specific features
 */

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { ESSENTIAL_FEATURES } from '@/lib/sidebar/featureRegistry';
import type { CustomPreset } from '@/types/sidebar';
import { Plus, Save, Trash2, Edit, Check } from 'lucide-react';
import { toast } from 'sonner';

export function CustomPresetBuilder() {
  const { sidebarConfig } = useSidebarConfig();
  const { preferences, updatePreferences } = useSidebarPreferences();
  
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Get all available features from current sidebar config
  const allFeatures = useMemo(() => {
    const features: Array<{ id: string; name: string; section: string }> = [];
    sidebarConfig.forEach(section => {
      section.items.forEach(item => {
        features.push({
          id: item.id,
          name: item.name,
          section: section.section,
        });
      });
    });
    return features;
  }, [sidebarConfig]);

  // Group features by section
  const featuresBySection = useMemo(() => {
    const grouped: Record<string, Array<{ id: string; name: string }>> = {};
    allFeatures.forEach(feature => {
      if (!grouped[feature.section]) {
        grouped[feature.section] = [];
      }
      grouped[feature.section].push({ id: feature.id, name: feature.name });
    });
    return grouped;
  }, [allFeatures]);

  const customPresets: CustomPreset[] = preferences?.customPresets || [];

  const handleOpenBuilder = (preset?: CustomPreset) => {
    if (preset) {
      setEditingPresetId(preset.id);
      setPresetName(preset.name);
      setSelectedFeatures(preset.visibleFeatures);
    } else {
      setEditingPresetId(null);
      setPresetName('');
      setSelectedFeatures(ESSENTIAL_FEATURES); // Essential features pre-selected
    }
    setIsOpen(true);
  };

  const handleToggleFeature = (featureId: string) => {
    // Essential features can't be unchecked
    if (ESSENTIAL_FEATURES.includes(featureId)) {
      toast.info('Essential features cannot be removed');
      return;
    }

    setSelectedFeatures(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleSelectAll = (sectionFeatures: Array<{ id: string; name: string }>) => {
    const featureIds = sectionFeatures.map(f => f.id);
    const allSelected = featureIds.every(id => selectedFeatures.includes(id));
    
    if (allSelected) {
      // Unselect all (except essential)
      setSelectedFeatures(prev => 
        prev.filter(id => !featureIds.includes(id) || ESSENTIAL_FEATURES.includes(id))
      );
    } else {
      // Select all
      setSelectedFeatures(prev => [...new Set([...prev, ...featureIds])]);
    }
  };

  const handleSave = async () => {
    if (!presetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    if (selectedFeatures.length === 0) {
      toast.error('Please select at least one feature');
      return;
    }

    setSaving(true);
    try {
      const newPreset: CustomPreset = {
        id: editingPresetId || `custom-${Date.now()}`,
        name: presetName.trim(),
        visibleFeatures: selectedFeatures,
      };

      let updatedPresets: CustomPreset[];
      if (editingPresetId) {
        // Update existing preset
        updatedPresets = customPresets.map(p => 
          p.id === editingPresetId ? newPreset : p
        );
        toast.success('Preset updated successfully');
      } else {
        // Add new preset
        updatedPresets = [...customPresets, newPreset];
        toast.success('Custom preset created successfully');
      }

      await updatePreferences({ customPresets: updatedPresets });
      setIsOpen(false);
    } catch (error) {
      toast.error('Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (presetId: string) => {
    try {
      const updatedPresets = customPresets.filter(p => p.id !== presetId);
      await updatePreferences({ customPresets: updatedPresets });
      toast.success('Preset deleted');
      setDeletePresetId(null);
    } catch (error) {
      toast.error('Failed to delete preset');
    }
  };

  const handleApplyPreset = async (preset: CustomPreset) => {
    try {
      toast.loading(`Applying ${preset.name}...`, { id: 'apply-custom-preset' });
      
      await updatePreferences({
        layoutPreset: preset.id,
        hiddenFeatures: allFeatures
          .map(f => f.id)
          .filter(id => !preset.visibleFeatures.includes(id)),
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      toast.success(`Applied ${preset.name}`, { id: 'apply-custom-preset' });
    } catch (error) {
      toast.error('Failed to apply preset', { id: 'apply-custom-preset' });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">Custom Presets</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create your own layouts by selecting exactly which features you want
        </p>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenBuilder()} variant="outline" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Preset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                {editingPresetId ? 'Edit Custom Preset' : 'Create Custom Preset'}
              </DialogTitle>
              <DialogDescription>
                Select the features you want visible in your sidebar
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="preset-name">Preset Name</Label>
                <Input
                  id="preset-name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g., Sales & Inventory Focus"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="mb-2 block">
                  Selected Features: {selectedFeatures.length} / {allFeatures.length}
                </Label>
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <div className="space-y-6">
                    {Object.entries(featuresBySection).map(([section, features]) => {
                      const allSelected = features.every(f => selectedFeatures.includes(f.id));
                      const someSelected = features.some(f => selectedFeatures.includes(f.id));

                      return (
                        <div key={section}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-sm">{section}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectAll(features)}
                            >
                              {allSelected ? 'Unselect All' : 'Select All'}
                            </Button>
                          </div>
                          <div className="grid gap-3">
                            {features.map(feature => {
                              const isEssential = ESSENTIAL_FEATURES.includes(feature.id);
                              const isSelected = selectedFeatures.includes(feature.id);

                              return (
                                <div key={feature.id} className="flex items-center space-x-3">
                                  <Checkbox
                                    id={feature.id}
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleFeature(feature.id)}
                                    disabled={isEssential}
                                  />
                                  <Label
                                    htmlFor={feature.id}
                                    className="text-sm cursor-pointer flex items-center gap-2"
                                  >
                                    {feature.name}
                                    {isEssential && (
                                      <Badge variant="secondary" className="text-xs">
                                        Essential
                                      </Badge>
                                    )}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {editingPresetId ? 'Update' : 'Create'} Preset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {customPresets.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Your Custom Presets</Label>
          <div className="grid gap-3">
            {customPresets.map(preset => {
              const isActive = preferences?.layoutPreset === preset.id;

              return (
                <div
                  key={preset.id}
                  className={`p-4 border rounded-lg transition-all ${
                    isActive ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{preset.name}</h4>
                        {isActive && (
                          <Badge variant="default">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {preset.visibleFeatures.length} features enabled
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenBuilder(preset)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePresetId(preset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {!isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full"
                    >
                      Apply This Preset
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AlertDialog open={!!deletePresetId} onOpenChange={() => setDeletePresetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Preset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your custom preset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletePresetId && handleDelete(deletePresetId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
