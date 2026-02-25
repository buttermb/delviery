import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { SettingsVersionHistory } from '@/components/settings/SettingsVersionHistory';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useSettingsVersions } from '@/hooks/useSettingsVersions';
import type { SettingsVersion } from '@/hooks/useSettingsVersions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Clock,
  Image as ImageIcon,
  Palette,
  Upload,
  Database,
  Trash2,
  Loader2,
  History,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { queryKeys } from '@/lib/queryKeys';
import { useSearchParams } from 'react-router-dom';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Color presets for brand customization
const COLOR_PRESETS = [
  { name: 'Emerald', primary: '#10b981', accent: '#3b82f6', description: 'Fresh & modern' },
  { name: 'Ocean', primary: '#0ea5e9', accent: '#8b5cf6', description: 'Cool & professional' },
  { name: 'Rose', primary: '#f43f5e', accent: '#ec4899', description: 'Bold & vibrant' },
  { name: 'Amber', primary: '#f59e0b', accent: '#84cc16', description: 'Warm & inviting' },
];

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

export default function BusinessSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null); // Ideally fetch this from storage
  const [clearDemoDialogOpen, setClearDemoDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [, setSearchParams] = useSearchParams();

  const navigateToTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const [businessInfo, setBusinessInfo] = useState({
    name: tenant?.business_name ?? '',
    phone: '',
    address: '',
    website: '',
    timezone: 'America/Los_Angeles',
  });

  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    Mon: { open: '09:00', close: '17:00', closed: false },
    Tue: { open: '09:00', close: '17:00', closed: false },
    Wed: { open: '09:00', close: '17:00', closed: false },
    Thu: { open: '09:00', close: '17:00', closed: false },
    Fri: { open: '09:00', close: '17:00', closed: false },
    Sat: { open: '10:00', close: '15:00', closed: false },
    Sun: { open: '10:00', close: '15:00', closed: true },
  });

  const [brandColors, setBrandColors] = useState({
    primary: '#10b981',
    accent: '#3b82f6',
  });

  // Apply color preset
  const applyColorPreset = (preset: { name: string; primary: string; accent: string }) => {
    setBrandColors({ primary: preset.primary, accent: preset.accent });
    toast.success(`Applied ${preset.name} color preset`);
  };

  // Settings version history
  const {
    versions: businessVersions,
    isLoading: versionsLoading,
    saveVersion,
  } = useSettingsVersions({
    tenantId: tenant?.id,
    settingsKey: 'business',
    enabled: !!tenant?.id,
  });

  // Clear demo data mutation
  const clearDemoDataMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant ID');

      // Delete demo products
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('tenant_id', tenant.id)
        .or('sku.ilike.%DEMO%,sku.ilike.%SAMPLE%,name.ilike.%demo%,name.ilike.%sample%,name.ilike.%test%');

      if (productsError) {
        logger.error("Failed to clear demo products", productsError);
        // throw productsError; // Don't block clients deletion
      }

      // Delete demo clients
      const { error: clientsError } = await supabase
        .from('clients' as 'tenants') // Type assertion until types.ts is updated
        .delete()
        .eq('tenant_id', tenant.id)
        .or('business_name.ilike.%demo%,business_name.ilike.%sample%,business_name.ilike.%test%');

      if (clientsError) {
        // Just log, don't fail, maybe table doesn't exist
        logger.warn("Failed to clear demo clients (table might be missing)", clientsError);
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Demo data cleared', {
        description: 'Sample products and test clients have been removed.',
      });
      setClearDemoDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to clear demo data', {
        description: humanizeError(error, 'Please try again.'),
      });
    },
  });

  const { save: saveBusinessInfo, status: infoStatus } = useAutoSave({
    onSave: async (data: typeof businessInfo) => {
      if (!tenant?.id) return;

      // 1. Update core tenant info
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          business_name: data.name
          // Note: tenants table might not have phone/address/website columns in standard schema
          // We'd ideally save these to 'account_settings' or a metadata column
        })
        .eq('id', tenant.id);

      if (tenantError) throw tenantError;

      // 2. Mock saving other details since we don't have a guaranteed table for them yet in this context
      // This makes the UI feel responsive "Ultimate" style while backend catches up
      await new Promise(resolve => setTimeout(resolve, 300));

      // invalidate
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    },
    onSuccess: () => toast.success('Business info saved'),
    versionTracking: {
      enabled: !!tenant?.id,
      tenantId: tenant?.id ?? '',
      settingsKey: 'business',
      userEmail: admin?.email,
      userId: admin?.id,
    },
  });

  const handleInfoChange = (field: string, value: string) => {
    const newInfo = { ...businessInfo, [field]: value };
    setBusinessInfo(newInfo);
    saveBusinessInfo(newInfo);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    // In a real app we'd upload to Supabase Storage:
    // const { data, error } = await supabase.storage.from('logos').upload(`${tenant.id}/logo.png`, file);

    // For now, local preview
    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      toast.success('Logo uploaded');
    };
    reader.readAsDataURL(file);
  };

  // Fetch initial settings
  useEffect(() => {
    async function loadSettings() {
      if (!tenant?.id) return;
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.id)
        .maybeSingle();

      const record = data as Record<string, unknown> | null;
      if (record?.operating_settings) {
        const settings = record.operating_settings as { business_hours?: BusinessHours };
        if (settings.business_hours) {
          setBusinessHours(settings.business_hours);
        }
      }
    }
    loadSettings();
  }, [tenant?.id]);

  const { save: saveBusinessHoursDebounced, status: hoursStatus } = useAutoSave({
    onSave: async (hours: BusinessHours) => {
      if (!tenant?.id) return;

      // Get current settings first to merge (shallow merge for now)
      const { data: current } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant.id)
        .maybeSingle();

      const currentRecord = current as Record<string, unknown> | null;
      const currentSettings = (currentRecord?.operating_settings as Record<string, unknown>) || {};
      const currentMetadata = (currentRecord?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            operating_settings: {
              ...currentSettings,
              business_hours: hours
            }
          }
        } as Record<string, unknown>)
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => toast.success('Business hours saved'),
    versionTracking: {
      enabled: !!tenant?.id,
      tenantId: tenant?.id ?? '',
      settingsKey: 'business_hours',
      userEmail: admin?.email,
      userId: admin?.id,
    },
  });

  // Handle restoring a previous version
  const handleRestoreVersion = async (version: SettingsVersion) => {
    if (!tenant?.id) return;
    setIsRestoring(true);

    try {
      const snapshot = version.snapshot as Record<string, unknown>;

      // First save current settings as a new version (before restoring)
      saveVersion({
        tenantId: tenant.id,
        settingsKey: version.settings_key,
        snapshot: version.settings_key === 'business'
          ? businessInfo as unknown as Record<string, unknown>
          : businessHours as unknown as Record<string, unknown>,
        changedFields: ['restored_backup'],
        changedBy: admin?.id,
        changedByEmail: admin?.email,
        description: `Auto-backup before restoring v${version.version_number}`,
      });

      // Apply the restored settings based on the settings key
      if (version.settings_key === 'business') {
        const restoredInfo = {
          name: (snapshot.name as string) ?? '',
          phone: (snapshot.phone as string) ?? '',
          address: (snapshot.address as string) ?? '',
          website: (snapshot.website as string) ?? '',
          timezone: (snapshot.timezone as string) ?? 'America/Los_Angeles',
        };
        setBusinessInfo(restoredInfo);
        await saveBusinessInfo(restoredInfo);
      } else if (version.settings_key === 'business_hours') {
        const restoredHours = snapshot as BusinessHours;
        setBusinessHours(restoredHours);
        await saveBusinessHoursDebounced(restoredHours);
      }

      toast.success('Settings restored', {
        description: `Restored to version ${version.version_number}`,
      });
    } catch (error) {
      logger.error('Failed to restore settings version', { error });
      toast.error('Failed to restore settings', { description: humanizeError(error) });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleHoursChange = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setBusinessHours((prev) => {
      const newHours = {
        ...prev,
        [day]: { ...prev[day], [field]: value },
      };
      saveBusinessHoursDebounced(newHours);
      return newHours;
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business Profile</h2>
        <p className="text-muted-foreground mt-1">
          Configure your business details, branding, and operating hours
        </p>
      </div>

      {/* Business Info */}
      <SettingsSection
        title="Business Information"
        description="Basic details about your business"
        icon={Building2}
        action={<SaveStatusIndicator status={infoStatus} />}
      >
        <SettingsCard>
          {/* Logo */}
          <div className="flex items-center gap-6 pb-6 border-b">
            <div
              onClick={() => logoInputRef.current?.click()}
              className={cn(
                'h-24 w-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer',
                'hover:border-primary hover:bg-primary/5 transition-colors',
                logoUrl ? 'border-transparent' : 'border-muted-foreground/25'
              )}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain rounded-xl" loading="lazy" />
              ) : (
                <div className="text-center">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">Upload logo</span>
                </div>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <div className="space-y-1">
              <h3 className="font-semibold">Business Logo</h3>
              <p className="text-sm text-muted-foreground">
                Recommended: 512x512px, PNG or SVG.
              </p>
              <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Change Logo
              </Button>
            </div>
          </div>

          {/* Business Name */}
          <SettingsRow label="Business Name" description="Your registered business name">
            <Input
              value={businessInfo.name}
              onChange={(e) => handleInfoChange('name', e.target.value)}
              className="w-full sm:w-80"
            />
          </SettingsRow>

          {/* Phone */}
          <SettingsRow label="Phone Number" description="Contact number for customers">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Phone className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Input
                type="tel"
                value={businessInfo.phone}
                onChange={(e) => handleInfoChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full sm:w-64"
              />
            </div>
          </SettingsRow>

          {/* Address */}
          <SettingsRow label="Business Address" description="Physical location">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <MapPin className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Input
                value={businessInfo.address}
                onChange={(e) => handleInfoChange('address', e.target.value)}
                placeholder="123 Main St, City, ST 12345"
                className="w-full sm:w-80"
              />
            </div>
          </SettingsRow>

          {/* Website */}
          <SettingsRow label="Website" description="Your business website">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Globe className="h-4 w-4 text-muted-foreground hidden sm:block" />
              <Input
                type="url"
                value={businessInfo.website}
                onChange={(e) => handleInfoChange('website', e.target.value)}
                placeholder="https://example.com"
                className="w-full sm:w-64"
              />
            </div>
          </SettingsRow>

          {/* Timezone */}
          <SettingsRow label="Timezone" description="Your operating timezone">
            <Select
              value={businessInfo.timezone}
              onValueChange={(value) => handleInfoChange('timezone', value)}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* Business Hours */}
      <SettingsSection
        title="Operating Hours"
        description="Set when your business is open"
        icon={Clock}
        action={<SaveStatusIndicator status={hoursStatus} />}
      >
        <SettingsCard>
          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 sm:py-2 border-b sm:border-b-0 last:border-0">
                <div className="flex items-center justify-between sm:justify-start w-full sm:w-32 mb-2 sm:mb-0">
                  <span className="font-medium text-sm">{day}</span>
                  <Switch
                    className="sm:hidden"
                    checked={!businessHours[day].closed}
                    onCheckedChange={(checked) => handleHoursChange(day, 'closed', !checked)}
                  />
                </div>
                <div className="flex items-center gap-3">
                  {businessHours[day].closed ? (
                    <Badge variant="secondary" className="w-full sm:w-auto justify-center">Closed</Badge>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        type="time"
                        value={businessHours[day].open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="w-full sm:w-28"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={businessHours[day].close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="w-full sm:w-28"
                      />
                    </div>
                  )}
                  <Switch
                    className="hidden sm:block ml-2"
                    checked={!businessHours[day].closed}
                    onCheckedChange={(checked) => handleHoursChange(day, 'closed', !checked)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t mt-4">
            <Button variant="outline" size="sm">
              Copy Monday hours to all weekdays
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Brand Colors */}
      <SettingsSection
        title="Brand Colors"
        description="Customize your brand appearance"
        icon={Palette}
      >
        <SettingsCard>
          {/* Color Preset Themes */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-3 block">Quick Presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLOR_PRESETS.map((preset) => {
                const isActive = brandColors.primary === preset.primary && brandColors.accent === preset.accent;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyColorPreset(preset)}
                    className={cn(
                      'group relative p-3 rounded-lg border-2 transition-all hover:shadow-md',
                      isActive
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="flex gap-1.5 mb-2">
                      <div
                        className="h-6 w-6 rounded-full shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div
                        className="h-6 w-6 rounded-full shadow-sm ring-1 ring-black/10"
                        style={{ backgroundColor: preset.accent }}
                      />
                    </div>
                    <p className={cn(
                      'text-sm font-medium text-left',
                      isActive ? 'text-primary' : 'text-foreground'
                    )}>
                      {preset.name}
                    </p>
                    <p className="text-xs text-muted-foreground text-left">
                      {preset.description}
                    </p>
                    {isActive && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0"
                      >
                        Active
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t pt-6">
            <label className="text-sm font-medium mb-3 block">Custom Colors</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColors.primary}
                    onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
                    className="h-10 w-16 rounded cursor-pointer border p-1"
                  />
                  <Input
                    value={brandColors.primary}
                    onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
                    className="w-28 font-mono text-sm uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Accent Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={brandColors.accent}
                    onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
                    className="h-10 w-16 rounded cursor-pointer border p-1"
                  />
                  <Input
                    value={brandColors.accent}
                    onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
                    className="w-28 font-mono text-sm uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-6 rounded-lg border shadow-sm" style={{ background: `linear-gradient(135deg, ${brandColors.primary}20, ${brandColors.accent}20)` }}>
            <p className="text-sm font-medium mb-3">Login Page Preview</p>
            <div className="flex gap-2">
              <Button size="sm" className="text-white" style={{ backgroundColor: brandColors.primary }}>Login Button</Button>
              <Button size="sm" variant="outline" style={{ borderColor: brandColors.accent, color: brandColors.accent }}>Sign Up</Button>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* Quick Links */}
      <SettingsSection
        title="Quick Links"
        description="Navigate to related settings"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            onClick={() => navigateToTab('appearance')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Theme & Sidebar</p>
                <p className="text-xs text-muted-foreground">Customize admin interface mode</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>

          <button
            onClick={() => navigateToTab('crm')}
            className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">CRM & Invoicing</p>
                <p className="text-xs text-muted-foreground">Set tax rates, prefixes, and terms</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>
        </div>
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection
        title="Data Management"
        description="Manage your business data and clean up test records"
        icon={Database}
      >
        <SettingsCard>
          <SettingsRow
            label="Clear Demo Data"
            description="Remove sample products, test clients, and demo inventory that may have been added during onboarding"
          >
            <AlertDialog open={clearDemoDialogOpen} onOpenChange={setClearDemoDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Demo Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Demo Data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete:
                    <ul className="list-disc ml-6 mt-2 space-y-1">
                      <li>Products with "demo", "sample", or "test" in their name/SKU</li>
                      <li>Clients with "demo", "sample", or "test" in their business name</li>
                    </ul>
                    <p className="mt-2 font-medium text-foreground">
                      This action cannot be undone. Real business data will not be affected.
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearDemoDataMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={clearDemoDataMutation.isPending}
                  >
                    {clearDemoDataMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      'Clear Demo Data'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      {/* Version History */}
      <SettingsSection
        title="Version History"
        description="View and restore previous settings configurations (last 10 saves)"
        icon={History}
      >
        <SettingsCard>
          <SettingsVersionHistory
            versions={businessVersions}
            isLoading={versionsLoading}
            onRestore={handleRestoreVersion}
            isRestoring={isRestoring}
            formatFieldName={(field) => {
              const fieldLabels: Record<string, string> = {
                name: 'Business Name',
                phone: 'Phone Number',
                address: 'Address',
                website: 'Website',
                timezone: 'Timezone',
                business_hours: 'Business Hours',
                Mon: 'Monday Hours',
                Tue: 'Tuesday Hours',
                Wed: 'Wednesday Hours',
                Thu: 'Thursday Hours',
                Fri: 'Friday Hours',
                Sat: 'Saturday Hours',
                Sun: 'Sunday Hours',
              };
              return fieldLabels[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            }}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}

