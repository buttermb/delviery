/**
 * Storefront Settings Page
 * Configure store branding, delivery, payments, and more
 * Includes live preview panel for real-time visual feedback
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SaveButton } from '@/components/ui/SaveButton';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  Store,
  Palette,
  Truck,
  CreditCard,
  Clock,
  Globe,
  Save as _Save,
  Eye,
  Share2,
  MapPin,
  Plus,
  Trash2,
  Sparkles,
  Shield,
  Star,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { StoreShareDialog } from '@/components/admin/storefront/StoreShareDialog';
import { generateUrlToken } from '@/utils/menuHelpers';
import { StorefrontSettingsLivePreview } from '@/components/admin/storefront/StorefrontSettingsLivePreview';
import { FeaturedProductsManager } from '@/components/admin/storefront/FeaturedProductsManager';
import { FieldHelp, fieldHelpTexts } from '@/components/ui/field-help';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
// Skeleton already imported above

interface DeliveryZone {
  zip_code: string;
  fee: number;
  min_order?: number;
}

interface TimeSlot {
  label: string;
  start: string;
  end: string;
  enabled: boolean;
}

interface ThemeConfig {
  theme: 'standard' | 'luxury';
  colors?: {
    accent?: string;
  };
}

interface StoreSettings {
  id: string;
  store_name: string;
  slug: string;
  encrypted_url_token: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  custom_domain: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  ga4_measurement_id: string | null;
  is_active: boolean;
  is_public: boolean;
  require_account: boolean;
  require_age_verification: boolean;
  minimum_age: number;
  delivery_zones: DeliveryZone[];
  payment_methods: string[];
  time_slots: TimeSlot[];
  theme_config: ThemeConfig | null;
  free_delivery_threshold: number;
  default_delivery_fee: number;
  checkout_settings: {
    allow_guest_checkout: boolean;
    require_phone: boolean;
    require_address: boolean;
    show_delivery_notes: boolean;
    enable_coupons: boolean;
    enable_tips: boolean;
    venmo_handle?: string;
    zelle_email?: string;
  };
  operating_hours: Record<string, { open: string; close: string; closed: boolean }>;
  // Purchase limits for compliance
  purchase_limits: {
    enabled: boolean;
    max_per_order: number | null;
    max_daily: number | null;
    max_weekly: number | null;
  } | null;
  // Featured products
  featured_product_ids: string[];
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { label: '9am - 12pm', start: '09:00', end: '12:00', enabled: true },
  { label: '12pm - 3pm', start: '12:00', end: '15:00', enabled: true },
  { label: '3pm - 6pm', start: '15:00', end: '18:00', enabled: true },
  { label: '6pm - 9pm', start: '18:00', end: '21:00', enabled: true },
];

const PAYMENT_METHOD_OPTIONS = [
  { id: 'cash', label: 'Cash', icon: '' },
  { id: 'card', label: 'Credit/Debit Card', icon: '' },
  { id: 'apple_pay', label: 'Apple Pay', icon: '' },
  { id: 'google_pay', label: 'Google Pay', icon: '' },
  { id: 'venmo', label: 'Venmo', icon: '' },
  { id: 'zelle', label: 'Zelle', icon: '' },
];

export default function StorefrontSettings() {
  const { tenant } = useTenantAdminAuth();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id;

  const [formData, setFormData] = useState<Partial<StoreSettings>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Fetch store data
  const { data: store, isLoading } = useQuery({
    queryKey: queryKeys.marketplaceStore.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('marketplace_stores')
        .select('id, store_name, slug, encrypted_url_token, tagline, description, logo_url, banner_url, favicon_url, primary_color, secondary_color, accent_color, font_family, custom_domain, meta_title, meta_description, og_image_url, ga4_measurement_id, is_active, is_public, require_account, require_age_verification, minimum_age, delivery_zones, payment_methods, time_slots, theme_config, free_delivery_threshold, default_delivery_fee, checkout_settings, operating_hours, purchase_limits, featured_product_ids')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('Failed to fetch store', error, { component: 'StorefrontSettings' });
        throw error;
      }

      return data;
    },
    enabled: !!tenantId,
  });

  // Initialize form data when store loads
  useEffect(() => {
    if (store) {
      setFormData({
        ...store,
        featured_product_ids: store.featured_product_ids ?? [],
      });
    }
  }, [store]);

  // Fetch featured products for preview
  const { data: featuredProducts } = useQuery({
    queryKey: queryKeys.featuredProductsPreview.byIds(formData.featured_product_ids),
    queryFn: async () => {
      const ids = formData.featured_product_ids ?? [];
      if (ids.length === 0) return [];
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, category')
        .eq('tenant_id', tenantId)
        .in('id', ids);

      if (error) {
        logger.error('Failed to fetch featured products', error, { component: 'StorefrontSettings' });
        return [];
      }
      // Sort by the order in featured_product_ids
      return (data ?? []).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
    enabled: !!tenantId && (formData.featured_product_ids ?? []).length > 0,
  });

  // Memoize preview settings to avoid unnecessary re-renders
  const previewSettings = useMemo(() => ({
    store_name: formData.store_name ?? '',
    tagline: formData.tagline || null,
    logo_url: formData.logo_url || null,
    banner_url: formData.banner_url || null,
    primary_color: formData.primary_color || '#10b981',
    secondary_color: formData.secondary_color || '#059669',
    accent_color: formData.accent_color || '#34d399',
    font_family: formData.font_family || 'Inter',
    theme_config: formData.theme_config ?? null,
    featured_product_ids: formData.featured_product_ids ?? [],
  }), [
    formData.store_name,
    formData.tagline,
    formData.logo_url,
    formData.banner_url,
    formData.primary_color,
    formData.secondary_color,
    formData.accent_color,
    formData.font_family,
    formData.theme_config,
    formData.featured_product_ids,
  ]);

  // Update form field
  const updateField = <K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Update checkout settings
  const updateCheckoutSetting = (key: string, value: boolean | string) => {
    setFormData((prev) => ({
      ...prev,
      checkout_settings: {
        ...prev.checkout_settings,
        [key]: value,
      } as StoreSettings['checkout_settings'],
    }));
    setIsDirty(true);
  };

  // Update operating hours
  const updateHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      operating_hours: {
        ...prev.operating_hours,
        [day]: {
          ...prev.operating_hours?.[day],
          [field]: value,
        },
      },
    }));
    setIsDirty(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      const { error } = await supabase
        .from('marketplace_stores')
        .update({
          store_name: formData.store_name,
          slug: formData.slug,
          tagline: formData.tagline,
          description: formData.description,
          logo_url: formData.logo_url,
          banner_url: formData.banner_url,
          favicon_url: formData.favicon_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          accent_color: formData.accent_color,
          font_family: formData.font_family,
          custom_domain: formData.custom_domain,
          meta_title: formData.meta_title,
          meta_description: formData.meta_description,
          og_image_url: formData.og_image_url,
          ga4_measurement_id: formData.ga4_measurement_id,
          is_public: formData.is_public,
          require_account: formData.require_account,
          require_age_verification: formData.require_age_verification,
          minimum_age: formData.minimum_age,
          delivery_zones: formData.delivery_zones,
          payment_methods: formData.payment_methods,
          time_slots: formData.time_slots,
          theme_config: formData.theme_config,
          free_delivery_threshold: formData.free_delivery_threshold,
          default_delivery_fee: formData.default_delivery_fee,
          checkout_settings: formData.checkout_settings,
          operating_hours: formData.operating_hours,
          purchase_limits: formData.purchase_limits,
          featured_product_ids: formData.featured_product_ids ?? [],
        })
        .eq('id', store.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceStore.byTenant() });
      setIsDirty(false);
      toast.success("Your store settings have been updated.");
    },
    onError: (error) => {
      logger.error('Failed to save settings', error, { component: 'StorefrontSettings' });
      toast.error("Failed to save settings. Please try again.", { description: humanizeError(error) });
    },
  });

  // Regenerate encrypted URL token mutation
  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!store?.id) throw new Error('No store');

      const newToken = generateUrlToken();

      const { error } = await supabase
        .from('marketplace_stores')
        .update({ encrypted_url_token: newToken })
        .eq('id', store.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return newToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplaceStore.byTenant() });
    },
    onError: (error) => {
      logger.error('Failed to regenerate token', error, { component: 'StorefrontSettings' });
      toast.error("Failed to generate new link.", { description: humanizeError(error) });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl space-y-4">
        {/* Header skeleton */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_400px]">
          {/* Settings skeleton */}
          <div className="space-y-6">
            {/* Tabs skeleton */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 shrink-0" />
              ))}
            </div>

            {/* Card skeleton */}
            <div className="rounded-lg border bg-card">
              <div className="p-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-6 w-40" />
                </div>
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="p-6 pt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-24 w-full" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="space-y-4">
                  <Skeleton className="h-5 w-32" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-11 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Preview skeleton */}
          <div className="hidden lg:block">
            <div className="rounded-lg border bg-card p-4 space-y-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-[400px] w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No store found. Please create a store first.</p>
            <Button
              className="mt-4"
              onClick={() => navigate(`/${tenantSlug}/admin/storefront`)}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const storeUrl = `${window.location.origin}/shop/${formData.slug || store.slug}`;

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Store Settings</h1>
          <p className="text-muted-foreground">Configure your online storefront</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? (
              <PanelRightClose className="w-4 h-4 mr-2" />
            ) : (
              <PanelRightOpen className="w-4 h-4 mr-2" />
            )}
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={storeUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="w-4 h-4 mr-2" />
              Open Store
            </a>
          </Button>
          <SaveButton
            size="sm"
            onClick={() => saveMutation.mutate()}
            isPending={saveMutation.isPending}
            isSuccess={saveMutation.isSuccess}
            disabled={!isDirty}
          >
            Save Changes
          </SaveButton>
        </div>
      </div>

      {/* Share Dialog */}
      {store && (
        <StoreShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          store={{
            id: store.id,
            store_name: store.store_name,
            slug: store.slug,
            encrypted_url_token: store.encrypted_url_token,
            is_active: store.is_active,
            is_public: store.is_public,
          }}
          onRegenerateToken={async () => { await regenerateTokenMutation.mutateAsync(); }}
        />
      )}

      {/* Main Content: Settings + Preview */}
      <div className={`grid gap-6 transition-all duration-300 ${showPreview ? 'lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6 min-w-0">
          <TabsList className="inline-flex w-full overflow-x-auto justify-start snap-x scrollbar-hide p-1">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="delivery">Delivery</TabsTrigger>
            <TabsTrigger value="zones">Zones</TabsTrigger>
            <TabsTrigger value="timeslots">Time Slots</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
            <TabsTrigger value="hours">Hours</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  General Settings
                </CardTitle>
                <CardDescription>Basic store information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="store_name">Store Name</Label>
                    <Input
                      id="store_name"
                      value={formData.store_name ?? ''}
                      onChange={(e) => updateField('store_name', e.target.value)}
                      placeholder="My Store"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug" className="flex items-center gap-1.5">
                      Store URL Slug
                      <FieldHelp tooltip={fieldHelpTexts.tenantSlug.tooltip} example={fieldHelpTexts.tenantSlug.example} />
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">/shop/</span>
                      <Input
                        id="slug"
                        value={formData.slug ?? ''}
                        onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        placeholder="my-store"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={formData.tagline ?? ''}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Welcome to our store"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description ?? ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Tell customers about your store..."
                    rows={4}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Store Visibility</h3>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Public Store</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow anyone to view your store
                      </p>
                    </div>
                    <Switch
                      checked={formData.is_public ?? true}
                      onCheckedChange={(checked) => updateField('is_public', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Account</Label>
                      <p className="text-sm text-muted-foreground">
                        Customers must create an account to order
                      </p>
                    </div>
                    <Switch
                      checked={formData.require_account ?? false}
                      onCheckedChange={(checked) => updateField('require_account', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Age Verification</Label>
                      <p className="text-sm text-muted-foreground">
                        Require age verification before viewing
                      </p>
                    </div>
                    <Switch
                      checked={formData.require_age_verification ?? false}
                      onCheckedChange={(checked) => updateField('require_age_verification', checked)}
                    />
                  </div>

                  {formData.require_age_verification && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      <Label htmlFor="minimum_age">Minimum Age</Label>
                      <Input
                        id="minimum_age"
                        type="number"
                        value={formData.minimum_age || 18}
                        onChange={(e) => updateField('minimum_age', parseInt(e.target.value))}
                        className="w-full sm:w-24"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding
                </CardTitle>
                <CardDescription>Customize your store's appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primary_color"
                        type="color"
                        value={formData.primary_color || '#10b981'}
                        onChange={(e) => updateField('primary_color', e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.primary_color || '#10b981'}
                        onChange={(e) => updateField('primary_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondary_color"
                        type="color"
                        value={formData.secondary_color || '#059669'}
                        onChange={(e) => updateField('secondary_color', e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.secondary_color || '#059669'}
                        onChange={(e) => updateField('secondary_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accent_color">Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accent_color"
                        type="color"
                        value={formData.accent_color || '#34d399'}
                        onChange={(e) => updateField('accent_color', e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.accent_color || '#34d399'}
                        onChange={(e) => updateField('accent_color', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-medium">Logo & Images</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="logo_url">Logo URL</Label>
                      <Input
                        id="logo_url"
                        value={formData.logo_url ?? ''}
                        onChange={(e) => updateField('logo_url', e.target.value)}
                        placeholder="https://..."
                      />
                      {formData.logo_url && (
                        <div className="mt-2 aspect-video w-full max-w-[200px] bg-muted rounded-lg flex items-center justify-center border overflow-hidden p-2">
                          <img
                            src={formData.logo_url}
                            alt="Logo preview"
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="banner_url">Banner URL</Label>
                      <Input
                        id="banner_url"
                        value={formData.banner_url ?? ''}
                        onChange={(e) => updateField('banner_url', e.target.value)}
                        placeholder="https://..."
                      />
                      {formData.banner_url && (
                        <div className="mt-2 aspect-[3/1] bg-muted rounded-lg overflow-hidden border">
                          <img
                            src={formData.banner_url}
                            alt="Banner preview"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="favicon_url">Favicon URL</Label>
                    <Input
                      id="favicon_url"
                      value={formData.favicon_url ?? ''}
                      onChange={(e) => updateField('favicon_url', e.target.value)}
                      placeholder="https://... (32x32 recommended)"
                    />
                    {formData.favicon_url && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-8 h-8 rounded border bg-background flex items-center justify-center p-1">
                          <img
                            src={formData.favicon_url}
                            alt="Favicon preview"
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">32x32px preview</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Theme Selector */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Store Theme
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${(formData.theme_config?.theme ?? 'standard') === 'standard'
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-muted hover:border-primary/50'
                        }`}
                      onClick={() => updateField('theme_config', { theme: 'standard' } as ThemeConfig)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded bg-white border" />
                        <div>
                          <p className="font-medium">Standard Theme</p>
                          <p className="text-xs text-muted-foreground">Clean, light design</p>
                        </div>
                      </div>
                      <div className="h-16 rounded bg-gradient-to-r from-gray-100 to-gray-200" />
                    </div>

                    <div
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.theme_config?.theme === 'luxury'
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-muted hover:border-primary/50'
                        }`}
                      onClick={() => updateField('theme_config', { theme: 'luxury' } as ThemeConfig)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded bg-black border border-yellow-500" />
                        <div>
                          <p className="font-medium">Luxury Theme</p>
                          <p className="text-xs text-muted-foreground">Premium, dark design</p>
                        </div>
                      </div>
                      <div className="h-16 rounded bg-gradient-to-r from-gray-900 to-black" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Featured Products Tab */}
          <TabsContent value="featured">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Featured Products
                </CardTitle>
                <CardDescription>
                  Select which products to highlight on your storefront homepage. These appear in the &quot;Featured Products&quot; section.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FeaturedProductsManager
                  selectedIds={formData.featured_product_ids ?? []}
                  onSelectionChange={(ids) => updateField('featured_product_ids', ids)}
                  maxFeatured={8}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivery Tab */}
          <TabsContent value="delivery">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Delivery Settings
                </CardTitle>
                <CardDescription>Configure delivery fees and zones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="default_delivery_fee">Default Delivery Fee ($)</Label>
                    <CurrencyInput
                      id="default_delivery_fee"
                      value={formData.default_delivery_fee || 5}
                      onChange={(e) => updateField('default_delivery_fee', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="free_delivery_threshold">Free Delivery Threshold ($)</Label>
                    <CurrencyInput
                      id="free_delivery_threshold"
                      value={formData.free_delivery_threshold || 100}
                      onChange={(e) => updateField('free_delivery_threshold', parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Orders above this amount get free delivery
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivery Zones Tab */}
          <TabsContent value="zones">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Delivery Zones
                </CardTitle>
                <CardDescription>Set custom delivery fees by zip code</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {(formData.delivery_zones ?? []).map((zone, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-4">
                      <Input
                        placeholder="Zip code"
                        aria-label="Delivery zone zip code"
                        value={zone.zip_code ?? ''}
                        onChange={(e) => {
                          const zones = [...(formData.delivery_zones ?? [])];
                          zones[index] = { ...zones[index], zip_code: e.target.value };
                          updateField('delivery_zones', zones);
                        }}
                        className="w-full sm:w-32"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Fee:</span>
                        <CurrencyInput
                          value={zone.fee ?? 0}
                          onChange={(e) => {
                            const zones = [...(formData.delivery_zones ?? [])];
                            zones[index] = { ...zones[index], fee: parseFloat(e.target.value) };
                            updateField('delivery_zones', zones);
                          }}
                          className="w-full sm:w-28"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Min:</span>
                        <CurrencyInput
                          value={zone.min_order ?? 0}
                          onChange={(e) => {
                            const zones = [...(formData.delivery_zones ?? [])];
                            zones[index] = { ...zones[index], min_order: parseFloat(e.target.value) };
                            updateField('delivery_zones', zones);
                          }}
                          className="w-full sm:w-28"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const zones = (formData.delivery_zones ?? []).filter((_, i) => i !== index);
                          updateField('delivery_zones', zones);
                        }}
                        aria-label="Remove delivery zone"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => {
                      const zones = [...(formData.delivery_zones ?? []), { zip_code: '', fee: 5, min_order: 0 }];
                      updateField('delivery_zones', zones);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Zone
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  If a customer's zip code isn't listed, the default delivery fee will be used.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Slots Tab */}
          <TabsContent value="timeslots">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Delivery Time Slots
                </CardTitle>
                <CardDescription>Let customers choose their delivery window</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Scheduled Delivery</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow customers to select a delivery time slot
                    </p>
                  </div>
                  <Switch
                    checked={(formData.time_slots ?? []).length > 0}
                    onCheckedChange={(checked) => {
                      updateField('time_slots', checked ? DEFAULT_TIME_SLOTS : []);
                    }}
                  />
                </div>

                {(formData.time_slots ?? []).length > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <h4 className="font-medium">Available Time Slots</h4>
                    {(formData.time_slots ?? []).map((slot, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <Switch
                          checked={slot.enabled}
                          onCheckedChange={(checked) => {
                            const slots = [...(formData.time_slots ?? [])];
                            slots[index] = { ...slots[index], enabled: checked };
                            updateField('time_slots', slots);
                          }}
                        />
                        <Input
                          value={slot.label}
                          aria-label="Time slot label"
                          onChange={(e) => {
                            const slots = [...(formData.time_slots ?? [])];
                            slots[index] = { ...slots[index], label: e.target.value };
                            updateField('time_slots', slots);
                          }}
                          className="flex-1"
                        />
                        <Input
                          type="time"
                          value={slot.start}
                          aria-label="Time slot start"
                          onChange={(e) => {
                            const slots = [...(formData.time_slots ?? [])];
                            slots[index] = { ...slots[index], start: e.target.value };
                            updateField('time_slots', slots);
                          }}
                          className="w-full sm:w-28"
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={slot.end}
                          aria-label="Time slot end"
                          onChange={(e) => {
                            const slots = [...(formData.time_slots ?? [])];
                            slots[index] = { ...slots[index], end: e.target.value };
                            updateField('time_slots', slots);
                          }}
                          className="w-full sm:w-28"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const slots = (formData.time_slots ?? []).filter((_, i) => i !== index);
                            updateField('time_slots', slots);
                          }}
                          aria-label="Remove time slot"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      onClick={() => {
                        const slots = [...(formData.time_slots ?? []), { label: 'New Slot', start: '09:00', end: '12:00', enabled: true }];
                        updateField('time_slots', slots);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Time Slot
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Select which payment methods to accept</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PAYMENT_METHOD_OPTIONS.map((method) => (
                  <div key={method.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{method.icon}</span>
                        <Label>{method.label}</Label>
                      </div>
                      <Switch
                        checked={(formData.payment_methods || ['cash', 'card']).includes(method.id)}
                        onCheckedChange={(checked) => {
                          const current = formData.payment_methods || ['cash', 'card'];
                          const updated = checked
                            ? [...current, method.id]
                            : current.filter((m) => m !== method.id);
                          updateField('payment_methods', updated);
                        }}
                      />
                    </div>
                    {method.id === 'venmo' && (formData.payment_methods || []).includes('venmo') && (
                      <div className="ml-11">
                        <Label htmlFor="venmo_handle" className="text-sm text-muted-foreground">
                          Venmo Handle (e.g. @your-store)
                        </Label>
                        <Input
                          id="venmo_handle"
                          className="mt-1 max-w-xs"
                          placeholder="@your-store"
                          value={formData.checkout_settings?.venmo_handle || ''}
                          onChange={(e) => updateCheckoutSetting('venmo_handle', e.target.value)}
                        />
                      </div>
                    )}
                    {method.id === 'zelle' && (formData.payment_methods || []).includes('zelle') && (
                      <div className="ml-11">
                        <Label htmlFor="zelle_email" className="text-sm text-muted-foreground">
                          Zelle Email or Phone (shown to customers)
                        </Label>
                        <Input
                          id="zelle_email"
                          className="mt-1 max-w-xs"
                          placeholder="store@example.com or (555) 123-4567"
                          value={formData.checkout_settings?.zelle_email || ''}
                          onChange={(e) => updateCheckoutSetting('zelle_email', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-4">
                  At least one payment method must be enabled.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checkout Tab */}
          <TabsContent value="checkout">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Checkout Settings
                </CardTitle>
                <CardDescription>Configure checkout options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Allow Guest Checkout</Label>
                      <p className="text-sm text-muted-foreground">
                        Let customers checkout without creating an account
                      </p>
                    </div>
                    <Switch
                      checked={formData.checkout_settings?.allow_guest_checkout ?? true}
                      onCheckedChange={(checked) => updateCheckoutSetting('allow_guest_checkout', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Phone Number</Label>
                      <p className="text-sm text-muted-foreground">
                        Require phone for delivery updates
                      </p>
                    </div>
                    <Switch
                      checked={formData.checkout_settings?.require_phone ?? true}
                      onCheckedChange={(checked) => updateCheckoutSetting('require_phone', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Coupons</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow coupon codes at checkout
                      </p>
                    </div>
                    <Switch
                      checked={formData.checkout_settings?.enable_coupons ?? true}
                      onCheckedChange={(checked) => updateCheckoutSetting('enable_coupons', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Show Delivery Notes</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow customers to add delivery instructions
                      </p>
                    </div>
                    <Switch
                      checked={formData.checkout_settings?.show_delivery_notes ?? true}
                      onCheckedChange={(checked) => updateCheckoutSetting('show_delivery_notes', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Tips</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow customers to add tips at checkout
                      </p>
                    </div>
                    <Switch
                      checked={formData.checkout_settings?.enable_tips ?? false}
                      onCheckedChange={(checked) => updateCheckoutSetting('enable_tips', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Limits Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Purchase Limits
                </CardTitle>
                <CardDescription>Set limits for regulatory compliance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Purchase Limits</Label>
                    <p className="text-sm text-muted-foreground">
                      Enforce limits on order quantities
                    </p>
                  </div>
                  <Switch
                    checked={formData.purchase_limits?.enabled ?? false}
                    onCheckedChange={(checked) =>
                      updateField('purchase_limits', {
                        ...formData.purchase_limits,
                        enabled: checked,
                        max_per_order: formData.purchase_limits?.max_per_order ?? null,
                        max_daily: formData.purchase_limits?.max_daily ?? null,
                        max_weekly: formData.purchase_limits?.max_weekly ?? null,
                      })
                    }
                  />
                </div>

                {formData.purchase_limits?.enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-muted">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_per_order">Max Per Order ($)</Label>
                        <Input
                          id="max_per_order"
                          type="number"
                          step="1"
                          placeholder="No limit"
                          value={formData.purchase_limits?.max_per_order || ''}
                          onChange={(e) =>
                            updateField('purchase_limits', {
                              ...formData.purchase_limits,
                              enabled: true,
                              max_per_order: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum total value per transaction
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_daily">Max Daily ($)</Label>
                        <Input
                          id="max_daily"
                          type="number"
                          step="1"
                          placeholder="No limit"
                          value={formData.purchase_limits?.max_daily || ''}
                          onChange={(e) =>
                            updateField('purchase_limits', {
                              ...formData.purchase_limits,
                              enabled: true,
                              max_daily: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum per customer per day
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_weekly">Max Weekly ($)</Label>
                        <Input
                          id="max_weekly"
                          type="number"
                          step="1"
                          placeholder="No limit"
                          value={formData.purchase_limits?.max_weekly || ''}
                          onChange={(e) =>
                            updateField('purchase_limits', {
                              ...formData.purchase_limits,
                              enabled: true,
                              max_weekly: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Maximum per customer per week
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                      Daily and weekly limits are tracked by customer email address.
                      Customers must provide an email to enforce these limits.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Operating Hours
                </CardTitle>
                <CardDescription>Set your store's hours of operation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {DAYS.map((day) => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-full sm:w-28 capitalize font-medium">{day}</div>
                      <Switch
                        checked={!formData.operating_hours?.[day]?.closed}
                        onCheckedChange={(checked) => updateHours(day, 'closed', !checked)}
                      />
                      {!formData.operating_hours?.[day]?.closed && (
                        <>
                          <Input
                            type="time"
                            value={formData.operating_hours?.[day]?.open ?? '09:00'}
                            onChange={(e) => updateHours(day, 'open', e.target.value)}
                            aria-label={`${day} opening time`}
                            className="w-32"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={formData.operating_hours?.[day]?.close ?? '21:00'}
                            onChange={(e) => updateHours(day, 'close', e.target.value)}
                            aria-label={`${day} closing time`}
                            className="w-32"
                          />
                        </>
                      )}
                      {formData.operating_hours?.[day]?.closed && (
                        <span className="text-muted-foreground">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  SEO & Domain
                </CardTitle>
                <CardDescription>Search engine and sharing settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title ?? ''}
                    onChange={(e) => updateField('meta_title', e.target.value)}
                    placeholder="Your Store Name - Tagline"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    value={formData.meta_description ?? ''}
                    onChange={(e) => updateField('meta_description', e.target.value)}
                    placeholder="A brief description of your store for search engines..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="og_image_url">Social Sharing Image URL</Label>
                  <Input
                    id="og_image_url"
                    value={formData.og_image_url ?? ''}
                    onChange={(e) => updateField('og_image_url', e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended size: 1200x630 pixels
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="custom_domain">Custom Domain</Label>
                  <Input
                    id="custom_domain"
                    value={formData.custom_domain ?? ''}
                    onChange={(e) => updateField('custom_domain', e.target.value)}
                    placeholder="shop.yourdomain.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Point a CNAME record to our servers to use a custom domain
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="ga4_measurement_id">Google Analytics 4 Measurement ID</Label>
                  <Input
                    id="ga4_measurement_id"
                    value={formData.ga4_measurement_id ?? ''}
                    onChange={(e) => updateField('ga4_measurement_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your GA4 Measurement ID to track page views, add-to-cart events, and purchases.
                    Find it in your Google Analytics admin under Data Streams.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Live Preview Panel */}
        {showPreview && (
          <div className="hidden lg:block sticky top-6 self-start">
            <StorefrontSettingsLivePreview
              settings={previewSettings}
              featuredProducts={featuredProducts ?? []}
            />
          </div>
        )}
      </div>
    </div>
  );
}





