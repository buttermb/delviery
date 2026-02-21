/**
 * SEO Settings Component
 * Manage storefront SEO settings including meta tags, social share images,
 * sitemap generation, and per-product SEO overrides.
 *
 * Task 201: Create storefront SEO settings in admin
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import Save from 'lucide-react/dist/esm/icons/save';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Search from 'lucide-react/dist/esm/icons/search';
import Globe from 'lucide-react/dist/esm/icons/globe';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Image from 'lucide-react/dist/esm/icons/image';
import Tag from 'lucide-react/dist/esm/icons/tag';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Package from 'lucide-react/dist/esm/icons/package';
import X from 'lucide-react/dist/esm/icons/x';
import Check from 'lucide-react/dist/esm/icons/check';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/utils/toastHelpers';
import { GoogleSearchPreview } from '@/components/admin/storefront/GoogleSearchPreview';
import { OGImagePreview } from '@/components/admin/storefront/OGImagePreview';

// ============================================================================
// Types
// ============================================================================

interface TenantSEOSettings {
  id: string;
  tenant_id: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
  seo_og_image_url?: string | null;
  seo_favicon_url?: string | null;
  seo_sitemap_auto_generate?: boolean;
  seo_sitemap_last_generated?: string | null;
  seo_robots_txt?: string | null;
  updated_at?: string;
}

interface ProductSEOOverride {
  product_id: string;
  product_name: string;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  image_url: string | null;
}

// ============================================================================
// Form Schema
// ============================================================================

const seoFormSchema = z.object({
  seo_title: z
    .string()
    .max(70, 'Title should be 70 characters or less for optimal SEO')
    .optional()
    .nullable(),
  seo_description: z
    .string()
    .max(160, 'Description should be 160 characters or less for optimal SEO')
    .optional()
    .nullable(),
  seo_keywords: z
    .string()
    .max(500, 'Keywords should be 500 characters or less')
    .optional()
    .nullable(),
  seo_og_image_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  seo_favicon_url: z
    .string()
    .url('Please enter a valid URL')
    .optional()
    .nullable()
    .or(z.literal('')),
  seo_sitemap_auto_generate: z.boolean().default(true),
  seo_robots_txt: z
    .string()
    .max(2000, 'Robots.txt content should be 2000 characters or less')
    .optional()
    .nullable(),
});

type SEOFormValues = z.infer<typeof seoFormSchema>;

const productSEOFormSchema = z.object({
  seo_title: z
    .string()
    .max(70, 'Title should be 70 characters or less')
    .optional()
    .nullable(),
  seo_description: z
    .string()
    .max(160, 'Description should be 160 characters or less')
    .optional()
    .nullable(),
  seo_keywords: z
    .string()
    .max(500, 'Keywords should be 500 characters or less')
    .optional()
    .nullable(),
});

type ProductSEOFormValues = z.infer<typeof productSEOFormSchema>;

// Query keys
const seoSettingsKeys = {
  all: ['seo-settings'] as const,
  settings: (tenantId: string) => [...seoSettingsKeys.all, 'tenant', tenantId] as const,
  products: (tenantId: string) => [...seoSettingsKeys.all, 'products', tenantId] as const,
};

// ============================================================================
// Main Component
// ============================================================================

export function SEOSettings() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [productSearch, setProductSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductSEOOverride | null>(null);
  const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false);

  // Get store URL for previews
  const storeUrl = useMemo(() => {
    if (!tenantSlug) return 'floraiq.com/shop/your-store';
    return `floraiq.com/shop/${tenantSlug}`;
  }, [tenantSlug]);

  // ============================================================================
  // Queries
  // ============================================================================

  // Fetch SEO settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError,
  } = useQuery({
    queryKey: seoSettingsKeys.settings(tenant?.id ?? ''),
    queryFn: async (): Promise<TenantSEOSettings | null> => {
      if (!tenant?.id) return null;

      const { data, error } = await (supabase as any)
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch SEO settings', error, {
          component: 'SEOSettings',
          tenantId: tenant.id,
        });
        throw error;
      }

      return data as TenantSEOSettings | null;
    },
    enabled: !!tenant?.id,
  });

  // Fetch products for SEO overrides
  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: seoSettingsKeys.products(tenant?.id ?? ''),
    queryFn: async (): Promise<ProductSEOOverride[]> => {
      if (!tenant?.id) return [];

      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, slug, seo_title, seo_description, image_url')
        .eq('tenant_id', tenant.id)
        .order('name');

      if (error) {
        logger.error('Failed to fetch products for SEO', error, {
          component: 'SEOSettings',
          tenantId: tenant.id,
        });
        throw error;
      }

      return (data ?? []).map((product) => ({
        product_id: product.id,
        product_name: product.name,
        slug: product.slug,
        seo_title: (product as Record<string, unknown>).seo_title as string | null ?? null,
        seo_description: (product as Record<string, unknown>).seo_description as string | null ?? null,
        seo_keywords: null,
        image_url: product.image_url,
      }));
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });

  // ============================================================================
  // Form Setup
  // ============================================================================

  const form = useForm<SEOFormValues>({
    resolver: zodResolver(seoFormSchema),
    defaultValues: {
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      seo_og_image_url: '',
      seo_favicon_url: '',
      seo_sitemap_auto_generate: true,
      seo_robots_txt: '',
    },
  });

  const productForm = useForm<ProductSEOFormValues>({
    resolver: zodResolver(productSEOFormSchema),
    defaultValues: {
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
    },
  });

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      form.reset({
        seo_title: settings.seo_title ?? '',
        seo_description: settings.seo_description ?? '',
        seo_keywords: settings.seo_keywords ?? '',
        seo_og_image_url: settings.seo_og_image_url ?? '',
        seo_favicon_url: settings.seo_favicon_url ?? '',
        seo_sitemap_auto_generate: settings.seo_sitemap_auto_generate ?? true,
        seo_robots_txt: settings.seo_robots_txt ?? '',
      });
    }
  }, [settings, form]);

  // Update product form when editing
  useEffect(() => {
    if (editingProduct) {
      productForm.reset({
        seo_title: editingProduct.seo_title ?? '',
        seo_description: editingProduct.seo_description ?? '',
        seo_keywords: editingProduct.seo_keywords ?? '',
      });
    }
  }, [editingProduct, productForm]);

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearch.trim()) return products;

    const query = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(query) ||
        (p.slug && p.slug.toLowerCase().includes(query))
    );
  }, [products, productSearch]);

  // Products with SEO overrides
  const productsWithOverrides = useMemo(() => {
    return filteredProducts.filter((p) => p.seo_title || p.seo_description);
  }, [filteredProducts]);

  // ============================================================================
  // Mutations
  // ============================================================================

  // Save SEO settings
  const saveMutation = useMutation({
    mutationFn: async (values: SEOFormValues) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const updateData = {
        tenant_id: tenant.id,
        seo_title: values.seo_title || null,
        seo_description: values.seo_description || null,
        seo_keywords: values.seo_keywords || null,
        seo_og_image_url: values.seo_og_image_url || null,
        seo_favicon_url: values.seo_favicon_url || null,
        seo_sitemap_auto_generate: values.seo_sitemap_auto_generate,
        seo_robots_txt: values.seo_robots_txt || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any).from('tenant_settings').upsert(updateData, {
        onConflict: 'tenant_id',
      });

      if (error) {
        logger.error('Failed to save SEO settings', error, {
          component: 'SEOSettings',
        });
        throw error;
      }

      logger.info('Saved SEO settings', {
        component: 'SEOSettings',
        tenantId: tenant.id,
      });

      return values;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seoSettingsKeys.settings(tenant?.id ?? '') });
      showSuccessToast('SEO Settings Saved', 'Your SEO settings have been updated successfully');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save settings';
      logger.error('Save SEO settings failed', error, { component: 'SEOSettings' });
      showErrorToast('Save Failed', message);
    },
  });

  // Save product SEO override
  const saveProductMutation = useMutation({
    mutationFn: async ({
      productId,
      values,
    }: {
      productId: string;
      values: ProductSEOFormValues;
    }) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const { error } = await (supabase as any)
        .from('products')
        .update({
          seo_title: values.seo_title || null,
          seo_description: values.seo_description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('tenant_id', tenant.id);

      if (error) {
        logger.error('Failed to save product SEO override', error, {
          component: 'SEOSettings',
          productId,
        });
        throw error;
      }

      logger.info('Saved product SEO override', {
        component: 'SEOSettings',
        productId,
      });

      return { productId, values };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seoSettingsKeys.products(tenant?.id ?? '') });
      showSuccessToast('Product SEO Updated', 'Product SEO settings saved');
      setEditingProduct(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to save';
      showErrorToast('Save Failed', message);
    },
  });

  // Generate sitemap
  const handleGenerateSitemap = useCallback(async () => {
    if (!tenant?.id || !tenantSlug) return;

    setIsGeneratingSitemap(true);

    try {
      // Generate sitemap XML content
      const sitemapEntries: string[] = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        `  <url>`,
        `    <loc>https://floraiq.com/shop/${tenantSlug}</loc>`,
        `    <changefreq>daily</changefreq>`,
        `    <priority>1.0</priority>`,
        `  </url>`,
      ];

      // Add product URLs
      if (products) {
        for (const product of products) {
          if (product.slug) {
            sitemapEntries.push(
              `  <url>`,
              `    <loc>https://floraiq.com/shop/${tenantSlug}/product/${product.slug}</loc>`,
              `    <changefreq>weekly</changefreq>`,
              `    <priority>0.8</priority>`,
              `  </url>`
            );
          }
        }
      }

      sitemapEntries.push(`</urlset>`);

      // Update last generated timestamp
      const { error } = await (supabase as any)
        .from('tenant_settings')
        .upsert(
          {
            tenant_id: tenant.id,
            seo_sitemap_last_generated: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        );

      if (error) {
        throw error;
      }

      // Download sitemap
      const blob = new Blob([sitemapEntries.join('\n')], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sitemap.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: seoSettingsKeys.settings(tenant.id) });
      showSuccessToast('Sitemap Generated', 'Your sitemap has been generated and downloaded');

      logger.info('Sitemap generated', {
        component: 'SEOSettings',
        tenantId: tenant.id,
        productCount: products?.length ?? 0,
      });
    } catch (error) {
      logger.error('Failed to generate sitemap', error, { component: 'SEOSettings' });
      showErrorToast('Generation Failed', 'Could not generate sitemap');
    } finally {
      setIsGeneratingSitemap(false);
    }
  }, [tenant?.id, tenantSlug, products, queryClient]);

  // Reset product to defaults
  const handleResetProduct = useCallback(
    async (productId: string) => {
      if (!tenant?.id) return;

      try {
        const { error } = await (supabase as any)
          .from('products')
          .update({
            seo_title: null,
            seo_description: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId)
          .eq('tenant_id', tenant.id);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: seoSettingsKeys.products(tenant.id) });
        showInfoToast('Product Reset', 'Product will use default SEO settings');
      } catch (error) {
        logger.error('Failed to reset product SEO', error, { component: 'SEOSettings' });
        showErrorToast('Reset Failed', 'Could not reset product SEO');
      }
    },
    [tenant?.id, queryClient]
  );

  // Form submit handler
  const onSubmit = form.handleSubmit((values) => {
    saveMutation.mutate(values);
  });

  // Product form submit handler
  const onProductSubmit = productForm.handleSubmit((values) => {
    if (!editingProduct) return;
    saveProductMutation.mutate({ productId: editingProduct.product_id, values });
  });

  // Watch form values for preview
  const watchedTitle = form.watch('seo_title');
  const watchedDescription = form.watch('seo_description');
  const watchedOgImage = form.watch('seo_og_image_url');
  const watchedFavicon = form.watch('seo_favicon_url');

  // ============================================================================
  // Loading & Error States
  // ============================================================================

  if (isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (settingsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load SEO settings. Please try refreshing the page.
        </AlertDescription>
      </Alert>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SEO Settings</h2>
          <p className="text-muted-foreground">
            Optimize your storefront for search engines and social media
          </p>
        </div>
        <Button onClick={onSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Social Sharing
          </TabsTrigger>
          <TabsTrigger value="sitemap" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sitemap
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product SEO
          </TabsTrigger>
        </TabsList>

        {/* General SEO Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Meta Tags
                </CardTitle>
                <CardDescription>
                  Configure how your store appears in search engine results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="seo_title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Page Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your Store Name | Premium Products"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            {(field.value?.length ?? 0)}/70 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seo_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meta Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe your store in 1-2 sentences..."
                              className="resize-none"
                              rows={3}
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            {(field.value?.length ?? 0)}/160 characters
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seo_keywords"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Keywords</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="keyword1, keyword2, keyword3"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Comma-separated keywords for your store
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="seo_favicon_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Favicon URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/favicon.ico"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            The small icon shown in browser tabs
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="space-y-4">
              <GoogleSearchPreview
                title={watchedTitle || tenant?.business_name || 'Your Store'}
                description={
                  watchedDescription ||
                  'Welcome to our store. Browse our products and place your order today.'
                }
                url={`https://${storeUrl}`}
                faviconUrl={watchedFavicon}
              />
            </div>
          </div>
        </TabsContent>

        {/* Social Sharing Tab */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Social Share Image
                </CardTitle>
                <CardDescription>
                  Configure how your store appears when shared on social media
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    <FormField
                      control={form.control}
                      name="seo_og_image_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Open Graph Image URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/og-image.jpg"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            Recommended size: 1200x630px for best results across platforms
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchedOgImage && (
                      <div className="mt-4">
                        <Label className="text-sm text-muted-foreground">Image Preview</Label>
                        <div className="mt-2 rounded-lg border overflow-hidden">
                          <img
                            src={watchedOgImage}
                            alt="OG Image Preview"
                            className="w-full h-auto max-h-48 object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>

            <OGImagePreview
              title={watchedTitle || tenant?.business_name || 'Your Store'}
              description={
                watchedDescription ||
                'Welcome to our store. Browse our products and place your order today.'
              }
              imageUrl={watchedOgImage || null}
              siteUrl={`https://${storeUrl}`}
              siteName={tenant?.business_name || 'Your Store'}
            />
          </div>
        </TabsContent>

        {/* Sitemap Tab */}
        <TabsContent value="sitemap" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Sitemap Configuration
                </CardTitle>
                <CardDescription>
                  Manage your store&apos;s sitemap for search engine crawlers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div>
                    <h4 className="font-medium">Auto-Generate Sitemap</h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically update sitemap when products change
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="seo_sitemap_auto_generate"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Generate Sitemap Now</h4>
                      <p className="text-sm text-muted-foreground">
                        Download a fresh sitemap.xml file
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleGenerateSitemap}
                      disabled={isGeneratingSitemap}
                    >
                      {isGeneratingSitemap ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Generate
                    </Button>
                  </div>
                  {settings?.seo_sitemap_last_generated && (
                    <p className="text-xs text-muted-foreground">
                      Last generated:{' '}
                      {new Date(settings.seo_sitemap_last_generated).toLocaleString()}
                    </p>
                  )}
                </div>

                <Separator />

                <FormField
                  control={form.control}
                  name="seo_robots_txt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom robots.txt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: https://${storeUrl}/sitemap.xml`}
                          className="font-mono text-sm resize-none"
                          rows={6}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Configure crawler access rules (optional)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sitemap Preview</CardTitle>
                <CardDescription>URLs that will be included in your sitemap</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <Badge variant="secondary">Homepage</Badge>
                      <span className="text-sm font-mono truncate">
                        https://{storeUrl}
                      </span>
                    </div>
                    {isLoadingProducts ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-8" />
                        ))}
                      </div>
                    ) : (
                      products?.slice(0, 20).map((product) => (
                        <div
                          key={product.product_id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                        >
                          <Badge variant="outline">Product</Badge>
                          <span className="text-sm font-mono truncate">
                            /product/{product.slug || product.product_id}
                          </span>
                        </div>
                      ))
                    )}
                    {products && products.length > 20 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        And {products.length - 20} more products...
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Product SEO Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Per-Product SEO Overrides
              </CardTitle>
              <CardDescription>
                Customize SEO settings for individual products. Products without overrides use
                default settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    aria-label="Search products"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                  {productSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setProductSearch('')}
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Products with overrides */}
              {productsWithOverrides.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Products with Custom SEO ({productsWithOverrides.length})
                  </h4>
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Custom Title</TableHead>
                          <TableHead>Custom Description</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productsWithOverrides.map((product) => (
                          <TableRow key={product.product_id}>
                            <TableCell className="font-medium">{product.product_name}</TableCell>
                            <TableCell>
                              {product.seo_title ? (
                                <span className="text-sm">{product.seo_title}</span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {product.seo_description ? (
                                <span className="text-sm line-clamp-1">
                                  {product.seo_description}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingProduct(product)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResetProduct(product.product_id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* All products */}
              <div>
                <h4 className="text-sm font-medium mb-2">All Products</h4>
                {isLoadingProducts ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No products found
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>SEO Status</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => (
                            <TableRow key={product.product_id}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {product.image_url ? (
                                    <img
                                      src={product.image_url}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <span className="font-medium">{product.product_name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-mono text-sm text-muted-foreground">
                                  {product.slug || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                {product.seo_title || product.seo_description ? (
                                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                                    <Check className="h-3 w-3" />
                                    Custom
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">Default</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingProduct(product)}
                                >
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Product Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Product SEO</DialogTitle>
            <DialogDescription>
              Customize SEO settings for {editingProduct?.product_name}
            </DialogDescription>
          </DialogHeader>

          <Form {...productForm}>
            <form onSubmit={onProductSubmit} className="space-y-4">
              <FormField
                control={productForm.control}
                name="seo_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={editingProduct?.product_name || 'Product name'}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {(field.value?.length ?? 0)}/70 characters. Leave empty to use product name.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={productForm.control}
                name="seo_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this product for search engines..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>
                      {(field.value?.length ?? 0)}/160 characters. Leave empty to use product
                      description.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={productForm.control}
                name="seo_keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="keyword1, keyword2, keyword3"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormDescription>Product-specific keywords (optional)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {editingProduct && (
                <div className="pt-4 border-t">
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Search Result Preview
                  </Label>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="space-y-1">
                      <p className="text-[#1a0dab] text-lg hover:underline cursor-pointer">
                        {productForm.watch('seo_title') || editingProduct.product_name}
                      </p>
                      <p className="text-sm text-green-700">
                        {storeUrl}/product/{editingProduct.slug || editingProduct.product_id}
                      </p>
                      <p className="text-sm text-gray-600">
                        {productForm.watch('seo_description') ||
                          'Product description will appear here...'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingProduct(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saveProductMutation.isPending}>
                  {saveProductMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
