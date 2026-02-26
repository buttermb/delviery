import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import Copy from 'lucide-react/dist/esm/icons/copy';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import Edit2 from 'lucide-react/dist/esm/icons/edit-2';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Layout from 'lucide-react/dist/esm/icons/layout';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Calendar from 'lucide-react/dist/esm/icons/calendar';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Package from 'lucide-react/dist/esm/icons/package';
import Share2 from 'lucide-react/dist/esm/icons/share-2';
import Star from 'lucide-react/dist/esm/icons/star';
import History from 'lucide-react/dist/esm/icons/history';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Search from 'lucide-react/dist/esm/icons/search';
import Check from 'lucide-react/dist/esm/icons/check';
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical';
import GitBranch from 'lucide-react/dist/esm/icons/git-branch';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';

// Types
interface MenuTemplateConfig {
  productIds: string[];
  layout: 'grid' | 'list' | 'compact';
  theme: {
    primaryColor: string;
    backgroundColor: string;
    accentColor: string;
    fontStyle: 'modern' | 'classic' | 'minimal';
  };
  availability: {
    expirationDays: number;
    maxViews: number | null;
    burnAfterRead: boolean;
    timeRestrictions: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      daysOfWeek: string[];
    };
  };
  security: {
    requireAccessCode: boolean;
    screenshotProtection: boolean;
    watermarkEnabled: boolean;
    deviceFingerprinting: boolean;
  };
}

interface MenuTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: 'daily' | 'weekend' | 'wholesale' | 'event' | 'custom';
  config: MenuTemplateConfig;
  isDefault: boolean;
  isShared: boolean;
  version: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  config: MenuTemplateConfig;
  changelog: string;
  createdAt: string;
  createdBy: string;
}

// Default templates for common use cases
const _DEFAULT_TEMPLATES: Omit<MenuTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'usageCount'>[] = [
  {
    name: 'Daily Special',
    description: 'Quick menu for daily specials with 24-hour expiration',
    category: 'daily',
    isDefault: true,
    isShared: false,
    version: 1,
    config: {
      productIds: [],
      layout: 'grid',
      theme: {
        primaryColor: '#10b981',
        backgroundColor: '#ffffff',
        accentColor: '#059669',
        fontStyle: 'modern',
      },
      availability: {
        expirationDays: 1,
        maxViews: null,
        burnAfterRead: false,
        timeRestrictions: {
          enabled: false,
          startTime: '09:00',
          endTime: '21:00',
          daysOfWeek: [],
        },
      },
      security: {
        requireAccessCode: false,
        screenshotProtection: true,
        watermarkEnabled: false,
        deviceFingerprinting: true,
      },
    },
  },
  {
    name: 'Weekend Menu',
    description: 'Special weekend offerings with Fri-Sun availability',
    category: 'weekend',
    isDefault: true,
    isShared: false,
    version: 1,
    config: {
      productIds: [],
      layout: 'grid',
      theme: {
        primaryColor: '#8b5cf6',
        backgroundColor: '#faf5ff',
        accentColor: '#7c3aed',
        fontStyle: 'modern',
      },
      availability: {
        expirationDays: 3,
        maxViews: null,
        burnAfterRead: false,
        timeRestrictions: {
          enabled: true,
          startTime: '10:00',
          endTime: '23:00',
          daysOfWeek: ['FR', 'SA', 'SU'],
        },
      },
      security: {
        requireAccessCode: false,
        screenshotProtection: true,
        watermarkEnabled: true,
        deviceFingerprinting: true,
      },
    },
  },
  {
    name: 'Wholesale Catalog',
    description: 'B2B menu for wholesale buyers with invite-only access',
    category: 'wholesale',
    isDefault: true,
    isShared: false,
    version: 1,
    config: {
      productIds: [],
      layout: 'list',
      theme: {
        primaryColor: '#3b82f6',
        backgroundColor: '#f8fafc',
        accentColor: '#2563eb',
        fontStyle: 'classic',
      },
      availability: {
        expirationDays: 7,
        maxViews: 50,
        burnAfterRead: false,
        timeRestrictions: {
          enabled: false,
          startTime: '09:00',
          endTime: '17:00',
          daysOfWeek: [],
        },
      },
      security: {
        requireAccessCode: true,
        screenshotProtection: true,
        watermarkEnabled: true,
        deviceFingerprinting: true,
      },
    },
  },
  {
    name: 'Pop-Up Event',
    description: 'Time-limited menu for events and pop-ups',
    category: 'event',
    isDefault: true,
    isShared: false,
    version: 1,
    config: {
      productIds: [],
      layout: 'compact',
      theme: {
        primaryColor: '#f59e0b',
        backgroundColor: '#fffbeb',
        accentColor: '#d97706',
        fontStyle: 'minimal',
      },
      availability: {
        expirationDays: 1,
        maxViews: 100,
        burnAfterRead: true,
        timeRestrictions: {
          enabled: true,
          startTime: '12:00',
          endTime: '20:00',
          daysOfWeek: [],
        },
      },
      security: {
        requireAccessCode: false,
        screenshotProtection: true,
        watermarkEnabled: false,
        deviceFingerprinting: true,
      },
    },
  },
];

