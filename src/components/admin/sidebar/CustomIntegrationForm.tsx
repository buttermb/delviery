/**
 * Custom Integration Form
 *
 * Allows users to add custom webhooks and API integrations.
 * Persists to the custom_integrations table via Supabase.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { sanitizeUrlInput } from '@/lib/utils/sanitize';
import { SafeModal, useFormDirtyState } from '@/components/ui/safe-modal';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';
import { humanizeError } from '@/lib/humanizeError';
import { logger } from '@/lib/logger';

const integrationSchema = z.object({
  name: z.string().min(1, 'Integration name is required').max(200),
  type: z.enum(['webhook', 'api', 'graphql']),
  endpoint_url: z.string().min(1, 'Endpoint URL is required').url('Invalid URL format'),
  description: z.string().max(500).optional().or(z.literal('')),
  auth_type: z.enum(['none', 'api_key', 'bearer', 'basic']),
  auth_value: z.string().optional().or(z.literal('')),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;

interface CustomIntegrationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIntegrationAdded: () => void;
}

export function CustomIntegrationForm({
  open,
  onOpenChange,
  onIntegrationAdded,
}: CustomIntegrationFormProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: '',
      type: 'webhook',
      endpoint_url: '',
      description: '',
      auth_type: 'none',
      auth_value: '',
    },
  });

  const watchAuthType = form.watch('auth_type');
  const formValues = form.watch();
  const isDirty = useFormDirtyState(
    { name: '', type: 'webhook', endpoint_url: '', description: '', auth_type: 'none', auth_value: '' },
    formValues
  );

  const createMutation = useMutation({
    mutationFn: async (values: IntegrationFormValues & { headers: Record<string, string> }) => {
      if (!tenantId) throw new Error('Tenant context required');

      const config: Record<string, unknown> = {
        endpoint_url: values.endpoint_url,
        auth_type: values.auth_type,
        description: values.description || '',
        headers: values.headers,
      };

      if (values.auth_type !== 'none' && values.auth_value) {
        config.auth_value = values.auth_value;
      }

      const { data, error } = await supabase
        .from('custom_integrations')
        .insert({
          tenant_id: tenantId,
          name: values.name,
          type: values.type,
          config,
          status: 'active',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customIntegrations.byTenant(tenantId) });
      toast.success('Custom integration added');
      onIntegrationAdded();
      onOpenChange(false);
      form.reset();
      setCustomHeaders([{ key: '', value: '' }]);
    },
    onError: (error: unknown) => {
      logger.error('Failed to add custom integration:', error instanceof Error ? error : new Error(String(error)), { component: 'CustomIntegrationForm' });
      toast.error('Failed to add custom integration', { description: humanizeError(error) });
    },
  });

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index] = { ...updated[index], [field]: value };
    setCustomHeaders(updated);
  };

  const onSubmit = (values: IntegrationFormValues) => {
    const sanitizedUrl = sanitizeUrlInput(values.endpoint_url);
    if (!sanitizedUrl) {
      toast.error('Invalid endpoint URL');
      return;
    }

    // Collect non-empty headers into a record
    const headers: Record<string, string> = {};
    for (const header of customHeaders) {
      const key = header.key.trim();
      const value = header.value.trim();
      if (key && value) {
        headers[key] = value;
      }
    }

    createMutation.mutate({
      ...values,
      endpoint_url: sanitizedUrl,
      headers,
    });
  };

  return (
    <SafeModal
      open={open}
      onOpenChange={onOpenChange}
      isDirty={isDirty}
      title="Add Custom Integration"
      description="Connect your own APIs, webhooks, or custom endpoints"
      className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Integration Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="My Custom API" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="api">REST API</SelectItem>
                    <SelectItem value="graphql">GraphQL</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endpoint_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Endpoint URL</FormLabel>
                <FormControl>
                  <Input {...field} type="url" placeholder="https://api.example.com/webhook" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="What does this integration do?"
                    rows={2}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="auth_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Authentication</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select auth type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                    <SelectItem value="basic">Basic Auth</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchAuthType !== 'none' && (
            <FormField
              control={form.control}
              name="auth_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authentication Value</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="Enter your token/key"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FormLabel>Custom Headers (Optional)</FormLabel>
              <Button type="button" variant="outline" size="sm" onClick={handleAddHeader}>
                <Plus className="h-4 w-4 mr-1" />
                Add Header
              </Button>
            </div>

            {customHeaders.map((header, index) => (
              <div key={`header-${index}`} className="flex gap-2">
                <Input
                  placeholder="Header name"
                  aria-label="Custom header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                />
                <Input
                  placeholder="Header value"
                  aria-label="Custom header value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                />
                {customHeaders.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveHeader(index)}
                    aria-label="Remove header"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooterActions
            primaryLabel={createMutation.isPending ? "Adding..." : "Add Integration"}
            onPrimary={() => {}}
            primaryLoading={createMutation.isPending}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
          />
        </form>
      </Form>
    </SafeModal>
  );
}
