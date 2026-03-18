import { logger } from '@/lib/logger';
/**
 * Communication History Component
 * Displays all customer communications aggregated from multiple sources:
 * - Direct communications (email, SMS)
 * - Order status updates
 * - Recall notifications
 * Supports filtering by channel and date range.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import {
  Mail,
  MessageSquare,
  Send,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bell,
  Package,
  Filter,
  X,
  ExternalLink,
  CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { queryKeys } from '@/lib/queryKeys';

// Union type for all communication sources
interface CommunicationItem {
  id: string;
  source: 'direct' | 'order' | 'recall';
  channel: 'email' | 'sms' | 'notification';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  sentAt: Date;
  orderId?: string | null;
  orderNumber?: string | null;
  recallId?: string | null;
  createdByName?: string | null;
}

interface CommunicationHistoryProps {
  customerId: string;
  tenantId: string;
  customerEmail?: string;
  customerPhone?: string;
}

type ChannelFilter = 'all' | 'email' | 'sms' | 'notification';
type DateFilter = 'all' | '7days' | '30days' | '90days' | 'custom';

export function CommunicationHistory({
  customerId,
  tenantId,
  customerEmail,
  customerPhone,
}: CommunicationHistoryProps) {
  const queryClient = useQueryClient();
  const { navigateToAdmin } = useTenantNavigation();
  const isMobile = useIsMobile();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    type: 'email' as 'email' | 'sms',
    subject: '',
    body: '',
  });

  // Filter state
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch direct communications
  const { data: directComms, isLoading: directLoading } = useQuery({
    queryKey: queryKeys.customerComms.direct(customerId, tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_communications')
        .select(`
          id, communication_type, subject, body, status, sent_at, created_at,
          profiles:created_by(full_name)
        `)
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .order('sent_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }

      return (data ?? []).map((item): CommunicationItem => ({
        id: item.id,
        source: 'direct',
        channel: item.communication_type as 'email' | 'sms',
        direction: 'outbound',
        subject: item.subject,
        body: item.body ?? '',
        status: (item.status as CommunicationItem['status']) || 'sent',
        sentAt: new Date(item.sent_at || item.created_at || new Date()),
        createdByName: (item.profiles as { full_name?: string } | null)?.full_name,
      }));
    },
    enabled: !!customerId && !!tenantId,
  });

  // Fetch order-related communications (status updates that were sent to customer)
  const { data: orderComms, isLoading: orderLoading } = useQuery({
    queryKey: queryKeys.customerComms.orderComms(customerId, tenantId),
    queryFn: async () => {
      // First get customer's orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      if (ordersError || !orders?.length) return [];

      const orderIds = orders.map(o => o.id);
      const orderMap = new Map(orders.map(o => [o.id, o.order_number]));

      // Get status history for these orders
      const { data: statusHistory, error: statusError } = await supabase
        .from('order_status_history')
        .select('id, order_id, new_status, notes, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (statusError || !statusHistory?.length) return [];

      // Filter to status changes that would have sent notifications
      const notifiableStatuses = ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

      return statusHistory
        .filter(h => notifiableStatuses.includes(h.new_status))
        .map((item): CommunicationItem => ({
          id: item.id,
          source: 'order',
          channel: 'notification',
          direction: 'outbound',
          subject: `Order ${item.new_status.replace(/_/g, ' ')}`,
          body: item.notes || `Order status changed to ${item.new_status.replace(/_/g, ' ')}`,
          status: 'delivered',
          sentAt: new Date(item.created_at || new Date()),
          orderId: item.order_id,
          orderNumber: item.order_id ? (orderMap.get(item.order_id) as string ?? null) : null,
        }));
    },
    enabled: !!customerId && !!tenantId,
  });

  // Fetch recall notifications
  const { data: recallComms, isLoading: recallLoading } = useQuery({
    queryKey: queryKeys.customerComms.recallComms(customerId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recall_notifications')
        .select(`
          id, notification_type, status, sent_at, created_at, recall_id,
          batch_recalls(recall_reason, product_name)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }

      return (data ?? []).map((item): CommunicationItem => {
        const recall = item.batch_recalls as { recall_reason: string | null; product_name: string | null } | null;
        return {
          id: item.id,
          source: 'recall',
          channel: (item.notification_type as 'email' | 'sms') || 'email',
          direction: 'outbound',
          subject: `Product Recall Notice`,
          body: recall?.recall_reason || 'Product recall notification sent',
          status: (item.status as CommunicationItem['status']) || 'sent',
          sentAt: new Date(item.sent_at || item.created_at || new Date()),
          recallId: item.recall_id,
        };
      });
    },
    enabled: !!customerId,
  });

  // Combine and sort all communications
  const allCommunications = useMemo(() => {
    const combined: CommunicationItem[] = [
      ...(directComms ?? []),
      ...(orderComms ?? []),
      ...(recallComms ?? []),
    ];

    // Apply channel filter
    let filtered = combined;
    if (channelFilter !== 'all') {
      filtered = filtered.filter(c => c.channel === channelFilter);
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate = endOfDay(now);

      if (dateFilter === '7days') {
        startDate = startOfDay(subDays(now, 7));
      } else if (dateFilter === '30days') {
        startDate = startOfDay(subDays(now, 30));
      } else if (dateFilter === '90days') {
        startDate = startOfDay(subMonths(now, 3));
      } else if (dateFilter === 'custom' && customDateRange.from) {
        startDate = startOfDay(customDateRange.from);
        endDate = customDateRange.to ? endOfDay(customDateRange.to) : endDate;
      } else {
        startDate = new Date(0); // Beginning of time
      }

      filtered = filtered.filter(c =>
        isWithinInterval(c.sentAt, { start: startDate, end: endDate })
      );
    }

    // Sort by date descending
    return filtered.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }, [directComms, orderComms, recallComms, channelFilter, dateFilter, customDateRange]);

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
        .maybeSingle();

      if (error) {
        if (error.code === '42P01') {
          throw new Error('Communication tracking not available. Please run the database migration.');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerComms.direct(customerId, tenantId) });
      toast.success(`${newMessage.type === 'email' ? 'Email' : 'SMS'} has been sent successfully`);
      setSendDialogOpen(false);
      setNewMessage({ type: 'email', subject: '', body: '' });
    },
    onError: (error: unknown) => {
      logger.error('Failed to send message', error, { component: 'CommunicationHistory' });
      toast.error('Failed to send message', { description: humanizeError(error) });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.body.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (newMessage.type === 'email' && !customerEmail) {
      toast.error('Customer email is needed to send email');
      return;
    }

    if (newMessage.type === 'sms' && !customerPhone) {
      toast.error('Customer phone is needed to send SMS');
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
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'sms':
        return <MessageSquare className="h-5 w-5" />;
      case 'notification':
        return <Bell className="h-5 w-5" />;
      default:
        return <MessageSquare className="h-5 w-5" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'order':
        return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Order Update</Badge>;
      case 'recall':
        return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Recall</Badge>;
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setChannelFilter('all');
    setDateFilter('all');
    setCustomDateRange({ from: undefined, to: undefined });
  };

  const hasActiveFilters = channelFilter !== 'all' || dateFilter !== 'all';
  const isLoading = directLoading || orderLoading || recallLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
            Loading communications...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Communication History
          {allCommunications.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {allCommunications.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showFilters ? 'secondary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                !
              </Badge>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSendDialogOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </CardHeader>

      {/* Filters Section */}
      {showFilters && (
        <div className="px-6 pb-4 border-b">
          <div className="flex flex-wrap items-end gap-4">
            {/* Channel Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Channel</Label>
              <Select value={channelFilter} onValueChange={(v: ChannelFilter) => setChannelFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="notification">Notifications</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              <Select value={dateFilter} onValueChange={(v: DateFilter) => setDateFilter(v)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Custom Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[240px] justify-start text-left font-normal',
                        !customDateRange.from && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, 'LLL dd')} -{' '}
                            {format(customDateRange.to, 'LLL dd, yyyy')}
                          </>
                        ) : (
                          format(customDateRange.from, 'LLL dd, yyyy')
                        )
                      ) : (
                        'Pick a date range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={{
                        from: customDateRange.from,
                        to: customDateRange.to,
                      }}
                      onSelect={(range) => {
                        setCustomDateRange({
                          from: range?.from,
                          to: range?.to,
                        });
                      }}
                      numberOfMonths={isMobile ? 1 : 2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <CardContent className="pt-4">
        {allCommunications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{hasActiveFilters ? 'No communications match your filters' : 'No communications yet'}</p>
            <p className="text-sm mt-2">
              {hasActiveFilters ? 'Try adjusting your filters' : 'Start a conversation with this customer'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {allCommunications.map((comm) => {
              const isOutbound = comm.direction === 'outbound';
              const Icon = getChannelIcon(comm.channel);

              return (
                <div
                  key={`${comm.source}-${comm.id}`}
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
                    {Icon}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`flex-1 space-y-1 ${
                      isOutbound ? 'items-end text-right' : 'items-start text-left'
                    }`}
                  >
                    <div className="flex items-center gap-2 justify-between flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {comm.channel.toUpperCase()}
                        </Badge>
                        {getSourceBadge(comm.source)}
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
                          {format(comm.sentAt, 'MMM d, h:mm a')}
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

                    {/* Order Link */}
                    {comm.orderId && comm.orderNumber && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => navigateToAdmin(`orders/${comm.orderId}`)}
                      >
                        <Package className="h-3 w-3 mr-1" />
                        Order #{comm.orderNumber}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}

                    {comm.createdByName && isOutbound && (
                      <p className="text-xs text-muted-foreground">
                        Sent by {comm.createdByName}
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
                      <SelectValue placeholder="Select type" />
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
