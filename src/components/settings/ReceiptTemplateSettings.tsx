import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Printer, Loader2, Save, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';

const receiptTemplateSchema = z.object({
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  header_text: z.string().max(200).optional().or(z.literal('')),
  footer_text: z.string().max(200).optional().or(z.literal('')),
  show_tax_id: z.boolean(),
  show_business_address: z.boolean(),
});

type ReceiptTemplateFormValues = z.infer<typeof receiptTemplateSchema>;

export function ReceiptTemplateSettings() {
  const { tenant } = useTenantAdminAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<ReceiptTemplateFormValues>({
    resolver: zodResolver(receiptTemplateSchema),
    defaultValues: {
      logo_url: '',
      header_text: 'Thank you for your purchase!',
      footer_text: 'Please come again',
      show_tax_id: true,
      show_business_address: true,
    },
  });

  useEffect(() => {
    const loadTemplate = async () => {
      if (!tenant?.id) return;

      const { data } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      if (data?.metadata) {
        const template = (data.metadata as Record<string, unknown>)
          .receipt_template as ReceiptTemplateFormValues | undefined;
        if (template) {
          form.reset(template);
        }
      }
    };

    loadTemplate();
  }, [tenant, form]);

  const onSubmit = async (data: ReceiptTemplateFormValues) => {
    if (!tenant?.id) {
      toast.error('Tenant not found');
      return;
    }

    setLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();

      const currentMetadata = (tenantData?.metadata as Record<string, unknown>) || {};

      const { error } = await supabase
        .from('tenants')
        .update({
          metadata: {
            ...currentMetadata,
            receipt_template: data,
          },
        })
        .eq('id', tenant.id);

      if (error) throw error;

      toast.success('Receipt template saved successfully');
      logger.info('Receipt template updated', { tenantId: tenant.id });
    } catch (error) {
      logger.error('Error saving receipt template:', error);
      toast.error('Failed to save receipt template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Printer className="h-5 w-5" />
        Receipt Template Customization
      </h3>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="logo_url">Logo URL</Label>
          <Input
            id="logo_url"
            {...form.register('logo_url')}
            placeholder="https://example.com/logo.png"
          />
          <p className="text-xs text-muted-foreground mt-1">Logo will be displayed at the top of receipts</p>
        </div>

        <div>
          <Label htmlFor="header_text">Header Text</Label>
          <Input
            id="header_text"
            {...form.register('header_text')}
            maxLength={200}
            placeholder="Thank you for your purchase!"
          />
        </div>

        <div>
          <Label htmlFor="footer_text">Footer Text</Label>
          <Textarea
            id="footer_text"
            {...form.register('footer_text')}
            maxLength={200}
            rows={3}
            placeholder="Please come again"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Show Tax ID</Label>
            <p className="text-sm text-muted-foreground">Display tax ID number on receipt</p>
          </div>
          <input
            type="checkbox"
            {...form.register('show_tax_id')}
            className="h-4 w-4"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Show Business Address</Label>
            <p className="text-sm text-muted-foreground">Display business address on receipt</p>
          </div>
          <input
            type="checkbox"
            {...form.register('show_business_address')}
            className="h-4 w-4"
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
          <Button type="button" variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </form>
    </Card>
  );
}
