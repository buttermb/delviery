import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Bell, Plus, Edit, Loader2, Trash2 } from 'lucide-react';
import { handleError } from "@/utils/errorHandling/handlers";
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { queryKeys } from '@/lib/queryKeys';

interface NotificationTemplate {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  trigger_event: string;
  enabled: boolean;
  created_at: string;
}

export default function Notifications() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<NotificationTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'email',
    subject: '',
    body: '',
    trigger_event: '',
    enabled: true,
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.notificationTemplates.byTenant(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('notification_templates')
          .select('id, name, type, subject, body, trigger_event, enabled, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: Partial<NotificationTemplate>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('notification_templates')
        .insert({
          tenant_id: tenantId,
          name: template.name,
          type: template.type,
          subject: template.subject || null,
          body: template.body,
          trigger_event: template.trigger_event,
          enabled: template.enabled ?? true,
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Notification templates table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationTemplates.byTenant(tenantId) });
      toast.success('Notification template has been created.');
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'Notifications.createTemplate',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, ...template }: NotificationTemplate) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('notification_templates')
        .update({
          name: template.name,
          type: template.type,
          subject: template.subject || null,
          body: template.body,
          trigger_event: template.trigger_event,
          enabled: template.enabled,
        })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Notification templates table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationTemplates.byTenant(tenantId) });
      toast.success('Notification template has been updated.');
      resetForm();
    },
    onError: (error) => {
      handleError(error, {
        component: 'Notifications.updateTemplate',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenantId);
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Notification templates table does not exist.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationTemplates.byTenant(tenantId) });
      toast.success('Notification template has been removed.');
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error) => {
      handleError(error, {
        component: 'Notifications.deleteTemplate',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'email',
      subject: '',
      body: '',
      trigger_event: '',
      enabled: true,
    });
    setEditingTemplate(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject ?? '',
      body: template.body,
      trigger_event: template.trigger_event,
      enabled: template.enabled,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        ...editingTemplate,
        ...formData,
      });
    } else {
      createTemplateMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="card" message="Loading templates..." />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notification Templates</h1>
          <p className="text-muted-foreground">Manage notification templates and triggers</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template: NotificationTemplate) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    <CardTitle>{template.name}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => {
                      setTemplateToDelete(template);
                      setDeleteDialogOpen(true);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>{template.trigger_event}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <Badge>{template.type}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={template.enabled ? 'default' : 'secondary'}>
                      {template.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              No notification templates found. Create your first template to get started.
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              Configure notification template settings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger_event">Trigger Event</Label>
                <Input
                  id="trigger_event"
                  value={formData.trigger_event}
                  onChange={(e) => setFormData({ ...formData, trigger_event: e.target.value })}
                  placeholder="e.g., order.created"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject (for email)</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea
                  id="body"
                  className="min-h-[100px]"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              >
                {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingTemplate ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (templateToDelete) {
            await deleteTemplateMutation.mutateAsync(templateToDelete.id);
          }
        }}
        itemType="template"
        itemName={templateToDelete?.name}
        isLoading={deleteTemplateMutation.isPending}
      />
    </div>
  );
}

