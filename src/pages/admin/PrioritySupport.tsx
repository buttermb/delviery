import { useState } from 'react';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Headphones, Plus, MessageCircle, Clock, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { handleError } from "@/utils/errorHandling/handlers";
import { isPostgrestError } from "@/utils/errorHandling/typeGuards";
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { queryKeys } from '@/lib/queryKeys';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  tenant_id: string;
}

export default function PrioritySupport() {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'high',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);

  const { data: tickets, isLoading } = useQuery({
    queryKey: queryKeys.superAdminTools.supportTickets(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('id, subject, description, priority, status, created_at, tenant_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

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

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: Omit<SupportTicket, 'id' | 'created_at' | 'tenant_id' | 'status'>) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          subject: ticket.subject,
          description: ticket.description,
          priority: ticket.priority || 'high',
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
      toast.success("Support ticket has been created with priority support.");
      setFormData({ subject: '', description: '', priority: 'high' });
      setIsDialogOpen(false);
    },
    onError: (error) => {
      handleError(error, {
        component: 'PrioritySupport.createTicket',
        toastTitle: 'Error',
        showToast: true
      });
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
      toast.success("Support ticket has been removed.");
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
    },
    onError: (error) => {
      handleError(error, {
        component: 'PrioritySupport.deleteTicket',
        toastTitle: 'Error',
        showToast: true
      });
    },
  });

  const resetForm = () => {
    setFormData({ subject: '', description: '', priority: 'high' });
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsDialogOpen(open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTicketMutation.mutate(formData);
  };

  if (isLoading) {
    return <EnhancedLoadingState variant="table" message="Loading support tickets..." />;
  }

  const openTickets = tickets?.filter((t: SupportTicket) => t.status === 'open').length ?? 0;
  const resolvedTickets = tickets?.filter((t: SupportTicket) => t.status === 'resolved').length ?? 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Priority Support</h1>
          <p className="text-muted-foreground">Enterprise-level support ticket management</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{resolvedTickets}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tickets?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
          <CardDescription>Your priority support tickets</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket: SupportTicket) => (
                <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{ticket.subject}</span>
                      <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}>
                        {ticket.priority || 'normal'}
                      </Badge>
                      <Badge variant={ticket.status === 'open' ? 'default' : 'outline'}>
                        {ticket.status || 'open'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{ticket.description}</div>
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
                    className="h-8 w-8 text-muted-foreground hover:text-destructive ml-2"
                    onClick={() => {
                      setTicketToDelete(ticket.id);
                      setDeleteDialogOpen(true);
                    }}
                    aria-label="Delete ticket"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Headphones className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No support tickets. Create a ticket to get priority support.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
              Submit a priority support ticket for immediate assistance
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending}>
                {createTicketMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </form>
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

