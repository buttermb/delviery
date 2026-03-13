import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';

interface SEOSettings {
  site_title: string;
  site_description: string;
  site_keywords: string;
  og_image_url: string;
  twitter_handle: string;
  google_analytics_id: string;
  google_tag_manager_id: string;
  facebook_pixel_id: string;
  robots_txt: string;
  sitemap_enabled: boolean;
}

const DEFAULT_SETTINGS: SEOSettings = {
  site_title: '',
  site_description: '',
  site_keywords: '',
  og_image_url: '',
  twitter_handle: '',
  google_analytics_id: '',
  google_tag_manager_id: '',
  facebook_pixel_id: '',
  robots_txt: 'User-agent: *\nAllow: /',
  sitemap_enabled: true,
};

export default function SEOSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SEOSettings>(DEFAULT_SETTINGS);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'seo'),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (error) throw error;

      const record = data as Record<string, unknown> | null;
      if (record?.metadata) {
        const metadata = record.metadata as Record<string, unknown>;
        const seoSettings = metadata.seo_settings as SEOSettings | undefined;
        if (seoSettings) {
          setSettings({ ...DEFAULT_SETTINGS, ...seoSettings });
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: SEOSettings) => {
      if (!tenant?.id) throw new Error('No tenant');

      const { data: currentData, error: fetchError } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const currentMetadata = (currentData?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            seo_settings: newSettings,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'seo') });
      toast.success('SEO settings saved');
    },
    onError: (error) => {
      logger.error('Failed to save SEO settings', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleChange = (field: keyof SEOSettings, value: unknown) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">SEO Settings</h2>
        <p className="text-muted-foreground mt-1">
          Configure search engine optimization for your storefront
        </p>
      </div>

      <SettingsSection
        title="Meta Tags"
        description="Title, description, and keywords for search engines"
        icon={Search}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div>
              <Label>Site Title</Label>
              <Input
                value={settings.site_title}
                onChange={(e) => handleChange('site_title', e.target.value)}
                placeholder="Your Store Name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown in browser tab and search results
              </p>
            </div>

            <div>
              <Label>Site Description</Label>
              <Textarea
                value={settings.site_description}
                onChange={(e) => handleChange('site_description', e.target.value)}
                placeholder="A brief description of your store"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Shown in search results (max 160 characters)
              </p>
            </div>

            <div>
              <Label>Keywords</Label>
              <Input
                value={settings.site_keywords}
                onChange={(e) => handleChange('site_keywords', e.target.value)}
                placeholder="cannabis, dispensary, weed"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated keywords
              </p>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Social Media"
        description="Open Graph and Twitter card settings"
        icon={Search}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div>
              <Label>OG Image URL</Label>
              <Input
                value={settings.og_image_url}
                onChange={(e) => handleChange('og_image_url', e.target.value)}
                placeholder="https://example.com/og-image.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Image shown when sharing on social media (1200x630px recommended)
              </p>
            </div>

            <div>
              <Label>Twitter Handle</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">@</span>
                <Input
                  value={settings.twitter_handle}
                  onChange={(e) => handleChange('twitter_handle', e.target.value)}
                  placeholder="yourbrand"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Analytics & Tracking"
        description="Connect analytics and conversion tracking"
        icon={Search}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div>
              <Label>Google Analytics ID</Label>
              <Input
                value={settings.google_analytics_id}
                onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div>
              <Label>Google Tag Manager ID</Label>
              <Input
                value={settings.google_tag_manager_id}
                onChange={(e) => handleChange('google_tag_manager_id', e.target.value)}
                placeholder="GTM-XXXXXXX"
              />
            </div>

            <div>
              <Label>Facebook Pixel ID</Label>
              <Input
                value={settings.facebook_pixel_id}
                onChange={(e) => handleChange('facebook_pixel_id', e.target.value)}
                placeholder="XXXXXXXXXXXXXXX"
              />
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="Advanced"
        description="Robots.txt and sitemap configuration"
        icon={Search}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div>
              <Label>Robots.txt</Label>
              <Textarea
                value={settings.robots_txt}
                onChange={(e) => handleChange('robots_txt', e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Controls which pages search engines can crawl
              </p>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}
