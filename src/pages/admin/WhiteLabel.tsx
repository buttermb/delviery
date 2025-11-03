import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Upload, Save, Eye, Palette } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

export default function WhiteLabel() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState({
    primaryColor: tenant?.white_label?.theme?.primaryColor || '#3b82f6',
    secondaryColor: tenant?.white_label?.theme?.secondaryColor || '#8b5cf6',
    backgroundColor: tenant?.white_label?.theme?.backgroundColor || '#ffffff',
    textColor: tenant?.white_label?.theme?.textColor || '#111827',
    accentColor: tenant?.white_label?.theme?.accentColor || '#f59e0b',
    customCSS: tenant?.white_label?.theme?.customCSS || '',
  });
  const [logoUrl, setLogoUrl] = useState(tenant?.white_label?.logo || '');
  const [faviconUrl, setFaviconUrl] = useState((tenant?.white_label as any)?.favicon || '');
  const [enabled, setEnabled] = useState(tenant?.white_label?.enabled || false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant ID required');

      const whiteLabelConfig = {
        enabled,
        logo: logoUrl || null,
        favicon: faviconUrl || null,
        theme: {
          primaryColor: theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          backgroundColor: theme.backgroundColor,
          textColor: theme.textColor,
          accentColor: theme.accentColor,
          customCSS: theme.customCSS,
        },
      };

      const { error } = await supabase
        .from('tenants')
        .update({
          white_label: whiteLabelConfig,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      toast({ title: 'Settings saved', description: 'White-label settings have been saved.' });
      // Reload page to apply theme
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings',
        variant: 'destructive',
      });
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In production, upload to Supabase Storage
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
      toast({ title: 'Logo uploaded', description: 'Logo has been uploaded (preview).' });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">White Label</h1>
          <p className="text-muted-foreground">Customize branding, colors, and theme</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* Enable/Disable */}
      <Card>
        <CardHeader>
          <CardTitle>White Label Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enabled"
              checked={enabled}
              onCheckedChange={(checked) => setEnabled(checked as boolean)}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enable White Label Branding
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            When enabled, your custom branding will be applied across the entire application.
          </p>
        </CardContent>
      </Card>

      {/* Logo & Favicon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {logoUrl && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <img src={logoUrl} alt="Logo Preview" className="max-h-32 mx-auto" />
              </div>
            )}
            <div>
              <Label htmlFor="logo-upload">Upload Logo</Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="logo-url">Or Enter Logo URL</Label>
              <Input
                id="logo-url"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {faviconUrl && (
              <div className="border rounded-lg p-4 bg-muted/50 flex items-center justify-center">
                <img src={faviconUrl} alt="Favicon Preview" className="w-16 h-16" />
              </div>
            )}
            <div>
              <Label htmlFor="favicon-url">Favicon URL</Label>
              <Input
                id="favicon-url"
                type="url"
                value={faviconUrl}
                onChange={(e) => setFaviconUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="primary">Primary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="primary"
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondary">Secondary Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="secondary"
                  type="color"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={theme.secondaryColor}
                  onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                  placeholder="#8b5cf6"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accent">Accent Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="accent"
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  placeholder="#f59e0b"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="background">Background Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="background"
                  type="color"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={theme.backgroundColor}
                  onChange={(e) => setTheme({ ...theme, backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="text">Text Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="text"
                  type="color"
                  value={theme.textColor}
                  onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={theme.textColor}
                  onChange={(e) => setTheme({ ...theme, textColor: e.target.value })}
                  placeholder="#111827"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom CSS */}
      <Card>
        <CardHeader>
          <CardTitle>Custom CSS</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="css">Additional CSS Styles</Label>
            <Textarea
              id="css"
              value={theme.customCSS}
              onChange={(e) => setTheme({ ...theme, customCSS: e.target.value })}
              className="font-mono text-sm min-h-[200px] mt-2"
              placeholder=".custom-class { color: #000; }"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Add custom CSS to further customize your branding
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
            }}
          >
            <div className="space-y-4">
              {logoUrl && (
                <div className="flex justify-center">
                  <img src={logoUrl} alt="Logo" className="max-h-16" />
                </div>
              )}
              <h2 className="text-2xl font-bold text-center" style={{ color: theme.primaryColor }}>
                Sample Heading
              </h2>
              <p className="text-center">This is how your branding will appear</p>
              <div className="flex justify-center gap-2">
                <Button style={{ backgroundColor: theme.primaryColor, color: 'white' }}>
                  Primary Button
                </Button>
                <Button variant="outline" style={{ borderColor: theme.secondaryColor, color: theme.secondaryColor }}>
                  Secondary Button
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

