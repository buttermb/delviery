import { logger } from '@/lib/logger';
/**
 * Marketplace Listing Form Component
 * Form for creating/editing marketplace product listings
 */

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { X, Loader2, Plus, Trash2, FileText, Image as ImageIcon, Lock } from 'lucide-react';
import { encryptLabResults } from '@/lib/encryption/sensitive-fields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFeatureFlags } from '@/config/featureFlags';
import { Checkbox } from '@/components/ui/checkbox';
import { queryKeys } from '@/lib/queryKeys';

const PRODUCT_TYPES = [
  { value: 'flower', label: 'Flower' },
  { value: 'concentrate', label: 'Concentrate' },
  { value: 'edible', label: 'Edible' },
  { value: 'vape', label: 'Vape' },
  { value: 'topical', label: 'Topical' },
  { value: 'tincture', label: 'Tincture' },
  { value: 'other', label: 'Other' },
];

const STRAIN_TYPES = [
  { value: 'indica', label: 'Indica' },
  { value: 'sativa', label: 'Sativa' },
  { value: 'hybrid', label: 'Hybrid' },
];

const UNIT_TYPES = [
  { value: 'lb', label: 'Pound (lb)' },
  { value: 'oz', label: 'Ounce (oz)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'unit', label: 'Unit' },
];

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public - Visible to all buyers' },
  { value: 'verified_only', label: 'Verified Only - Only verified business buyers' },
  { value: 'private', label: 'Private - Hidden from marketplace' },
];

const bulkPricingSchema = z.object({
  quantity: z.number().min(1),
  price: z.number().min(0.01),
});

const listingSchema = z.object({
  product_name: z.string().min(2, 'Product name is required'),
  product_type: z.string().min(1, 'Product type is required'),
  strain_type: z.string().optional(),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  base_price: z.number().min(0.01, 'Price must be greater than 0'),
  bulk_pricing: z.array(bulkPricingSchema).optional(),
  min_order_quantity: z.number().min(1).default(1),
  max_order_quantity: z.number().optional(),
  quantity_available: z.number().min(0).default(0),
  unit_type: z.string().default('lb'),
  images: z.array(z.string().url()).max(6, 'Maximum 6 images allowed'),
  visibility: z.enum(['public', 'verified_only', 'private']).default('public'),
  tags: z.array(z.string()).optional(),
  // Lab results (will be encrypted)
  lab_results: z.object({
    thc_percent: z.number().optional(),
    cbd_percent: z.number().optional(),
    terpenes: z.record(z.number()).optional(),
    batch_number: z.string().optional(),
    lab_certificate_url: z.string().url().optional(),
    test_date: z.string().optional(),
    lab_name: z.string().optional(),
  }).optional(),
  has_lab_results: z.boolean().default(false),
});

type ListingFormData = z.infer<typeof listingSchema>;

interface ListingFormProps {
  listingId?: string;
  onSuccess?: () => void;
}

