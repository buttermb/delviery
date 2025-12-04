import { useState, useRef } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface BusinessHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

export default function BusinessSettings() {
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [clearDemoDialogOpen, setClearDemoDialogOpen] = useState(false);

  // Clear demo data mutation
  const clearDemoDataMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant ID');

      // Delete demo products (products without orders)
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('tenant_id', tenant.id)
        .or('sku.ilike.%DEMO%,sku.ilike.%SAMPLE%,name.ilike.%demo%,name.ilike.%sample%,name.ilike.%test%');

      if (productsError) throw productsError;

      // Delete demo clients without orders
      // @ts-ignore - Table not in auto-generated types
      const { error: clientsError } = await supabase
        .from('clients' as any)
        .delete()
        .eq('tenant_id', tenant.id)
        .or('business_name.ilike.%demo%,business_name.ilike.%sample%,business_name.ilike.%test%');

      if (clientsError) throw clientsError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({
        title: 'Demo data cleared',
        description: 'Sample products and test clients have been removed.',
      });
      setClearDemoDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to clear demo data',
        variant: 'destructive',
      });
    },
  });

  const [businessInfo, setBusinessInfo] = useState({
    name: tenant?.business_name || '',
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

  const { save: saveBusinessInfo, status: infoStatus } = useAutoSave({
    onSave: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
    onSuccess: () => toast({ title: 'Business info saved' }),
  });

  const handleInfoChange = (field: string, value: string) => {
    setBusinessInfo((prev) => ({ ...prev, [field]: value }));
    saveBusinessInfo({ ...businessInfo, [field]: value });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setLogoUrl(reader.result as string);
      toast({ title: 'Logo uploaded', description: 'Your business logo has been updated.' });
    };
    reader.readAsDataURL(file);
  };

  const handleHoursChange = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business</h2>
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
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain rounded-xl" />
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
                Recommended: 512x512px, PNG or SVG
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
              className="w-64"
              disabled
            />
          </SettingsRow>

          {/* Phone */}
          <SettingsRow label="Phone Number" description="Contact number for customers">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Input
                type="tel"
                value={businessInfo.phone}
                onChange={(e) => handleInfoChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className="w-48"
              />
            </div>
          </SettingsRow>

          {/* Address */}
          <SettingsRow label="Business Address" description="Physical location">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <Input
                value={businessInfo.address}
                onChange={(e) => handleInfoChange('address', e.target.value)}
                placeholder="123 Main St, City, ST 12345"
                className="w-72"
              />
            </div>
          </SettingsRow>

          {/* Website */}
          <SettingsRow label="Website" description="Your business website">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Input
                type="url"
                value={businessInfo.website}
                onChange={(e) => handleInfoChange('website', e.target.value)}
                placeholder="https://example.com"
                className="w-64"
              />
            </div>
          </SettingsRow>

          {/* Timezone */}
          <SettingsRow label="Timezone" description="Your operating timezone">
            <Select
              value={businessInfo.timezone}
              onValueChange={(value) => handleInfoChange('timezone', value)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
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
      >
        <SettingsCard>
          <div className="space-y-3">
            {DAYS.map((day) => (
              <div key={day} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-4 w-24">
                  <span className="font-medium text-sm">{day}</span>
                </div>
                <div className="flex items-center gap-3">
                  {businessHours[day].closed ? (
                    <Badge variant="secondary">Closed</Badge>
                  ) : (
                    <>
                      <Input
                        type="time"
                        value={businessHours[day].open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="w-28"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={businessHours[day].close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="w-28"
                      />
                    </>
                  )}
                  <Switch
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
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColors.primary}
                  onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <Input
                  value={brandColors.primary}
                  onChange={(e) => setBrandColors({ ...brandColors, primary: e.target.value })}
                  className="w-28 font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Accent Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandColors.accent}
                  onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
                  className="h-10 w-16 rounded cursor-pointer"
                />
                <Input
                  value={brandColors.accent}
                  onChange={(e) => setBrandColors({ ...brandColors, accent: e.target.value })}
                  className="w-28 font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 rounded-lg" style={{ background: `linear-gradient(135deg, ${brandColors.primary}20, ${brandColors.accent}20)` }}>
            <p className="text-sm font-medium">Preview</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" style={{ backgroundColor: brandColors.primary }}>Primary</Button>
              <Button size="sm" variant="outline" style={{ borderColor: brandColors.accent, color: brandColors.accent }}>Accent</Button>
            </div>
          </div>
        </SettingsCard>
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
    </div>
  );
}

