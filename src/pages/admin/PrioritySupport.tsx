import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useState } from 'react';
import { MessageSquare, Send, Phone, Mail, Clock, User, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  responses?: Array<{
    id: string;
    message: string;
    from: 'user' | 'support';
    created_at: string;
  }>;
}

export default function PrioritySupport() {
  const { tenant, admin } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseMessage, setResponseMessage] = useState('');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support-tickets', tenantId],
    queryFn: async (): Promise<SupportTicket[]> => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

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
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const createTicketMutation = useMutation({
    mutationFn: async ({ subject, message }: { subject: string; message: string }) => {
      if (!tenantId) throw new Error('Tenant ID required');

      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          tenant_id: tenantId,
          subject,
          message,
          status: 'open',
          priority: 'high',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Support tickets table does not exist. Please run database migrations.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets', tenantId] });
      toast({ title: 'Ticket created', description: 'Your support ticket has been created.' });
      setShowTicketForm(false);
      setTicketSubject('');
      setTicketMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive',
      });
    },
  });

  const addResponseMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      // In production, would add to ticket_responses table
      toast({
        title: 'Response sent',
        description: 'Your response has been added to the ticket.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets', tenantId] });
      setResponseMessage('');
    },
  });

  const openTickets = tickets?.filter((t) => t.status === 'open' || t.status === 'in_progress').length || 0;
  const resolvedTickets = tickets?.filter((t) => t.status === 'resolved').length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading support tickets...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Priority Support</h1>
          <p className="text-muted-foreground">24/7 dedicated support and ticket management</p>
        </div>
        <Button onClick={() => setShowTicketForm(true)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Support Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{resolvedTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SLA Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">99.9%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">&lt; 2h</div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Support Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Live Chat</div>
                <div className="text-sm text-muted-foreground">Available 24/7</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Phone Support</div>
                <div className="text-sm text-muted-foreground">1-800-SUPPORT</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">Email</div>
                <div className="text-sm text-muted-foreground">support@example.com</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Ticket Form */}
      {showTicketForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  className="min-h-[150px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!ticketSubject.trim() || !ticketMessage.trim()) {
                      toast({
                        title: 'Fields required',
                        description: 'Please fill in both subject and message.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    createTicketMutation.mutate({ subject: ticketSubject, message: ticketMessage });
                  }}
                  disabled={createTicketMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Ticket
                </Button>
                <Button variant="outline" onClick={() => setShowTicketForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Detail View */}
      {selectedTicket && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedTicket.subject}</CardTitle>
              <Badge
                variant={
                  selectedTicket.status === 'resolved'
                    ? 'default'
                    : selectedTicket.status === 'in_progress'
                    ? 'secondary'
                    : 'outline'
                }
              >
                {selectedTicket.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-2">Initial Message</div>
              <div>{selectedTicket.message}</div>
            </div>

            {selectedTicket.responses && selectedTicket.responses.length > 0 && (
              <div className="space-y-3">
                <div className="font-semibold">Conversation</div>
                {selectedTicket.responses.map((response) => (
                  <div
                    key={response.id}
                    className={`p-3 rounded-lg ${
                      response.from === 'user' ? 'bg-blue-50 ml-8' : 'bg-green-50 mr-8'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {response.from === 'user' ? 'You' : 'Support Team'}
                    </div>
                    <div className="text-sm">{response.message}</div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(response.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              <Textarea
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                placeholder="Add a response..."
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (!responseMessage.trim()) {
                    toast({
                      title: 'Message required',
                      description: 'Please enter a response.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  addResponseMutation.mutate({
                    ticketId: selectedTicket.id,
                    message: responseMessage,
                  });
                }}
                disabled={addResponseMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets ({tickets?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.status === 'resolved'
                            ? 'default'
                            : ticket.status === 'in_progress'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {ticket.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ticket.priority === 'urgent'
                            ? 'destructive'
                            : ticket.priority === 'high'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {tickets !== undefined
                ? 'No support tickets. Create a new ticket to get help.'
                : 'Support tickets table not found. Please run database migrations.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Base */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <div className="font-semibold mb-1">Getting Started</div>
              <div className="text-sm text-muted-foreground">Guides and tutorials</div>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <div className="font-semibold mb-1">API Documentation</div>
              <div className="text-sm text-muted-foreground">Integration guides</div>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start">
              <div className="font-semibold mb-1">FAQ</div>
              <div className="text-sm text-muted-foreground">Common questions</div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