// Hooks
const useMenuTemplates = (tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'templates', tenantId],
    queryFn: async (): Promise<MenuTemplate[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('menu_templates')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch menu templates', { error: error.message, tenantId });
        return [];
      }

      return (data ?? []).map((template: Record<string, unknown>) => ({
        id: template.id as string,
        tenantId: template.tenant_id as string,
        name: template.name as string,
        description: (template.description ?? '') as string,
        category: (template.category || 'custom') as MenuTemplate['category'],
        config: template.config as unknown as MenuTemplateConfig,
        isDefault: template.is_default as boolean,
        isShared: template.is_shared as boolean,
        version: (template.version || 1) as number,
        usageCount: (template.usage_count ?? 0) as number,
        createdAt: template.created_at as string,
        updatedAt: template.updated_at as string,
        createdBy: template.created_by as string,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30 * 1000,
  });
};

const useTemplateVersions = (templateId?: string, tenantId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.menus.all, 'template-versions', templateId],
    queryFn: async (): Promise<TemplateVersion[]> => {
      if (!templateId || !tenantId) return [];

      const { data, error } = await supabase
        .from('menu_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .eq('tenant_id', tenantId)
        .order('version', { ascending: false });

      if (error) {
        logger.warn('Failed to fetch template versions', { error: error.message, templateId });
        return [];
      }

      return (data ?? []).map((version: Record<string, unknown>) => ({
        id: version.id as string,
        templateId: version.template_id as string,
        version: version.version as number,
        config: version.config as unknown as MenuTemplateConfig,
        changelog: (version.changelog ?? '') as string,
        createdAt: version.created_at as string,
        createdBy: version.created_by as string,
      }));
    },
    enabled: !!templateId && !!tenantId,
    staleTime: 60 * 1000,
  });
};

const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: {
      tenantId: string;
      name: string;
      description: string;
      category: MenuTemplate['category'];
      config: MenuTemplateConfig;
      isShared: boolean;
      createdBy: string;
    }) => {
      const { data, error } = await supabase
        .from('menu_templates')
        .insert({
          tenant_id: templateData.tenantId,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          config: templateData.config as unknown as Record<string, unknown>,
          is_default: false,
          is_shared: templateData.isShared,
          version: 1,
          usage_count: 0,
          created_by: templateData.createdBy,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'templates', variables.tenantId] });
      showSuccessToast('Template Created', 'Menu template has been saved successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create template', { error, message });
      showErrorToast('Failed to Create Template', message);
    },
  });
};

