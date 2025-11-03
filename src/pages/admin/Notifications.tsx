import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { Plus, Send, Trash2, Edit, Save, Bell, Mail, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'in_app';
  subject?: string;
  body: string;
  trigger_event: string;
  enabled: boolean;
}

interface NotificationLog {
  id: string;
  template_id: string;
  recipient: string;
  type: string;
  status: 'sent' | 'failed' | 'pending';
  created_at: string;
}

const TRIGGER_EVENTS = [
  'order_created',
  'order_completed',
  'order_cancelled',
  'payment_received',
  'low_stock',
  'delivery_dispatched',
  'delivery_completed',
  'customer_registered',
];

export default function Notifications() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'email' as 'email' | 'sms' | 'in_app',
    subject: '',
    body: '',
    trigger_event: '',
    enabled: true,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['notification-templates', tenantId],
    queryFn: async (): Promise<NotificationTemplate[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['notification-logs', tenantId],
    queryFn: async (): Promise<NotificationLog[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('notification_logs')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error && error.code === '42P01') {
          return [];
        }
        if (error) throw error;
        return data || [];
      } catch (error: any) {
        if (error.code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (template: Omit<NotificationTemplate, 'id'>) => {
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
          enabled: template.enabled,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Notification templates table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      toast({ title: 'Template created', description: 'Notification template has been created.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create template',
        variant: 'destructive',
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
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Notification templates table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      toast({ title: 'Template updated', description: 'Notification template has been updated.' });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update template',
        variant: 'destructive',
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates', tenantId] });
      toast({ title: 'Template deleted', description: 'Template has been deleted.' });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: async (templateId: string) => {
      // Send test notification
      toast({
        title: 'Test notification sent',
        description: 'A test notification has been sent (simulated).',
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
    setShowTemplateForm(false);
  };

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject || '',
      body: template.body,
      trigger_event: template.trigger_event,
      enabled: template.enabled,
    });
    setShowTemplateForm(true);
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

  const sentCount = logs?.filter((l) => l.status === 'sent').length || 0;
  const failedCount = logs?.filter((l) => l.status === 'failed').length || 0;
  const pendingCount = logs?.filter((l) => l.status === 'pending').length || 0;

  if (templatesLoading || logsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Configure notification templates and view notification history</p>
        </div>
        <Button onClick={() => setShowTemplateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Template Form */}
      {showTemplateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingTemplate ? 'Edit Template' : 'Create Notification Template'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Notification Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email
                        </div>
                      </SelectItem>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          SMS
                        </div>
                      </SelectItem>
                      <SelectItem value="in_app">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          In-App
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="trigger">Trigger Event</Label>
                <Select
                  value={formData.trigger_event}
                  onValueChange={(value) => setFormData({ ...formData, trigger_event: value })}
                  required
                >
                  <SelectTrigger id="trigger">
                    <SelectValue placeholder="Select trigger event" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_EVENTS.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.type === 'email' && (
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Order Confirmation"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="body">Message Body</Label>
                <textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full min-h-[120px] p-2 border rounded-md"
                  placeholder="Hello {{customer_name}}, your order {{order_number}} has been {{status}}."
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Use variables like {'{{customer_name}}'}, {'{{order_number}}'}, etc.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked as boolean })}
                />
                <Label htmlFor="enabled" className="cursor-pointer">
                  Enable this template
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingTemplate ? 'Update' : 'Create'} Template
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                {editingTemplate && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testNotificationMutation.mutate(editingTemplate.id)}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Notification Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Templates ({templates?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {templates && templates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Trigger Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {template.type === 'email' && <Mail className="h-3 w-3 mr-1" />}
                            {template.type === 'sms' && <MessageSquare className="h-3 w-3 mr-1" />}
                            {template.type === 'in_app' && <Bell className="h-3 w-3 mr-1" />}
                            {template.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.trigger_event.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={template.enabled ? 'default' : 'secondary'}>
                            {template.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(template)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this template?')) {
                                  deleteTemplateMutation.mutate(template.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {templates !== undefined
                    ? 'No notification templates. Create one to get started.'
                    : 'Notification templates table not found. Please run database migrations.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History ({logs?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {logs && logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.recipient}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.status === 'sent'
                                ? 'default'
                                : log.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {logs !== undefined
                    ? 'No notification logs yet.'
                    : 'Notification logs table not found.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

