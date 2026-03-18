import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { logger } from '@/lib/logger';
import { sanitizeFormInput, sanitizeTextareaInput } from '@/lib/utils/sanitize';
import { humanizeError } from '@/lib/humanizeError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Headphones, Plus, MessageCircle, Clock, CheckCircle, Trash2, Loader2, Search } from 'lucide-react';
import { isPostgrestError } from '@/utils/errorHandling/typeGuards';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { queryKeys } from '@/lib/queryKeys';

const ticketFormSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be 200 characters or less'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be 2000 characters or less'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

type TicketFormValues = z.infer<typeof ticketFormSchema>;

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

function getPriorityBadgeVariant(priority: string): 'destructive' | 'default' | 'secondary' | 'outline' {
  switch (priority) {
    case 'urgent':
      return 'destructive';
    case 'high':
      return 'destructive';
    case 'normal':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'open':
      return 'default';
    case 'in_progress':
      return 'default';
    case 'resolved':
      return 'secondary';
    case 'closed':
      return 'outline';
    default:
      return 'secondary';
  }
}

export default function PrioritySupport() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'high',
    },
  });

  const { data: tickets, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.supportTickets(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('id, subject, description, priority, status, created_at, updated_at, tenant_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data ?? []) as unknown as SupportTicket[];
      } catch (error) {
        if (isPostgrestError(error) && error.code === '42P01') return [];
        logger.error('Failed to fetch priority support tickets', error, { component: 'PrioritySupport' });
        throw error;
      }
    },
    enabled: !!tenantId,
    retry: 2,
    staleTime: 30_000,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          tenant_id: tenantId,
          account_id: tenantId,
          ticket_number: `PRI-${Date.now()}`,
          subject: sanitizeFormInput(values.subject, 200),
          description: sanitizeTextareaInput(values.description, 2000),
          priority: values.priority,
          status: 'open',
        })
        .select()
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Support tickets table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.supportTickets(tenantId) });
      toast.success('Priority support ticket created.');
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (error: unknown) => {
      logger.error('Failed to create priority support ticket', error, { component: 'PrioritySupport' });
      toast.error('Failed to create ticket', { description: humanizeError(error) });
    },
  });

  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      if (!tenantId) throw new Error('Tenant ID required');
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Support tickets table does not exist.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.superAdminTools.supportTickets(tenantId) });
      toast.success('Support ticket removed.');
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    },
    onError: (error: unknown) => {
      logger.error('Failed to delete priority support ticket', error, { component: 'PrioritySupport' });
      toast.error('Failed to delete ticket', { description: humanizeError(error) });
    },
  });

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
    }
    setIsDialogOpen(open);
  };

  const onSubmit = (values: TicketFormValues) => {
    createTicketMutation.mutate(values);
  };

  const filteredTickets = tickets?.filter((ticket) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ticket.subject.toLowerCase().includes(term) ||
      ticket.description.toLowerCase().includes(term)
    );
  }) ?? [];

  const openTickets = tickets?.filter((t) => t.status === 'open').length ?? 0;
  const resolvedTickets = tickets?.filter((t) => t.status === 'resolved').length ?? 0;

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold">Priority Support</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Enterprise-level support ticket management
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="min-h-[44px] touch-manipulation"
        >
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">New Ticket</span>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{openTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold text-green-500">{resolvedTickets}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{tickets?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>Your priority support tickets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search tickets"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[44px] touch-manipulation"
              maxLength={100}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="animate-pulse p-4 border rounded-lg">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : filteredTickets.length > 0 ? (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-start justify-between p-4 border rounded-lg transition-colors duration-200 hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium truncate">{ticket.subject}</span>
                      <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                        {ticket.priority || 'normal'}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(ticket.status)}>
                        {ticket.status?.replace('_', ' ') || 'open'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(ticket.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive ml-2 shrink-0"
                    onClick={() => {
                      setTicketToDelete(ticket.id);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label={`Delete ticket: ${ticket.subject}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EnhancedEmptyState
              icon={Headphones}
              title={searchTerm ? 'No tickets match your search' : 'No support tickets'}
              description={
                searchTerm
                  ? 'Try a different search term or clear your search.'
                  : 'Create a ticket to get priority support.'
              }
              primaryAction={
                searchTerm
                  ? { label: 'Clear Search', onClick: () => setSearchTerm('') }
                  : { label: 'New Ticket', onClick: () => setIsDialogOpen(true), icon: Plus }
              }
              compact
              designSystem="tenant-admin"
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Submit a priority support ticket for immediate assistance
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Brief description of the issue"
                        maxLength={200}
                        className="min-h-[44px] touch-manipulation"
                        autoFocus
                      />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Detailed description of the issue"
                        rows={6}
                        maxLength={2000}
                        className="min-h-[44px] touch-manipulation"
                      />
                    </FormControl>
                    <div className="text-xs text-muted-foreground text-right">
                      {field.value.length}/2000
                    </div>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="min-h-[44px] touch-manipulation">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  disabled={createTicketMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="min-h-[44px] touch-manipulation"
                >
                  {createTicketMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Ticket
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={async () => {
          if (ticketToDelete) {
            await deleteTicketMutation.mutateAsync(ticketToDelete);
          }
        }}
        itemType="ticket"
        isLoading={deleteTicketMutation.isPending}
      />
    </div>
  );
}
