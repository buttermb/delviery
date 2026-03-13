import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { Card } from '@/components/ui/card';

interface ReceiptTemplate {
  logo_url: string;
  header_text: string;
  footer_text: string;
  show_tax_id: boolean;
  tax_id: string;
  show_qr_code: boolean;
}

const DEFAULT_TEMPLATE: ReceiptTemplate = {
  logo_url: '',
  header_text: 'Thank you for your purchase!',
  footer_text: 'Visit again soon!',
  show_tax_id: true,
  tax_id: '',
  show_qr_code: false,
};

export default function ReceiptTemplateSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState<ReceiptTemplate>(DEFAULT_TEMPLATE);
  const [showPreview, setShowPreview] = useState(false);

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'receipt_template'),
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
        const receiptTemplate = metadata.receipt_template as ReceiptTemplate | undefined;
        if (receiptTemplate) {
          setTemplate(receiptTemplate);
        }
      }

      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (newTemplate: ReceiptTemplate) => {
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
            receipt_template: newTemplate,
          } as Record<string, unknown>,
        })
        .eq('id', tenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'receipt_template') });
      toast.success('Receipt template saved');
    },
    onError: (error) => {
      logger.error('Failed to save receipt template', { error });
      toast.error(humanizeError(error));
    },
  });

  const handleChange = (field: keyof ReceiptTemplate, value: unknown) => {
    const newTemplate = { ...template, [field]: value };
    setTemplate(newTemplate);
  };

  const handleSave = () => {
    saveMutation.mutate(template);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Receipt Template</h2>
        <p className="text-muted-foreground mt-1">
          Customize your POS receipt appearance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <SettingsSection
            title="Template Configuration"
            description="Customize receipt content"
            icon={FileText}
          >
            <SettingsCard>
              <div className="space-y-4">
                <div>
                  <Label>Logo URL</Label>
                  <Input
                    value={template.logo_url}
                    onChange={(e) => handleChange('logo_url', e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL to your logo image (max 200px width)
                  </p>
                </div>

                <div>
                  <Label>Header Text</Label>
                  <Textarea
                    value={template.header_text}
                    onChange={(e) => handleChange('header_text', e.target.value)}
                    placeholder="Thank you for your purchase!"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Footer Text</Label>
                  <Textarea
                    value={template.footer_text}
                    onChange={(e) => handleChange('footer_text', e.target.value)}
                    placeholder="Visit again soon!"
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Tax ID / Business Number</Label>
                  <Input
                    value={template.tax_id}
                    onChange={(e) => handleChange('tax_id', e.target.value)}
                    placeholder="123-456-7890"
                  />
                </div>
              </div>
            </SettingsCard>
          </SettingsSection>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>

          <SaveStatusIndicator
            status={saveMutation.isPending ? 'saving' : 'saved'}
          />
        </div>

        {showPreview && (
          <div>
            <Label className="mb-2 block">Preview</Label>
            <Card className="p-6 bg-white text-black font-mono text-sm max-w-sm">
              <div className="space-y-4">
                {template.logo_url && (
                  <div className="text-center">
                    <img
                      src={template.logo_url}
                      alt="Receipt logo"
                      className="max-w-[200px] mx-auto"
                    />
                  </div>
                )}

                {template.header_text && (
                  <div className="text-center border-b pb-2">
                    <p className="whitespace-pre-wrap">{template.header_text}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Sample Item</span>
                    <span>$10.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Another Item</span>
                    <span>$15.00</span>
                  </div>
                  <div className="border-t pt-1 mt-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>$25.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax (8.5%)</span>
                      <span>$2.13</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>$27.13</span>
                    </div>
                  </div>
                </div>

                {template.show_tax_id && template.tax_id && (
                  <div className="text-center text-xs border-t pt-2">
                    <p>Tax ID: {template.tax_id}</p>
                  </div>
                )}

                {template.footer_text && (
                  <div className="text-center border-t pt-2">
                    <p className="whitespace-pre-wrap text-xs">{template.footer_text}</p>
                  </div>
                )}

                {template.show_qr_code && (
                  <div className="text-center text-xs text-muted-foreground">
                    [QR Code would appear here]
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