const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateData: {
      id: string;
      tenantId: string;
      name?: string;
      description?: string;
      category?: MenuTemplate['category'];
      config?: MenuTemplateConfig;
      isShared?: boolean;
      changelog?: string;
    }) => {
      // Get current template for version increment
      const { data: currentTemplate } = await supabase
        .from('menu_templates')
        .select('version, config')
        .eq('id', templateData.id)
        .eq('tenant_id', templateData.tenantId)
        .maybeSingle();

      const newVersion = ((currentTemplate as Record<string, unknown> | null)?.version as number ?? 0) + 1;

      // Update the template
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (templateData.name !== undefined) updateData.name = templateData.name;
      if (templateData.description !== undefined) updateData.description = templateData.description;
      if (templateData.category !== undefined) updateData.category = templateData.category;
      if (templateData.isShared !== undefined) updateData.is_shared = templateData.isShared;

      if (templateData.config !== undefined) {
        updateData.config = templateData.config as unknown as Record<string, unknown>;
        updateData.version = newVersion;

        // Save version history
        await supabase.from('menu_template_versions').insert({
          template_id: templateData.id,
          tenant_id: templateData.tenantId,
          version: newVersion,
          config: templateData.config as unknown as Record<string, unknown>,
          changelog: templateData.changelog || `Updated to version ${newVersion}`,
          created_by: templateData.tenantId, // Using tenantId as fallback for createdBy
        });
      }

      const { data, error } = await supabase
        .from('menu_templates')
        .update(updateData)
        .eq('id', templateData.id)
        .eq('tenant_id', templateData.tenantId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'templates', variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'template-versions', variables.id] });
      showSuccessToast('Template Updated', 'Menu template has been updated successfully');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update template', { error, message });
      showErrorToast('Failed to Update Template', message);
    },
  });
};

const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      // Delete version history first
      await supabase
        .from('menu_template_versions')
        .delete()
        .eq('template_id', id)
        .eq('tenant_id', tenantId);

      // Delete the template
      const { error } = await supabase
        .from('menu_templates')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'templates', variables.tenantId] });
      showSuccessToast('Template Deleted', 'Menu template has been deleted');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete template', { error, message });
      showErrorToast('Failed to Delete Template', message);
    },
  });
};

const useIncrementUsage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase.rpc('increment_template_usage', {
        template_id: id,
        p_tenant_id: tenantId,
      });

      if (error) {
        // Fallback: manual increment if RPC doesn't exist
        const { data: current } = await supabase
          .from('menu_templates')
          .select('usage_count')
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        await supabase
          .from('menu_templates')
          .update({ usage_count: ((current as Record<string, unknown> | null)?.usage_count as number ?? 0) + 1 })
          .eq('id', id)
          .eq('tenant_id', tenantId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.menus.all, 'templates', variables.tenantId] });
    },
  });
};

// Template Editor Component
interface TemplateEditorProps {
  template?: MenuTemplate;
  tenantId: string;
  adminId: string;
  onSave: (data: {
    name: string;
    description: string;
    category: MenuTemplate['category'];
    config: MenuTemplateConfig;
    isShared: boolean;
    changelog?: string;
  }) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function TemplateEditor({ template, tenantId: _tenantId, adminId: _adminId, onSave, onCancel, isSaving }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [category, setCategory] = useState<MenuTemplate['category']>(template?.category || 'custom');
  const [isShared, setIsShared] = useState(template?.isShared ?? false);
  const [changelog, setChangelog] = useState('');
  const [config, setConfig] = useState<MenuTemplateConfig>(
    template?.config || {
      productIds: [],
      layout: 'grid',
      theme: {
        primaryColor: '#10b981',
        backgroundColor: '#ffffff',
        accentColor: '#059669',
        fontStyle: 'modern',
      },
      availability: {
        expirationDays: 7,
        maxViews: null,
        burnAfterRead: false,
        timeRestrictions: {
          enabled: false,
          startTime: '09:00',
          endTime: '21:00',
          daysOfWeek: [],
        },
      },
      security: {
        requireAccessCode: false,
        screenshotProtection: true,
        watermarkEnabled: false,
        deviceFingerprinting: true,
      },
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      showErrorToast('Validation Error', 'Template name is required');
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      config,
      isShared,
      changelog: template ? changelog : undefined,
    });
  };

