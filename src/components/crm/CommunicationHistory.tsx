/**
 * Communication History Component
 * Inspired by Chatwoot - displays email and SMS communication thread
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Mail,
  MessageSquare,
  Send,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

interface Communication {
  id: string;
  customer_id: string;
  tenant_id: string;
  type: 'email' | 'sms';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  metadata: Record<string, any> | null;
  created_by: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

interface CommunicationHistoryProps {
  customerId: string;
  tenantId: string;
  customerEmail?: string;
  customerPhone?: string;
}

export function CommunicationHistory({
  customerId,
  tenantId,
  customerEmail,
  customerPhone,
}: CommunicationHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    type: 'email' as 'email' | 'sms',
    subject: '',
    body: '',
  });

  // Fetch communications
  const { data: communications, isLoading } = useQuery<Communication[]>({
    queryKey: ['customer-communications', customerId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_communications')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('sent_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
          return [];
        }
        throw error;
      }

      // Map database columns to Communication interface
      return (data || []).map(item => ({
        id: item.id,
        customer_id: item.customer_id,
        tenant_id: item.tenant_id,
        type: item.communication_type as 'email' | 'sms',
        direction: 'outbound' as const, // Default to outbound for now
        subject: item.subject,
        body: item.body,
        status: item.status as 'sent' | 'delivered' | 'read' | 'failed',
        sent_at: item.sent_at,
        delivered_at: null,
        read_at: null,
        metadata: item.metadata as Record<string, any> | null,
        created_by: item.created_by,
        profiles: null
      })) as Communication[];
    },
    enabled: !!customerId && !!tenantId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: { type: 'email' | 'sms'; subject: string; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('customer_communications')
        .insert({
          customer_id: customerId,
          tenant_id: tenantId,
          communication_type: message.type,
          subject: message.subject || null,
          body: message.body,
          status: 'sent',
          created_by: user.id,
          metadata: {},
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Communication tracking not available. Please run the database migration.');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-communications', customerId, tenantId] });
      toast({
        title: 'Message sent',
        description: `${newMessage.type === 'email' ? 'Email' : 'SMS'} has been sent successfully`,
      });
      setSendDialogOpen(false);
      setNewMessage({ type: 'email', subject: '', body: '' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.body.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter a message',
        variant: 'destructive',
      });
      return;
    }

    if (newMessage.type === 'email' && !customerEmail) {
      toast({
        title: 'Email required',
        description: 'Customer email is needed to send email',
        variant: 'destructive',
      });
      return;
    }

    if (newMessage.type === 'sms' && !customerPhone) {
      toast({
        title: 'Phone required',
        description: 'Customer phone is needed to send SMS',
        variant: 'destructive',
      });
      return;
    }

    sendMessageMutation.mutate(newMessage);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'delivered':
        return <CheckCircle2 className="h-3 w-3 text-blue-500" />;
      case 'sent':
        return <Clock className="h-3 w-3 text-gray-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">Loading communications...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication History
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setSendDialogOpen(true)}>
          <Send className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      </CardHeader>
      <CardContent>
        {communications && communications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No communications yet</p>
            <p className="text-sm mt-2">Start a conversation with this customer</p>
          </div>
        ) : (
          <div className="space-y-4">
            {communications?.map((comm) => {
              const isOutbound = comm.direction === 'outbound';
              const Icon = comm.type === 'email' ? Mail : MessageSquare;

              return (
                <div
                  key={comm.id}
                  className={`flex gap-3 ${isOutbound ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar/Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isOutbound
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Message Content */}
                  <div
                    className={`flex-1 space-y-1 ${
                      isOutbound ? 'items-end text-right' : 'items-start text-left'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {comm.type.toUpperCase()}
                        </Badge>
                        {isOutbound ? (
                          <ArrowUpCircle className="h-4 w-4 text-blue-500" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-green-500" />
                        )}
                        {comm.subject && (
                          <span className="font-medium text-sm">{comm.subject}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(comm.status)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comm.sent_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`rounded-lg p-3 ${
                        isOutbound
                          ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                          : 'bg-muted max-w-[80%]'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{comm.body}</p>
                    </div>

                    {comm.profiles && isOutbound && (
                      <p className="text-xs text-muted-foreground">
                        {comm.profiles.full_name || comm.profiles.email || 'You'}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Send Message Dialog */}
        {sendDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Message Type</Label>
                  <Select
                    value={newMessage.type}
                    onValueChange={(value: 'email' | 'sms') =>
                      setNewMessage({ ...newMessage, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newMessage.type === 'email' && (
                  <div>
                    <Label>Subject</Label>
                    <Input
                      placeholder="Email subject"
                      value={newMessage.subject}
                      onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                    />
                  </div>
                )}

                <div>
                  <Label>Message *</Label>
                  <Textarea
                    placeholder={
                      newMessage.type === 'email'
                        ? 'Enter your email message...'
                        : 'Enter your SMS message...'
                    }
                    value={newMessage.body}
                    onChange={(e) => setNewMessage({ ...newMessage, body: e.target.value })}
                    rows={6}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSendDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  >
                    {sendMessageMutation.isPending ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

