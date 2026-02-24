import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { handleError } from "@/utils/errorHandling/handlers";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { queryKeys } from '@/lib/queryKeys';

export default function WhiteLabel() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    brand_name: '',
    logo_url: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    custom_css: '',
    enabled: false,
  });

  const { data: branding, isLoading } = useQuery({
    queryKey: queryKeys.whiteLabel.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('white_label')
        .eq('id', tenantId)
        .maybeSingle();

      if (error) throw error;

      // Extract and return the white_label JSONB data
      return data?.white_label || null;
    },
    enabled: !!tenantId,
  });

  // Initialize form data when branding data loads
  useEffect(() => {
    if (branding && typeof branding === 'object' && !Array.isArray(branding)) {
      const data = branding as Record<string, unknown>;
      const theme = (data.theme && typeof data.theme === 'object' ? data.theme : {}) as Record<string, unknown>;
      setFormData({
        brand_name: (data.brand_name as string) || '',
        logo_url: (data.logo as string) || (data.logo_url as string) || '',
        primary_color: (theme.primaryColor as string) || (data.primary_color as string) || '#000000',
        secondary_color: (theme.secondaryColor as string) || (data.secondary_color as string) || '#ffffff',
        custom_css: (theme.customCSS as string) || (data.custom_css as string) || '',
        enabled: Boolean(data.enabled),
      });
    }
  }, [branding]);

  const updateBrandingMutation = useMutation({
    mutationFn: async (brandingData: typeof formData) => {
      if (!tenantId) throw new Error('Tenant ID required');

      // Structure the JSONB data according to the schema
      const whiteLabelData = {
        enabled: brandingData.enabled,
        brand_name: brandingData.brand_name,
        logo: brandingData.logo_url,
        theme: {
          primaryColor: brandingData.primary_color,
          secondaryColor: brandingData.secondary_color,
          customCSS: brandingData.custom_css,
        },
      };

      const { data, error } = await supabase
        .from('tenants')
        .update({ white_label: whiteLabelData })
        .eq('id', tenantId)
        .select('white_label')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.whiteLabel.byTenant(tenantId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSingle.byId(tenantId) });
      toast.success("White label settings have been saved.");
    },
    onError: (error) => {
      handleError(error, {
        component: 'WhiteLabel.updateBranding',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const handleSave = () => {
    updateBrandingMutation.mutate(formData);
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading branding settings..." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">White Label Branding</h1>
          <p className="text-muted-foreground">Customize your platform's appearance</p>
        </div>
        <SaveButton
          onClick={handleSave}
          isPending={updateBrandingMutation.isPending}
          isSuccess={updateBrandingMutation.isSuccess}
        >
          Save Changes
        </SaveButton>
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
                <input
                  type="file"
                  id="logo-upload"
                  className="hidden"
                  accept="image/*"
                  aria-label="Upload brand logo"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Math.random()}.${fileExt}`;
                      const filePath = `${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('branding')
                        .upload(filePath, file);

                      if (uploadError) throw uploadError;

                      const { data } = supabase.storage
                        .from('branding')
                        .getPublicUrl(filePath);

                      setFormData({ ...formData, logo_url: data.publicUrl });
                      toast.success("Logo uploaded successfully");
                    } catch (error) {
                      handleError(error, {
                        component: 'WhiteLabel.uploadLogo',
                        toastTitle: 'Error',
                        showToast: true
                      });
                    }
                  }}
                />
                <Button variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>
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
            <Textarea
              className="min-h-[200px] font-mono text-sm"
              value={formData.custom_css}
              onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
              placeholder="/* Add your custom CSS here */"
              aria-label="Custom CSS"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

