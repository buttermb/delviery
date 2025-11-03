import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Paintbrush, Upload, Save } from 'lucide-react';

export default function WhiteLabel() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    brand_name: '',
    logo_url: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    custom_css: '',
    enabled: false,
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: ['white-label', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      try {
        const { data, error } = await supabase
          .from('white_label_settings' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .single();

        if (error && error.code === '42P01') return null;
        if (error && error.code === 'PGRST116') return null; // Not found
        if (error) throw error;
        return data;
      } catch (error: any) {
        if (error.code === '42P01' || error.code === 'PGRST116') return null;
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const updateBrandingMutation = useMutation({
    mutationFn: async (brandingData: any) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('white_label_settings' as any)
        .upsert({
          tenant_id: tenantId,
          ...brandingData,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('White label settings table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['white-label', tenantId] });
      toast({ title: 'Branding updated', description: 'White label settings have been saved.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update branding',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    updateBrandingMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading branding settings...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">White Label Branding</h1>
          <p className="text-muted-foreground">Customize your platform's appearance</p>
        </div>
        <Button onClick={handleSave} disabled={updateBrandingMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Brand Identity</CardTitle>
            <CardDescription>Configure your brand name and logo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand Name</Label>
              <Input
                id="brand_name"
                value={formData.brand_name}
                onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                <Button variant="outline">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enable White Label</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Scheme</CardTitle>
            <CardDescription>Customize your brand colors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  placeholder="#000000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary_color"
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  placeholder="#ffffff"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Custom CSS</CardTitle>
            <CardDescription>Add custom styles for advanced customization</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full min-h-[200px] px-3 py-2 border rounded-md font-mono text-sm"
              value={formData.custom_css}
              onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
              placeholder="/* Add your custom CSS here */"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

