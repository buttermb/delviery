import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { NYC_BOROUGHS } from '@/utils/geofencing';

interface GeofenceRule {
  center: {
    latitude: number;
    longitude: number;
  };
  radius_km: number;
  allowed: boolean;
  name?: string;
}

interface GeofenceSettingsProps {
  rules: GeofenceRule[];
  onChange: (rules: GeofenceRule[]) => void;
}

export const GeofenceSettings = ({ rules, onChange }: GeofenceSettingsProps) => {
  const [localRules, setLocalRules] = useState<GeofenceRule[]>(rules ?? []);

  const addRule = () => {
    const newRule: GeofenceRule = {
      center: { latitude: 40.7831, longitude: -73.9712 }, // Manhattan default
      radius_km: 10,
      allowed: true,
      name: 'New Zone'
    };
    const updated = [...localRules, newRule];
    setLocalRules(updated);
    onChange(updated);
  };

  const updateRule = (index: number, updates: Partial<GeofenceRule>) => {
    const updated = localRules.map((rule, i) => 
      i === index ? { ...rule, ...updates } : rule
    );
    setLocalRules(updated);
    onChange(updated);
  };

  const removeRule = (index: number) => {
    const updated = localRules.filter((_, i) => i !== index);
    setLocalRules(updated);
    onChange(updated);
  };

  const addBoroughPreset = (borough: keyof typeof NYC_BOROUGHS) => {
    const preset = NYC_BOROUGHS[borough];
    const newRule: GeofenceRule = {
      center: { latitude: preset.latitude, longitude: preset.longitude },
      radius_km: preset.radius,
      allowed: true,
      name: borough.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    };
    const updated = [...localRules, newRule];
    setLocalRules(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Geofence Rules</h3>
          </div>
          <Button onClick={addRule} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>

        {localRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No geofence rules configured</p>
            <p className="text-sm mt-1">Add rules to restrict access by location</p>
          </div>
        ) : (
          <div className="space-y-4">
            {localRules.map((rule, index) => (
              <Card key={`rule-${index}-${rule.center.latitude}-${rule.center.longitude}`} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="Zone name"
                      aria-label="Geofence zone name"
                      value={rule.name ?? ''}
                      onChange={(e) => updateRule(index, { name: e.target.value })}
                      className="max-w-[200px]"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(index)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        type="number"
                        min={-90}
                        max={90}
                        step="0.0001"
                        value={rule.center.latitude}
                        onChange={(e) => updateRule(index, {
                          center: { ...rule.center, latitude: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        type="number"
                        min={-180}
                        max={180}
                        step="0.0001"
                        value={rule.center.longitude}
                        onChange={(e) => updateRule(index, {
                          center: { ...rule.center, longitude: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Radius (km)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      value={rule.radius_km}
                      onChange={(e) => updateRule(index, { radius_km: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Label htmlFor={`allowed-${index}`}>
                      {rule.allowed ? 'Allowed Zone' : 'Restricted Zone'}
                    </Label>
                    <Switch
                      id={`allowed-${index}`}
                      checked={rule.allowed}
                      onCheckedChange={(checked) => updateRule(index, { allowed: checked })}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <Label className="text-sm mb-2 block">NYC Borough Presets</Label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(NYC_BOROUGHS).map((borough) => (
            <Button
              key={borough}
              variant="outline"
              size="sm"
              onClick={() => addBoroughPreset(borough as keyof typeof NYC_BOROUGHS)}
            >
              {borough.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
};
