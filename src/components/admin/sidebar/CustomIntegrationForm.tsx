/**
 * Custom Integration Form
 * 
 * Allows users to add custom webhooks and API integrations
 */

import { useState, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { sanitizeFormInput, sanitizeUrlInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { SafeModal, useFormDirtyState } from '@/components/ui/safe-modal';
import { DialogFooterActions } from '@/components/ui/dialog-footer-actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const INITIAL_FORM = {
    name: '',
    type: 'webhook',
    endpoint_url: '',
    description: '',
    auth_type: 'none',
    auth_config: {} as Record<string, string>,
  };
  
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  
  const isDirty = useFormDirtyState(INITIAL_FORM, formData);

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const handleRemoveHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Sanitize form inputs before processing
    const sanitizedName = sanitizeFormInput(formData.name, 100);
    const sanitizedUrl = sanitizeUrlInput(formData.endpoint_url);
    const sanitizedDescription = sanitizeTextareaInput(formData.description, 500);

    if (!sanitizedUrl) {
      toast.error('Invalid endpoint URL');
      setIsSubmitting(false);
      return;
    }

    try {
      // Mock implementation until custom_integrations table is created
      // For now, just show success message
      toast.success('Custom integration feature coming soon!', {
        description: 'This feature will be available in a future update',
      });

      onOpenChange(false);

      // Reset form
      setFormData({
        name: '',
        type: 'webhook',
        endpoint_url: '',
        description: '',
        auth_type: 'none',
        auth_config: {},
      });
      setCustomHeaders([{ key: '', value: '' }]);
    } catch (error) {
      logger.error('Failed to add custom integration:', error instanceof Error ? error : new Error(String(error)), { component: 'CustomIntegrationForm' });
      toast.error('Failed to add custom integration');
    } finally {
      setIsSubmitting(false);
    }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name</Label>
            <Input
              id="name"
              placeholder="My Custom API"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="api">REST API</SelectItem>
                <SelectItem value="graphql">GraphQL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endpoint_url">Endpoint URL</Label>
            <Input
              id="endpoint_url"
              type="url"
              placeholder="https://api.example.com/webhook"
              value={formData.endpoint_url}
              onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What does this integration do?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth_type">Authentication</Label>
            <Select
              value={formData.auth_type}
              onValueChange={(value) => setFormData({ ...formData, auth_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="api_key">API Key</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.auth_type !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="auth_value">Authentication Value</Label>
              <Input
                id="auth_value"
                type="password"
                placeholder="Enter your token/key"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    auth_config: { value: e.target.value },
                  })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Custom Headers (Optional)</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddHeader}>
                <Plus className="h-4 w-4 mr-1" />
                Add Header
              </Button>
            </div>

            {customHeaders.map((header, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Header name"
                  value={header.key}
                  onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                />
                <Input
                  placeholder="Header value"
                  value={header.value}
                  onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                />
                {customHeaders.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveHeader(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <DialogFooterActions
            primaryLabel={isSubmitting ? "Adding..." : "Add Integration"}
            onPrimary={() => {}}
            primaryLoading={isSubmitting}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
          />
        </form>
    </SafeModal>
  );
}
