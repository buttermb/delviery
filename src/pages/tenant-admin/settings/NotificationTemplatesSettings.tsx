import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import {
  SettingsSection,
  SettingsCard,
  SaveStatusIndicator,
} from '@/components/settings/SettingsSection';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NotificationTemplate {
  id: string;
  event_type: string;
  subject: string;
  body: string;
  variables: string[];
}

const TEMPLATE_TYPES = [
  { id: 'order_created', label: 'Order Created', variables: ['{customer_name}', '{order_id}', '{total}'] },
  { id: 'order_delivered', label: 'Order Delivered', variables: ['{customer_name}', '{order_id}'] },
  { id: 'payment_received', label: 'Payment Received', variables: ['{customer_name}', '{amount}'] },
  { id: 'low_stock', label: 'Low Stock Alert', variables: ['{product_name}', '{stock_quantity}'] },
  { id: 'delivery_delayed', label: 'Delivery Delayed', variables: ['{order_id}', '{new_eta}'] },
];

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  order_created: {
    subject: 'Order Confirmation #{order_id}',
    body: 'Hi {customer_name},\n\nThank you for your order! Your order #{order_id} for {total} has been received and is being processed.\n\nWe\'ll notify you when it\'s ready.',
  },
  order_delivered: {
    subject: 'Order #{order_id} Delivered',
    body: 'Hi {customer_name},\n\nYour order #{order_id} has been delivered. We hope you enjoy your purchase!',
  },
  payment_received: {
    subject: 'Payment Received',
    body: 'Hi {customer_name},\n\nWe\'ve received your payment of {amount}. Thank you!',
  },
  low_stock: {
    subject: 'Low Stock Alert: {product_name}',
    body: '{product_name} is running low. Only {stock_quantity} units remaining.',
  },
  delivery_delayed: {
    subject: 'Delivery Update for Order #{order_id}',
    body: 'Your delivery has been delayed. New estimated arrival: {new_eta}.',
  },
};

export default function NotificationTemplatesSettings() {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState(TEMPLATE_TYPES[0].id);
  const [templates, setTemplates] = useState<Record<string, NotificationTemplate>>({});

  const { isLoading } = useQuery({
    queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'notification_templates'),
    queryFn: async () => {
      if (!tenant?.id) return null;

      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('tenant_id', tenant.id);

      if (error) throw error;

      const templatesMap: Record<string, NotificationTemplate> = {};
      (data || []).forEach((t: Record<string, unknown>) => {
        templatesMap[t.event_type as string] = {
          id: t.id as string,
          event_type: t.event_type as string,
          subject: t.subject as string,
          body: t.body as string,
          variables: (t.variables as string[]) || [],
        };
      });

      setTemplates(templatesMap);
      return data;
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ eventType, subject, body }: { eventType: string; subject: string; body: string }) => {
      if (!tenant?.id) throw new Error('No tenant');

      const existingTemplate = templates[eventType];
      const templateType = TEMPLATE_TYPES.find(t => t.id === eventType);

      if (existingTemplate) {
        // Update
        const { error } = await supabase
          .from('notification_templates')
          .update({ subject, body })
          .eq('id', existingTemplate.id)
          .eq('tenant_id', tenant.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('notification_templates')
          .insert({
            tenant_id: tenant.id,
            event_type: eventType,
            subject,
            body,
            variables: templateType?.variables || [],
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings.byTenant(tenant?.id, 'notification_templates') });
      toast.success('Template saved');
    },
    onError: (error) => {
      logger.error('Failed to save notification template', { error });
      toast.error(humanizeError(error));
    },
  });

  const selectedTemplate = templates[selectedType] || {
    id: '',
    event_type: selectedType,
    subject: DEFAULT_TEMPLATES[selectedType]?.subject || '',
    body: DEFAULT_TEMPLATES[selectedType]?.body || '',
    variables: TEMPLATE_TYPES.find(t => t.id === selectedType)?.variables || [],
  };

  const [subject, setSubject] = useState(selectedTemplate.subject);
  const [body, setBody] = useState(selectedTemplate.body);

  const handleTemplateChange = (type: string) => {
    setSelectedType(type);
    const template = templates[type] || {
      id: '',
      event_type: type,
      subject: DEFAULT_TEMPLATES[type]?.subject || '',
      body: DEFAULT_TEMPLATES[type]?.body || '',
      variables: TEMPLATE_TYPES.find(t => t.id === type)?.variables || [],
    };
    setSubject(template.subject);
    setBody(template.body);
  };

  const handleSave = () => {
    saveMutation.mutate({ eventType: selectedType, subject, body });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notification Templates</h2>
        <p className="text-muted-foreground mt-1">
          Customize notification text templates with dynamic variables
        </p>
      </div>

      <SettingsSection
        title="Templates"
        description="Edit notification messages for different events"
        icon={Mail}
      >
        <SettingsCard>
          <div className="space-y-4">
            <div>
              <Label>Event Type</Label>
              <Select value={selectedType} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Available Variables</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedTemplate.variables.map((variable) => (
                  <Badge key={variable} variant="secondary">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Subject</Label>
              <Textarea
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                rows={2}
                placeholder="Email subject line"
              />
            </div>

            <div>
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Notification message body"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variables like {'{customer_name}'} which will be replaced with actual values
              </p>
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </SettingsCard>
      </SettingsSection>

      <SaveStatusIndicator
        status={saveMutation.isPending ? 'saving' : 'saved'}
      />
    </div>
  );
}