export function ListingForm({ listingId, onSuccess }: ListingFormProps) {
  const { shouldAutoApprove } = useFeatureFlags();
  const { tenant } = useTenantAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadingLabResults, setUploadingLabResults] = useState(false);

  // Get product data from navigation state (if coming from product list)
  const productData = (location.state as { productData?: Record<string, unknown> })?.productData;

  // Fetch existing listing if editing
  const { data: existingListing } = useQuery({
    queryKey: queryKeys.marketplaceListings.detail(listingId),
    queryFn: async () => {
      if (!listingId) return null;

      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('id', listingId)
        .maybeSingle();

      if (error) {
        logger.error('Failed to fetch listing', error, { component: 'ListingForm' });
        throw error;
      }

      return data;
    },
    enabled: !!listingId,
  });

  // Fetch marketplace profile
  const { data: profile } = useQuery({
    queryKey: queryKeys.marketplaceProfileAdmin.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('marketplace_profiles')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const form = useForm<ListingFormData>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      product_name: '',
      product_type: '',
      strain_type: '',
      description: '',
      base_price: 0,
      bulk_pricing: [],
      min_order_quantity: 1,
      max_order_quantity: undefined,
      quantity_available: 0,
      unit_type: 'lb',
      images: [],
      visibility: 'public',
      tags: [],
      lab_results: undefined,
      has_lab_results: false,
    },
  });

  const { fields: bulkPricingFields, append: appendBulkPricing, remove: removeBulkPricing } = useFieldArray({
    control: form.control,
    name: 'bulk_pricing',
  });

  // Load existing listing data or pre-fill from product data
  useEffect(() => {
    if (existingListing) {
      form.reset({
        product_name: existingListing.product_name ?? '',
        product_type: existingListing.product_type ?? '',
        strain_type: existingListing.strain_type ?? '',
        description: existingListing.description ?? '',
        base_price: Number(existingListing.base_price) || 0,
        bulk_pricing: (existingListing.bulk_pricing as Array<{ quantity: number; price: number }>) ?? [],
        min_order_quantity: existingListing.min_order_quantity || 1,
        max_order_quantity: existingListing.max_order_quantity ?? undefined,
        quantity_available: Number(existingListing.quantity_available) || 0,
        unit_type: existingListing.unit_type || 'lb',
        images: existingListing.images ?? [],
        visibility: existingListing.visibility || 'public',
        tags: existingListing.tags ?? [],
        lab_results: undefined, // Will be decrypted if needed
        has_lab_results: !!existingListing.lab_results,
      });
    } else if (productData && !listingId) {
      // Pre-fill form with product data from product list
      const productTypeMap: Record<string, string> = {
        'flower': 'flower',
        'concentrate': 'concentrate',
        'edible': 'edible',
        'vape': 'vape',
        'topical': 'topical',
        'tincture': 'tincture',
      };

      form.reset({
        product_name: String(productData.name ?? ''),
        product_type: String(productTypeMap[String(productData.category ?? '').toLowerCase()] ?? productData.category ?? ''),
        strain_type: String(productData.strain_type ?? ''),
        description: String(productData.description ?? ''),
        base_price: Number(productData.wholesale_price) || 0,
        bulk_pricing: [],
        min_order_quantity: 1,
        max_order_quantity: undefined,
        quantity_available: Number(productData.available_quantity) || 0,
        unit_type: 'lb',
        images: productData.image_url ? [String(productData.image_url)] : [],
        visibility: 'public',
        tags: (productData.tags as string[]) ?? [],
        lab_results: productData.thc_percent || productData.cbd_percent ? {
          thc_percent: productData.thc_percent ? Number(productData.thc_percent) : undefined,
          cbd_percent: productData.cbd_percent ? Number(productData.cbd_percent) : undefined,
          batch_number: String(productData.batch_number || ''),
        } : undefined,
        has_lab_results: !!(productData.thc_percent || productData.cbd_percent),
      });

      toast.success('Product data loaded', {
        description: 'Form pre-filled with product information. Review and adjust as needed.',
      });
    }
  }, [existingListing, productData, listingId, form]);

  // Upload image to Supabase Storage
  const uploadImage = async (file: File): Promise<string> => {
    if (!tenant?.id) {
      throw new Error('Tenant ID required');
    }

    setUploading('image');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `listing-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${tenant.id}/marketplace/listings/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('Image upload failed', error, { component: 'ListingForm' });
      throw error;
    } finally {
      setUploading(null);
    }
  };

  // Upload lab certificate PDF
  const uploadLabCertificate = async (file: File): Promise<string> => {
    if (!tenant?.id) {
      throw new Error('Tenant ID required');
    }

    setUploadingLabResults(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `lab-cert-${Date.now()}.${fileExt}`;
      const filePath = `${tenant.id}/marketplace/lab-certificates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('Lab certificate upload failed', error, { component: 'ListingForm' });
      throw error;
    } finally {
      setUploadingLabResults(false);
    }
  };

  // Create/update listing mutation
  const saveListingMutation = useMutation({
    mutationFn: async (data: ListingFormData) => {
      if (!tenant?.id || !profile?.id) {
        throw new Error('Tenant ID and profile ID required');
      }

      // Encrypt lab results if provided
      let encryptedLabResults: string | null = null;
      if (data.has_lab_results && data.lab_results) {
        try {
          encryptedLabResults = await encryptLabResults(data.lab_results);
        } catch (error) {
          logger.error('Failed to encrypt lab results', error, { component: 'ListingForm' });
          throw new Error('Failed to encrypt lab results');
        }
      }

      // Generate slug from product name
      const slug = data.product_name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + `-${Date.now()}`;

      const listingData: Record<string, unknown> = {
        tenant_id: tenant.id,
        marketplace_profile_id: profile.id,
        product_name: data.product_name,
        product_type: data.product_type,
        strain_type: data.strain_type || null,
        description: data.description,
        base_price: data.base_price,
        bulk_pricing: data.bulk_pricing ?? [],
        min_order_quantity: data.min_order_quantity,
        max_order_quantity: data.max_order_quantity || null,
        quantity_available: data.quantity_available,
        unit_type: data.unit_type,
        images: data.images,
        visibility: data.visibility,
        tags: data.tags ?? [],
        lab_results: encryptedLabResults ? { encrypted: encryptedLabResults } : null,
        lab_results_encrypted: encryptedLabResults ? 'true' : 'false',
        // Auto-approve new listings when feature flag is active; preserve existing status on edits
        status: existingListing ? existingListing.status : (shouldAutoApprove('LISTINGS') ? 'approved' : 'draft'),
        slug: existingListing?.slug || slug,
      };

      if (existingListing) {
        // Update existing listing
        const { error } = await supabase
          .from('marketplace_listings')
          .update(listingData)
          .eq('id', existingListing.id);

        if (error) throw error;
      } else {
        // Create new listing
        const { error } = await supabase
          .from('marketplace_listings')
          .insert([listingData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existingListing ? 'Listing Saved' : (shouldAutoApprove('LISTINGS') ? 'Listing Auto\u2011Approved' : 'Listing Saved'), {
        description: existingListing
          ? 'Listing updated successfully'
          : (shouldAutoApprove('LISTINGS') ? 'Your listing is live and visible immediately.' : 'Listing created successfully'),
      });
      onSuccess?.();
      if (!existingListing) {
        navigate(`/${slug}/admin/marketplace/listings`);
      }
    },
    onError: (error: unknown) => {
      logger.error('Failed to save listing', error, { component: 'ListingForm' });
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to save listing',
      });
    },
  });

  const onSubmit = async (data: ListingFormData) => {
    // Validate images
    if (data.images.length === 0) {
      toast.error('Validation Error', {
        description: 'Please upload at least one product image',
      });
      return;
    }

    // Validate lab results if has_lab_results is true
    if (data.has_lab_results && !data.lab_results) {
      toast.error('Validation Error', {
        description: 'Please provide lab results or uncheck the lab results option',
      });
      return;
    }

    await saveListingMutation.mutateAsync(data);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const currentImages = form.getValues('images') ?? [];
    if (currentImages.length + files.length > 6) {
      toast.error('Too Many Images', {
        description: 'Maximum 6 images allowed',
      });
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error('Invalid File', {
          description: 'Only image files are allowed',
        });
        continue;
      }

      try {
        const url = await uploadImage(file);
        const current = form.getValues('images') ?? [];
        form.setValue('images', [...current, url]);
      } catch (error) {
        toast.error('Upload Failed', {
          description: error instanceof Error ? error.message : 'Failed to upload image',
        });
      }
    }
  };

  const removeImage = (index: number) => {
    const current = form.getValues('images') ?? [];
    form.setValue('images', current.filter((_, i) => i !== index));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Product Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Blue Dream - Premium Indoor" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Product Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRODUCT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strain_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strain Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strain" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STRAIN_TYPES.map((strain) => (
                          <SelectItem key={strain.value} value={strain.value}>
                            {strain.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe your product, its quality, effects, and what makes it special..."
                      rows={6}
                    />
                  </FormControl>
                  <FormDescription>
                    Markdown is supported. This will be visible to buyers.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
            <p className="text-sm text-muted-foreground">Upload up to 6 images (max 5MB each)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {form.watch('images')?.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Product ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                    loading="lazy"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(!form.watch('images') || form.watch('images')!.length < 6) && (
                <label className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors min-h-[128px]">
                  {uploading === 'image' ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-center">Add Image</span>
                    </>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading === 'image'}
                    className="hidden"
                    multiple
                  />
                </label>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing & Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Base Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="quantity_available"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Quantity Available</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNIT_TYPES.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_order_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Order Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="max_order_quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Order Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Bulk Pricing */}
            <div>
              <Label className="mb-2 block">Bulk Pricing Tiers</Label>
              <FormDescription className="mb-2">
                Set lower prices for larger quantities
              </FormDescription>
              {bulkPricingFields.map((field, index) => (
                <div key={field.id} className="flex gap-2 mb-2">
                  <FormField
                    control={form.control}
                    name={`bulk_pricing.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Quantity"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`bulk_pricing.${index}.price`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Price"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeBulkPricing(index)}
                    aria-label="Remove pricing tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendBulkPricing({ quantity: 1, price: 0 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Bulk Tier
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lab Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Lab Results (Encrypted)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Lab results are automatically encrypted with AES-256 for security
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="has_lab_results"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Include Lab Results</FormLabel>
                    <FormDescription>
                      Add lab test results (THC/CBD percentages, terpenes, etc.)
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {form.watch('has_lab_results') && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="lab_results.thc_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>THC %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lab_results.cbd_percent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CBD %</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="0.00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="lab_results.batch_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="BATCH-2024-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lab_results.lab_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lab Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Certified Testing Lab" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lab_results.test_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Test Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lab_results.lab_certificate_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lab Certificate (PDF)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Input
                            type="file"
                            accept=".pdf"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const url = await uploadLabCertificate(file);
                                  field.onChange(url);
                                  toast.success('Certificate Uploaded', {
                                    description: 'Lab certificate uploaded successfully',
                                  });
                                } catch (error) {
                                  toast.error('Upload Failed', {
                                    description: error instanceof Error ? error.message : 'Failed to upload certificate',
                                  });
                                }
                              }
                            }}
                            disabled={uploadingLabResults}
                            className="hidden"
                            id="lab-cert-upload"
                          />
                          <Label
                            htmlFor="lab-cert-upload"
                            className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                          >
                            {uploadingLabResults ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                            <span className="text-sm">
                              {field.value ? 'Change Certificate' : 'Upload Lab Certificate (PDF)'}
                            </span>
                          </Label>
                          {field.value && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              <span>Certificate uploaded</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => field.onChange('')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Visibility & Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Visibility & Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Visibility</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/${slug}/admin/marketplace/listings`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saveListingMutation.isPending || uploading !== null || uploadingLabResults}
          >
            {saveListingMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              existingListing ? 'Update Listing' : 'Create Listing'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

