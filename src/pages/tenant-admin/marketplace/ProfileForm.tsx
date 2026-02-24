import { logger } from '@/lib/logger';
/**
 * Marketplace Profile Form Component
 * Form for creating/editing marketplace seller profile
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
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
import { X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { compressImage, isCompressibleImage, COMPRESSION_PRESETS } from '@/lib/utils/image-compression';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const LICENSE_TYPES = [
  { value: 'adult_use', label: 'Adult-Use Retail' },
  { value: 'medical', label: 'Medical Retail' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'cultivator', label: 'Cultivator' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'testing_lab', label: 'Testing Lab' },
  { value: 'other', label: 'Other' },
];

const profileSchema = z.object({
  business_name: z.string().min(2, 'Business name is required'),
  business_description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  license_number: z.string().min(1, 'License number is required'),
  license_type: z.string().min(1, 'License type is required'),
  license_state: z.string().min(1, 'License state is required'),
  license_expiry_date: z.string().optional(),
  shipping_states: z.array(z.string()).min(1, 'Select at least one shipping state'),
  logo_url: z.string().optional(),
  cover_image_url: z.string().optional(),
  license_document_url: z.string().min(1, 'License document is required'),
  shipping_policy: z.string().optional(),
  return_policy: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  onSuccess?: () => void;
  initialData?: Partial<ProfileFormData>;
}

export function ProfileForm({ onSuccess, initialData }: ProfileFormProps) {
  const { tenant } = useTenantAdminAuth();
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedShippingStates, setSelectedShippingStates] = useState<string[]>(initialData?.shipping_states ?? []);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      business_name: initialData?.business_name || tenant?.business_name || '',
      business_description: initialData?.business_description || '',
      license_number: initialData?.license_number || '',
      license_type: initialData?.license_type || '',
      license_state: initialData?.license_state || '',
      license_expiry_date: initialData?.license_expiry_date || '',
      shipping_states: initialData?.shipping_states ?? [],
      logo_url: initialData?.logo_url || '',
      cover_image_url: initialData?.cover_image_url || '',
      license_document_url: initialData?.license_document_url || '',
      shipping_policy: initialData?.shipping_policy || '',
      return_policy: initialData?.return_policy || '',
    },
  });

  // Upload file to Supabase Storage (with image compression)
  const uploadFile = async (file: File, type: 'logo' | 'cover' | 'license'): Promise<string> => {
    if (!tenant?.id) {
      throw new Error('Tenant ID required');
    }

    setUploading(type);
    try {
      let fileToUpload = file;

      // Compress images before upload (not for license documents)
      if (type !== 'license' && isCompressibleImage(file)) {
        const compressionPreset = type === 'logo' ? COMPRESSION_PRESETS.profile : COMPRESSION_PRESETS.cover;
        fileToUpload = await compressImage(file, compressionPreset);
        logger.debug('Image compressed for upload', {
          type,
          originalSize: file.size,
          compressedSize: fileToUpload.size,
          savings: `${((1 - fileToUpload.size / file.size) * 100).toFixed(1)}%`,
        });
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${tenant.id}/marketplace/${fileName}`;

      // Determine bucket based on file type
      const bucket = type === 'license' ? 'documents' : 'product-images';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('File upload failed', error, { component: 'ProfileForm', type });
      throw error;
    } finally {
      setUploading(null);
    }
  };

  // Create/update profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!tenant?.id) {
        throw new Error('Tenant ID required');
      }

      // Check if profile already exists
      const { data: existing } = await supabase
        .from('marketplace_profiles')
        .select('id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const profileData = {
        tenant_id: tenant.id,
        business_name: data.business_name,
        business_description: data.business_description || null,
        license_number: data.license_number,
        license_type: data.license_type,
        license_state: data.license_state,
        license_expiry_date: data.license_expiry_date ? new Date(data.license_expiry_date).toISOString() : null,
        license_document_url: data.license_document_url,
        shipping_states: data.shipping_states,
        logo_url: data.logo_url || null,
        cover_image_url: data.cover_image_url || null,
        shipping_policy: data.shipping_policy || null,
        return_policy: data.return_policy || null,
        marketplace_status: 'pending',
        can_sell: false,
        license_verified: false,
      };

      if (existing) {
        // Update existing profile
        const { error } = await supabase
          .from('marketplace_profiles')
          .update(profileData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create new profile
        const { error } = await supabase
          .from('marketplace_profiles')
          .insert(profileData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Profile Saved', { description: 'Your marketplace profile has been saved and is pending verification.' });
      onSuccess?.();
    },
    onError: (error: unknown) => {
      logger.error('Failed to save profile', error, { component: 'ProfileForm' });
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to save profile' });
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    // Update form with selected shipping states
    data.shipping_states = selectedShippingStates;
    
    if (data.shipping_states.length === 0) {
      toast.error('Validation Error', { description: 'Please select at least one shipping state' });
      return;
    }

    await createProfileMutation.mutateAsync(data);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover' | 'license') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (type === 'license' && file.type !== 'application/pdf') {
      toast.error('Invalid File', { description: 'License document must be a PDF file' });
      return;
    }

    if ((type === 'logo' || type === 'cover') && !file.type.startsWith('image/')) {
      toast.error('Invalid File', { description: 'Logo and cover must be image files' });
      return;
    }

    try {
      const url = await uploadFile(file, type);
      form.setValue(
        type === 'logo' ? 'logo_url' : type === 'cover' ? 'cover_image_url' : 'license_document_url',
        url
      );
      toast.success('Upload Successful', { description: 'File uploaded successfully' });
    } catch (error) {
      toast.error('Upload Failed', { description: error instanceof Error ? error.message : 'Failed to upload file' });
    }
  };

  const toggleShippingState = (state: string) => {
    setSelectedShippingStates((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : [...prev, state]
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Business Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Business Information</h3>

          <FormField
            control={form.control}
            name="business_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Business Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Your Business Name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe your business, products, and what makes you unique..."
                    rows={4}
                  />
                </FormControl>
                <FormDescription>
                  This will be visible to potential buyers on your profile
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* License Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">License Information</h3>

          <FormField
            control={form.control}
            name="license_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>License Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="C11-0001234-LIC" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="license_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>License Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select license type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LICENSE_TYPES.map((type) => (
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
              name="license_state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>License State</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {US_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
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
            name="license_expiry_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License Expiry Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* License Document Upload */}
          <FormField
            control={form.control}
            name="license_document_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License Document (PDF) *</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileSelect(e, 'license')}
                      disabled={uploading === 'license'}
                      className="hidden"
                      id="license-upload"
                    />
                    <Label
                      htmlFor="license-upload"
                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      {uploading === 'license' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                      <span className="text-sm">
                        {field.value ? 'Change License Document' : 'Upload License Document (PDF)'}
                      </span>
                    </Label>
                    {field.value && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>License document uploaded</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setValue('license_document_url', '')}
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

        {/* Images */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Images</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Logo</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e, 'logo')}
                        disabled={uploading === 'logo'}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Label
                        htmlFor="logo-upload"
                        className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]"
                      >
                        {uploading === 'logo' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : field.value ? (
                          <img src={field.value} alt="Logo" className="h-20 w-20 object-contain" loading="lazy" />
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-center">Upload Logo</span>
                          </>
                        )}
                      </Label>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setValue('logo_url', '')}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cover Image</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileSelect(e, 'cover')}
                        disabled={uploading === 'cover'}
                        className="hidden"
                        id="cover-upload"
                      />
                      <Label
                        htmlFor="cover-upload"
                        className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]"
                      >
                        {uploading === 'cover' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : field.value ? (
                          <img src={field.value} alt="Cover" className="h-20 w-20 object-contain" loading="lazy" />
                        ) : (
                          <>
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            <span className="text-sm text-center">Upload Cover Image</span>
                          </>
                        )}
                      </Label>
                      {field.value && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => form.setValue('cover_image_url', '')}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Shipping Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Shipping Information</h3>

          <div>
            <Label>Shipping States *</Label>
            <FormDescription className="mb-2">
              Select all states where you ship products
            </FormDescription>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-4 border rounded-lg max-h-48 overflow-y-auto">
              {US_STATES.map((state) => (
                <Button
                  key={state}
                  type="button"
                  variant={selectedShippingStates.includes(state) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleShippingState(state)}
                  className="h-8"
                >
                  {state}
                </Button>
              ))}
            </div>
            {selectedShippingStates.length === 0 && (
              <p className="text-sm text-destructive mt-1">Please select at least one shipping state</p>
            )}
          </div>

          <FormField
            control={form.control}
            name="shipping_policy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipping Policy</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe your shipping methods, costs, and timelines..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="return_policy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Return Policy</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe your return and refund policy..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button
            type="submit"
            disabled={createProfileMutation.isPending || uploading !== null}
          >
            {createProfileMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Profile'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