  const updateConfig = <K extends keyof MenuTemplateConfig>(
    key: K,
    value: MenuTemplateConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Weekend Special Menu"
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(val) => setCategory(val as MenuTemplate['category'])}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily Special</SelectItem>
              <SelectItem value="weekend">Weekend Menu</SelectItem>
              <SelectItem value="wholesale">Wholesale Catalog</SelectItem>
              <SelectItem value="event">Pop-Up Event</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe when to use this template..."
          rows={2}
        />
      </div>

      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="flex w-full overflow-x-auto">
          <TabsTrigger value="layout" className="gap-1.5">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1.5">
            <Palette className="h-4 w-4" />
            Theme
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5">
            <Package className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Layout Style</Label>
            <div className="grid grid-cols-3 gap-3">
              {(['grid', 'list', 'compact'] as const).map((layoutType) => (
                <button
                  key={layoutType}
                  type="button"
                  onClick={() => updateConfig('layout', layoutType)}
                  className={cn(
                    'p-4 border rounded-lg text-center transition-all',
                    config.layout === layoutType
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'hover:border-primary/50'
                  )}
                >
                  <Layout className="h-6 w-6 mx-auto mb-2" />
                  <span className="text-sm font-medium capitalize">{layoutType}</span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="theme" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.theme.primaryColor}
                  onChange={(e) =>
                    updateConfig('theme', { ...config.theme, primaryColor: e.target.value })
                  }
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={config.theme.primaryColor}
                  onChange={(e) =>
                    updateConfig('theme', { ...config.theme, primaryColor: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={config.theme.backgroundColor}
                  onChange={(e) =>
                    updateConfig('theme', { ...config.theme, backgroundColor: e.target.value })
                  }
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={config.theme.backgroundColor}
                  onChange={(e) =>
                    updateConfig('theme', { ...config.theme, backgroundColor: e.target.value })
                  }
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Font Style</Label>
            <Select
              value={config.theme.fontStyle}
              onValueChange={(val) =>
                updateConfig('theme', { ...config.theme, fontStyle: val as 'modern' | 'classic' | 'minimal' })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose font" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="availability" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expiration (Days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={config.availability.expirationDays}
                onChange={(e) =>
                  updateConfig('availability', {
                    ...config.availability,
                    expirationDays: parseInt(e.target.value) || 7,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max Views (empty = unlimited)</Label>
              <Input
                type="number"
                min={1}
                value={config.availability.maxViews || ''}
                onChange={(e) =>
                  updateConfig('availability', {
                    ...config.availability,
                    maxViews: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label>Burn After Read</Label>
              <p className="text-xs text-muted-foreground">Auto-expire after first view</p>
            </div>
            <Switch
              checked={config.availability.burnAfterRead}
              onCheckedChange={(checked) =>
                updateConfig('availability', { ...config.availability, burnAfterRead: checked })
              }
            />
          </div>

          <div className="space-y-3 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label>Time Restrictions</Label>
                <p className="text-xs text-muted-foreground">Only available during specific times</p>
              </div>
              <Switch
                checked={config.availability.timeRestrictions.enabled}
                onCheckedChange={(checked) =>
                  updateConfig('availability', {
                    ...config.availability,
                    timeRestrictions: { ...config.availability.timeRestrictions, enabled: checked },
                  })
                }
              />
            </div>

            {config.availability.timeRestrictions.enabled && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={config.availability.timeRestrictions.startTime}
                    onChange={(e) =>
                      updateConfig('availability', {
                        ...config.availability,
                        timeRestrictions: {
                          ...config.availability.timeRestrictions,
                          startTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={config.availability.timeRestrictions.endTime}
                    onChange={(e) =>
                      updateConfig('availability', {
                        ...config.availability,
                        timeRestrictions: {
                          ...config.availability.timeRestrictions,
                          endTime: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 pt-4">
          {[
            { key: 'requireAccessCode' as const, label: 'Require Access Code', desc: 'Users must enter a code to view' },
            { key: 'screenshotProtection' as const, label: 'Screenshot Protection', desc: 'Prevent screenshots on mobile devices' },
            { key: 'watermarkEnabled' as const, label: 'Watermark', desc: 'Add watermark to menu images' },
            { key: 'deviceFingerprinting' as const, label: 'Device Fingerprinting', desc: 'Track unique devices viewing the menu' },
          ].map((setting) => (
            <div key={setting.key} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>{setting.label}</Label>
                <p className="text-xs text-muted-foreground">{setting.desc}</p>
              </div>
              <Switch
                checked={config.security[setting.key]}
                onCheckedChange={(checked) =>
                  updateConfig('security', { ...config.security, [setting.key]: checked })
                }
              />
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Share across tenant */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label>Share with Team</Label>
            <p className="text-xs text-muted-foreground">Make this template available to all team members</p>
          </div>
        </div>
        <Switch checked={isShared} onCheckedChange={setIsShared} />
      </div>

      {/* Version changelog for updates */}
      {template && (
        <div className="space-y-2">
          <Label>Changelog (optional)</Label>
          <Textarea
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="Describe the changes in this update..."
            rows={2}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: MenuTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onUse: () => void;
  onDuplicate: () => void;
  onViewVersions: () => void;
}

function TemplateCard({ template, onEdit, onDelete, onUse, onDuplicate, onViewVersions }: TemplateCardProps) {
  const categoryColors: Record<MenuTemplate['category'], string> = {
    daily: 'bg-green-500/10 text-green-700 border-green-200',
    weekend: 'bg-purple-500/10 text-purple-700 border-purple-200',
    wholesale: 'bg-blue-500/10 text-blue-700 border-blue-200',
    event: 'bg-amber-500/10 text-amber-700 border-amber-200',
    custom: 'bg-slate-500/10 text-slate-700 border-slate-200',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', categoryColors[template.category])}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{template.name}</CardTitle>
                {template.isDefault && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Star className="h-3 w-3 mr-0.5" />
                    Default
                  </Badge>
                )}
                {template.isShared && (
                  <Badge variant="outline" className="text-[10px]">
                    <Share2 className="h-3 w-3 mr-0.5" />
                    Shared
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-1">
                {template.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Template actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onUse}>
                <Check className="h-4 w-4 mr-2" />
                Use Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewVersions}>
                <History className="h-4 w-4 mr-2" />
                Version History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="secondary" className="text-[10px]">
            <Layout className="h-3 w-3 mr-0.5" />
            {template.config.layout}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            <Calendar className="h-3 w-3 mr-0.5" />
            {template.config.availability.expirationDays}d
          </Badge>
          {template.config.availability.maxViews && (
            <Badge variant="secondary" className="text-[10px]">
              {template.config.availability.maxViews} views
            </Badge>
          )}
          {template.config.security.requireAccessCode && (
            <Badge variant="secondary" className="text-[10px]">
              Code Required
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              v{template.version}
            </span>
            <span>Used {template.usageCount}x</span>
          </div>
          <span>{format(new Date(template.createdAt), 'MMM d, yyyy')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Version History Dialog
interface VersionHistoryDialogProps {
  templateId: string;
  templateName: string;
  tenantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: TemplateVersion) => void;
}

function VersionHistoryDialog({
  templateId,
  templateName,
  tenantId,
  open,
  onOpenChange,
  onRestore,
}: VersionHistoryDialogProps) {
  const { data: versions = [], isLoading } = useTemplateVersions(templateId, tenantId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Version History</DialogTitle>
          <DialogDescription>
            View and restore previous versions of "{templateName}"
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No version history available</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{version.version}</Badge>
                    <span className="text-sm font-medium">{version.changelog || 'No changes noted'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(version.createdAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onRestore(version)}>
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Main Component
interface MenuTemplatesProps {
  onCreateMenuFromTemplate?: (config: MenuTemplateConfig) => void;
  className?: string;
}

export function MenuTemplates({ onCreateMenuFromTemplate, className }: MenuTemplatesProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const adminId = admin?.id;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MenuTemplate['category'] | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MenuTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<MenuTemplate | null>(null);
  const [viewingVersions, setViewingVersions] = useState<MenuTemplate | null>(null);

  // Data fetching
  const { data: templates = [], isLoading } = useMenuTemplates(tenantId);

  // Mutations
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const incrementUsage = useIncrementUsage();

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((t) => t.category === categoryFilter);
    }

    return result;
  }, [templates, searchQuery, categoryFilter]);

  // Handlers
  const handleCreateTemplate = useCallback(
    async (data: {
      name: string;
      description: string;
      category: MenuTemplate['category'];
      config: MenuTemplateConfig;
      isShared: boolean;
    }) => {
      if (!tenantId || !adminId) return;

      await createTemplate.mutateAsync({
        ...data,
        tenantId,
        createdBy: adminId,
      });

      setIsCreateDialogOpen(false);
    },
    [tenantId, adminId, createTemplate]
  );

  const handleUpdateTemplate = useCallback(
    async (data: {
      name: string;
      description: string;
      category: MenuTemplate['category'];
      config: MenuTemplateConfig;
      isShared: boolean;
      changelog?: string;
    }) => {
      if (!tenantId || !editingTemplate) return;

      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        tenantId,
        ...data,
      });

      setEditingTemplate(null);
    },
    [tenantId, editingTemplate, updateTemplate]
  );

  const handleDeleteTemplate = useCallback(async () => {
    if (!tenantId || !deletingTemplate) return;

    await deleteTemplate.mutateAsync({
      id: deletingTemplate.id,
      tenantId,
    });

    setDeletingTemplate(null);
  }, [tenantId, deletingTemplate, deleteTemplate]);

  const handleUseTemplate = useCallback(
    async (template: MenuTemplate) => {
      if (!tenantId) return;

      await incrementUsage.mutateAsync({ id: template.id, tenantId });

      if (onCreateMenuFromTemplate) {
        onCreateMenuFromTemplate(template.config);
        showSuccessToast('Template Applied', `Creating menu from "${template.name}"`);
      }
    },
    [tenantId, incrementUsage, onCreateMenuFromTemplate]
  );

  const handleDuplicateTemplate = useCallback(
    async (template: MenuTemplate) => {
      if (!tenantId || !adminId) return;

      await createTemplate.mutateAsync({
        tenantId,
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        config: template.config,
        isShared: false,
        createdBy: adminId,
      });
    },
    [tenantId, adminId, createTemplate]
  );

  const handleRestoreVersion = useCallback(
    async (version: TemplateVersion) => {
      if (!tenantId || !viewingVersions) return;

      await updateTemplate.mutateAsync({
        id: viewingVersions.id,
        tenantId,
        config: version.config,
        changelog: `Restored from version ${version.version}`,
      });

      setViewingVersions(null);
    },
    [tenantId, viewingVersions, updateTemplate]
  );

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Menu Templates</h2>
            <p className="text-sm text-muted-foreground">
              Save and reuse menu configurations
            </p>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            aria-label="Search templates"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(val) => setCategoryFilter(val as MenuTemplate['category'] | 'all')}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="daily">Daily Special</SelectItem>
            <SelectItem value="weekend">Weekend Menu</SelectItem>
            <SelectItem value="wholesale">Wholesale Catalog</SelectItem>
            <SelectItem value="event">Pop-Up Event</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="font-medium mb-2">
              {templates.length === 0 ? 'No Templates Yet' : 'No Matching Templates'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {templates.length === 0
                ? 'Create your first template to save and reuse menu configurations.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {templates.length === 0 && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => setDeletingTemplate(template)}
              onUse={() => handleUseTemplate(template)}
              onDuplicate={() => handleDuplicateTemplate(template)}
              onViewVersions={() => setViewingVersions(template)}
            />
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Menu Template</DialogTitle>
            <DialogDescription>
              Save a menu configuration as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <TemplateEditor
            tenantId={tenantId ?? ''}
            adminId={adminId ?? ''}
            onSave={handleCreateTemplate}
            onCancel={() => setIsCreateDialogOpen(false)}
            isSaving={createTemplate.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update the "{editingTemplate?.name}" template configuration.
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <TemplateEditor
              template={editingTemplate}
              tenantId={tenantId ?? ''}
              adminId={adminId ?? ''}
              onSave={handleUpdateTemplate}
              onCancel={() => setEditingTemplate(null)}
              isSaving={updateTemplate.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingTemplate}
        onOpenChange={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
        title="Delete Template?"
        description={`Are you sure you want to delete "${deletingTemplate?.name}"? This action cannot be undone and will also delete all version history.`}
        itemName={deletingTemplate?.name}
        itemType="template"
        isLoading={deleteTemplate.isPending}
      />

      {/* Version History Dialog */}
      {viewingVersions && (
        <VersionHistoryDialog
          templateId={viewingVersions.id}
          templateName={viewingVersions.name}
          tenantId={tenantId ?? ''}
          open={!!viewingVersions}
          onOpenChange={() => setViewingVersions(null)}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
}

export default MenuTemplates;
export type { MenuTemplate, MenuTemplateConfig, TemplateVersion };
