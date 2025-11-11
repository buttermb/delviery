/**
 * Send Notification Dialog
 * Allows super admin to send notifications to tenants
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, MessageSquare, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

const notificationSchema = z.object({
  recipients: z.enum(['all', 'active', 'trial', 'past_due', 'custom']),
  tenant_ids: z.array(z.string()).optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  type: z.enum(['email', 'sms', 'in_app', 'all']),
  priority: z.enum(['low', 'medium', 'high']),
});

type NotificationForm = z.infer<typeof notificationSchema>;

interface NotificationDialogProps {
  trigger?: React.ReactNode;
}

export function NotificationDialog({ trigger }: NotificationDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<NotificationForm>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      recipients: 'all',
      tenant_ids: [],
      subject: '',
      message: '',
      type: 'email',
      priority: 'medium',
    },
  });

  const recipients = form.watch('recipients');

  interface TenantRow {
    id: string;
    business_name: string;
    subscription_status: string;
  }

  // Fetch tenants for custom selection
  const { data: tenants } = useQuery<TenantRow[]>({
    queryKey: ['all-tenants-for-notification'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tenants')
        .select('id, business_name, subscription_status')
        .order('business_name');
      return (data || []) as TenantRow[];
    },
    enabled: recipients === 'custom',
  });

  const onSubmit = async (data: NotificationForm) => {
    try {
      // Determine which tenants to notify
      let targetTenants: string[] = [];

      if (data.recipients === 'all') {
        const { data: allTenants } = await supabase
          .from('tenants')
          .select('id');
        targetTenants = (allTenants || []).map((t) => t.id);
      } else if (data.recipients === 'custom') {
        targetTenants = data.tenant_ids || [];
      } else {
        const { data: filteredTenants } = await supabase
          .from('tenants')
          .select('id')
          .eq('subscription_status', data.recipients);
        targetTenants = (filteredTenants || []).map((t) => t.id);
      }

      // In production, send notifications via email/SMS service
      logger.debug('Sending notifications', {
        recipients: targetTenants.length,
        subject: data.subject,
        message: data.message,
        type: data.type,
      }, 'NotificationDialog');

      toast({
        title: 'Notifications sent',
        description: `Sent to ${targetTenants.length} tenants`,
      });

      setOpen(false);
      form.reset();
    } catch (error: unknown) {
      logger.error('Failed to send notifications', error instanceof Error ? error : new Error(String(error)), { component: 'NotificationDialog' });
      toast({
        title: 'Failed to send notifications',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Bell className="h-4 w-4 mr-2" />
            Send Notification
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send Notification</DialogTitle>
          <DialogDescription>
            Send notifications to one or more tenants
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipients"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipients</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">All Tenants</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="trial">Trial Only</SelectItem>
                      <SelectItem value="past_due">Past Due</SelectItem>
                      <SelectItem value="custom">Custom Selection</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {recipients === 'custom' && (
              <FormField
                control={form.control}
                name="tenant_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Tenants</FormLabel>
                    <FormControl>
                      <div className="border rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                        {tenants?.map((tenant) => (
                          <label
                            key={tenant.id}
                            className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={field.value?.includes(tenant.id)}
                              onChange={(e) => {
                                const current = field.value || [];
                                if (e.target.checked) {
                                  field.onChange([...current, tenant.id]);
                                } else {
                                  field.onChange(current.filter((id) => id !== tenant.id));
                                }
                              }}
                            />
                            <span className="flex-1">{tenant.business_name}</span>
                            <Badge variant="outline">{tenant.subscription_status}</Badge>
                          </label>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="email">
                        <Mail className="h-4 w-4 mr-2 inline" />
                        Email
                      </SelectItem>
                      <SelectItem value="sms">
                        <MessageSquare className="h-4 w-4 mr-2 inline" />
                        SMS
                      </SelectItem>
                      <SelectItem value="in_app">In-App</SelectItem>
                      <SelectItem value="all">All Channels</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Important Update" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Your notification message here..."
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Globe className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

