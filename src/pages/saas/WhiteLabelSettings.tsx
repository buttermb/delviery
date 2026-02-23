/**
 * White Label Settings Page
 * Customize branding and theme for tenant
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Palette, Upload, Globe, Mail, MessageSquare, Image, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { hasFeature } from '@/lib/tenant';
import { handleError } from '@/utils/errorHandling/handlers';

export default function WhiteLabelSettings() {
  const { tenant, refresh } = useTenant();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // White label state
  const [whiteLabelEnabled, setWhiteLabelEnabled] = useState(
    tenant?.white_label?.enabled || false
  );
  const [customDomain, setCustomDomain] = useState(tenant?.white_label?.domain || '');
  const [logo, setLogo] = useState(tenant?.white_label?.logo || '');
  const [theme, setTheme] = useState<Record<string, string>>(
    (tenant?.white_label?.theme as Record<string, string>) || {
      primaryColor: '#10b981',
      secondaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      accentColor: '#f59e0b',
      customCSS: '',
    }
  );
  const [emailFrom, setEmailFrom] = useState((tenant?.white_label as any)?.emailFrom || '');
  const [emailLogo, setEmailLogo] = useState((tenant?.white_label as any)?.emailLogo || '');
  const [emailFooter, setEmailFooter] = useState((tenant?.white_label as any)?.emailFooter || '');
  const [smsFrom, setSmsFrom] = useState((tenant?.white_label as any)?.smsFrom || '');

  if (!tenant) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading settings...</p>
        </Card>
      </div>
    );
  }

  // Check if white-label is available for this plan
  const whiteLabelAvailable = hasFeature(tenant, 'white_label');

  const handleSave = async () => {
    if (!tenant?.id) return;

    setIsSaving(true);
    try {
      const whiteLabelConfig = {
        enabled: whiteLabelEnabled,
        domain: customDomain || null,
        logo: logo || null,
        theme: {
          primaryColor: String(theme.primaryColor ?? ''),
          secondaryColor: String(theme.secondaryColor ?? ''),
          backgroundColor: String(theme.backgroundColor ?? ''),
          textColor: String(theme.textColor ?? ''),
          accentColor: String(theme.accentColor ?? ''),
          customCSS: String(theme.customCSS ?? ''),
        },
        emailFrom: emailFrom || null,
        emailLogo: emailLogo || null,
        emailFooter: emailFooter || null,
        smsFrom: smsFrom || null,
      };

      const { error } = await supabase
        .from('tenants')
        .update({
          white_label: whiteLabelConfig as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('White-label settings have been updated');

      refresh();
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
      refresh();
      queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
    } catch (error) {
      handleError(error, { component: 'WhiteLabelSettings', toastTitle: 'Failed to Save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!tenant?.id) return;

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenant.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('whitelabel-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('whitelabel-assets').getPublicUrl(fileName);

      setLogo(data.publicUrl);
      toast.success('Logo has been uploaded successfully');
      toast.success('Logo has been uploaded successfully');
    } catch (error) {
      handleError(error, { component: 'WhiteLabelSettings', toastTitle: 'Upload Failed' });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">🎨 White-Label Settings</h1>
          <p className="text-muted-foreground">
            Customize your brand experience for customers and team members
          </p>
        </div>
        {!whiteLabelAvailable && (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Upgrade to Enterprise for white-label
          </Badge>
        )}
      </div>

      {!whiteLabelAvailable ? (
        <Card className="p-8 text-center">
          <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">White-Label Not Available</h2>
          <p className="text-muted-foreground mb-4">
            White-label branding is available on Enterprise plans only.
          </p>
          <Button onClick={() => window.location.href = '/saas/billing'}>
            Upgrade to Enterprise
          </Button>
        </Card>
      ) : (
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="domain">Custom Domain</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Enable White-Label</h3>
                  <p className="text-sm text-muted-foreground">
                    Activate custom branding throughout your platform
                  </p>
                </div>
                <Switch
                  checked={whiteLabelEnabled}
                  onCheckedChange={setWhiteLabelEnabled}
                />
              </div>
            </Card>
          </TabsContent>

          {/* Theme Customization */}
          <TabsContent value="theme" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Theme
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primary">Primary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="primary"
                      type="color"
                      value={theme.primaryColor}
                      onChange={(e) =>
                        setTheme({ ...theme, primaryColor: e.target.value })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={theme.primaryColor}
                      onChange={(e) =>
                        setTheme({ ...theme, primaryColor: e.target.value })
                      }
                      placeholder="#10b981"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondary">Secondary Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="secondary"
                      type="color"
                      value={theme.secondaryColor}
                      onChange={(e) =>
                        setTheme({ ...theme, secondaryColor: e.target.value })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={theme.secondaryColor}
                      onChange={(e) =>
                        setTheme({ ...theme, secondaryColor: e.target.value })
                      }
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="background">Background Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="background"
                      type="color"
                      value={theme.backgroundColor}
                      onChange={(e) =>
                        setTheme({ ...theme, backgroundColor: e.target.value })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={theme.backgroundColor}
                      onChange={(e) =>
                        setTheme({ ...theme, backgroundColor: e.target.value })
                      }
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="text">Text Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="text"
                      type="color"
                      value={theme.textColor}
                      onChange={(e) =>
                        setTheme({ ...theme, textColor: e.target.value })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={theme.textColor}
                      onChange={(e) =>
                        setTheme({ ...theme, textColor: e.target.value })
                      }
                      placeholder="#111827"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="accent">Accent Color</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="accent"
                      type="color"
                      value={theme.accentColor}
                      onChange={(e) =>
                        setTheme({ ...theme, accentColor: e.target.value })
                      }
                      className="w-16 h-10"
                    />
                    <Input
                      type="text"
                      value={theme.accentColor}
                      onChange={(e) =>
                        setTheme({ ...theme, accentColor: e.target.value })
                      }
                      placeholder="#f59e0b"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <Label htmlFor="customCSS">Custom CSS</Label>
                <textarea
                  id="customCSS"
                  className="w-full mt-1 p-3 border rounded-md font-mono text-sm"
                  rows={8}
                  value={theme.customCSS || ''}
                  onChange={(e) =>
                    setTheme({ ...theme, customCSS: e.target.value })
                  }
                  placeholder="/* Add custom CSS here */"
                />
              </div>
            </Card>
          </TabsContent>

          {/* Branding Assets */}
          <TabsContent value="branding" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Image className="h-5 w-5" />
                Brand Assets
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {logo && (
                      <img src={logo} alt="Logo" className="h-16 w-auto border rounded" />
                    )}
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Branding
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="emailFrom">Email From Address</Label>
                  <Input
                    id="emailFrom"
                    value={emailFrom}
                    onChange={(e) => setEmailFrom(e.target.value)}
                    placeholder="orders@yourbusiness.com"
                  />
                </div>
                <div>
                  <Label htmlFor="emailLogo">Email Logo URL</Label>
                  <Input
                    id="emailLogo"
                    value={emailLogo}
                    onChange={(e) => setEmailLogo(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label htmlFor="emailFooter">Email Footer Text</Label>
                  <textarea
                    id="emailFooter"
                    className="w-full mt-1 p-3 border rounded-md"
                    rows={3}
                    value={emailFooter}
                    onChange={(e) => setEmailFooter(e.target.value)}
                    placeholder="Custom footer text for emails"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS Branding
              </h3>
              <div>
                <Label htmlFor="smsFrom">SMS From Name</Label>
                <Input
                  id="smsFrom"
                  value={smsFrom}
                  onChange={(e) => setSmsFrom(e.target.value)}
                  placeholder="YourBusiness"
                  maxLength={11}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum 11 characters (alphanumeric)
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* Custom Domain */}
          <TabsContent value="domain" className="space-y-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="menu.yourbusiness.com"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Contact support to configure DNS settings for your custom domain
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">DNS Configuration Required</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Add the following CNAME record to your domain:
                  </p>
                  <code className="text-xs bg-background p-2 rounded block">
                    {customDomain || 'your-domain.com'} → your-platform-domain.com
                  </code>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Tabs>
      )}
    </div>
  );
}

