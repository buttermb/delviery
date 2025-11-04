/**
 * Feature Flag Manager
 * Manage feature flags with rollout percentages
 * Inspired by LaunchDarkly and Split.io
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Flag, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface FeatureFlag {
  id: string;
  flag_key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rollout_percentage: number;
  target_tenants: string[] | null;
}

export function FeatureFlagManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newFlag, setNewFlag] = useState({
    flag_key: '',
    name: '',
    description: '',
    enabled: false,
    rollout_percentage: 0,
  });

  const { data: flags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FeatureFlag[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (flag: Partial<FeatureFlag> & { id: string }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({
          enabled: flag.enabled,
          rollout_percentage: flag.rollout_percentage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flag.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast({
        title: 'Feature Flag Updated',
        description: 'Changes have been saved',
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (flag: typeof newFlag) => {
      const { error } = await supabase.from('feature_flags').insert({
        flag_key: flag.flag_key,
        name: flag.name,
        description: flag.description,
        enabled: flag.enabled,
        rollout_percentage: flag.rollout_percentage,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      setNewFlag({
        flag_key: '',
        name: '',
        description: '',
        enabled: false,
        rollout_percentage: 0,
      });
      toast({
        title: 'Feature Flag Created',
        description: 'New feature flag has been created',
      });
    },
  });

  const handleCreate = () => {
    if (!newFlag.flag_key || !newFlag.name) {
      toast({
        title: 'Error',
        description: 'Please fill in flag key and name',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(newFlag);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="h-5 w-5" />
          Feature Flags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create New Flag */}
        <div className="p-4 border rounded-lg space-y-4">
          <h3 className="font-semibold">Create New Feature Flag</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Flag Key</Label>
              <Input
                value={newFlag.flag_key}
                onChange={(e) =>
                  setNewFlag({ ...newFlag, flag_key: e.target.value })
                }
                placeholder="new_feature"
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newFlag.name}
                onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                placeholder="New Feature Name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={newFlag.description}
              onChange={(e) =>
                setNewFlag({ ...newFlag, description: e.target.value })
              }
              placeholder="What does this feature flag control?"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={newFlag.enabled}
                onCheckedChange={(checked) =>
                  setNewFlag({ ...newFlag, enabled: checked })
                }
              />
              <Label>Enabled</Label>
            </div>
            <div className="flex-1">
              <Label>Rollout: {newFlag.rollout_percentage}%</Label>
              <Slider
                value={[newFlag.rollout_percentage]}
                onValueChange={([value]) =>
                  setNewFlag({ ...newFlag, rollout_percentage: value })
                }
                max={100}
                step={1}
              />
            </div>
          </div>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Create Flag
          </Button>
        </div>

        {/* Existing Flags */}
        {isLoading ? (
          <div className="h-64 bg-muted animate-pulse rounded" />
        ) : flags && flags.length > 0 ? (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{flag.name}</p>
                      <Badge variant="outline" className="font-mono">
                        {flag.flag_key}
                      </Badge>
                    </div>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {flag.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={(checked) => {
                        updateMutation.mutate({ ...flag, enabled: checked });
                      }}
                    />
                    <Label>{flag.enabled ? 'Enabled' : 'Disabled'}</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Rollout Percentage</Label>
                    <span className="text-sm font-medium">
                      {flag.rollout_percentage}%
                    </span>
                  </div>
                  <Slider
                    value={[flag.rollout_percentage]}
                    onValueChange={([value]) => {
                      updateMutation.mutate({ ...flag, rollout_percentage: value });
                    }}
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No feature flags created</p>
            <p className="text-xs mt-1">Create your first feature flag above</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

