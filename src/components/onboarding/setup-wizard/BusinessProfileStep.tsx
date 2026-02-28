/**
 * Setup Wizard Step 1: Business Profile
 * Configure business name, slug, and upload logo
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, Upload, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';

const businessProfileSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters'),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be 50 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
});

type BusinessProfileFormData = z.infer<typeof businessProfileSchema>;

interface BusinessProfileStepProps {
  onComplete: () => void;
}

export function BusinessProfileStep({ onComplete }: BusinessProfileStepProps) {
  const { tenant } = useTenantAdminAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const form = useForm<BusinessProfileFormData>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues: {
      business_name: tenant?.business_name ?? '',
      slug: tenant?.slug ?? '',
    },
  });

  // Auto-generate slug from business name
  const watchedName = form.watch('business_name');
  useEffect(() => {
    if (watchedName && !form.getFieldState('slug').isDirty) {
      const autoSlug = watchedName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50);
      form.setValue('slug', autoSlug);
    }
  }, [watchedName, form]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be under 5MB');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !tenant?.id) return null;

    setIsUploadingLogo(true);
    try {
      const ext = logoFile.name.split('.').pop() || 'png';
      const path = `${tenant.id}/logo/logo-${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('tenant-assets')
        .upload(path, logoFile, { upsert: true });

      if (error) {
        logger.warn('Logo upload failed, continuing without logo', error, { component: 'BusinessProfileStep' });
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('tenant-assets')
        .getPublicUrl(path);

      return urlData?.publicUrl || null;
    } catch (error) {
      logger.warn('Logo upload error', error instanceof Error ? error : new Error(String(error)), { component: 'BusinessProfileStep' });
      return null;
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const onSubmit = async (data: BusinessProfileFormData) => {
    if (!tenant?.id) return;
    setIsSubmitting(true);

    try {
      let logoUrl: string | null = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      const updatePayload: Record<string, unknown> = {
        business_name: data.business_name,
        slug: data.slug,
      };

      if (logoUrl) {
        updatePayload.logo_url = logoUrl;
      }

      const { error } = await supabase
        .from('tenants')
        .update(updatePayload)
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Business profile saved!');
      onComplete();
    } catch (error) {
      logger.error('Failed to save business profile', error instanceof Error ? error : new Error(String(error)), { component: 'BusinessProfileStep' });
      toast.error('Failed to save. Please try again.', { description: humanizeError(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
          <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Business Profile</h3>
          <p className="text-sm text-muted-foreground">Tell us about your business</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="business_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Business Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Cannabis Co." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Store URL Slug</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">floraiq.co/</span>
                    <Input placeholder="my-cannabis-co" {...field} />
                  </div>
                </FormControl>
                <FormDescription>This is your unique store URL</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Logo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Business Logo</label>
            {logoPreview ? (
              <div className="relative inline-block">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-24 h-24 object-cover rounded-lg border"
                  loading="lazy"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeLogo}
                  aria-label="Remove logo"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload logo</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 5MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </label>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isUploadingLogo}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
