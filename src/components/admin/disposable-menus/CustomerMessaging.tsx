import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Users,
  MessageSquare,
  Mail,
  Phone,
  Loader2,
} from 'lucide-react';
import { useMenuOrders } from '@/hooks/useDisposableMenus';
import { toast } from 'sonner';
import { useFreeTierLimits } from '@/hooks/useFreeTierLimits';
import { formatPhoneNumber } from '@/lib/formatters';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const CustomerMessaging = () => {
  const { data: orders } = useMenuOrders();
  const [sending, setSending] = useState(false);
  const { checkLimit, recordAction, limitsApply } = useFreeTierLimits();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');

  interface Customer {
    name: string;
    phone: string;
    email?: string | null;
    orderCount: number;
    lastOrder: string;
    status: string;
  }

  interface OrderData {
    contact_phone?: string | null;
    created_at: string;
    status: string;
  }

  // Get unique customers from orders using contact_phone
  const typedOrders = (orders ?? []) as OrderData[];
  const customers = typedOrders.reduce((acc: Customer[], order: OrderData) => {
    if (order.contact_phone && !acc.find(c => c.phone === order.contact_phone)) {
      acc.push({
        name: order.contact_phone,
        phone: order.contact_phone,
        email: null,
        orderCount: typedOrders.filter(o => o.contact_phone === order.contact_phone).length,
        lastOrder: order.created_at,
        status: order.status
      });
    }
    return acc;
  }, []);

  const filteredCustomers = filterStatus === 'all' 
    ? customers 
    : customers.filter((c: Customer) => c.status === filterStatus);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message to send.");
      return;
    }

    if (channel === 'email' && !subject.trim()) {
      toast.error("Please enter an email subject.");
      return;
    }

    // Check free tier SMS/email limits (users with purchased credits bypass limits)
    if (limitsApply) {
      const limitType = channel === 'sms' ? 'sms_per_month' : 'emails_per_month';
      const messageCount = filteredCustomers.length;
      const limitCheck = checkLimit(limitType, messageCount);
      if (!limitCheck.allowed) {
        toast.error("Monthly ${channel.toUpperCase()} Limit Reached");
        return;
      }
    }

    setSending(true);
    try {
      // Simulate sending (would call edge function in production)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Record action for free tier limit tracking
      if (limitsApply) {
        for (let i = 0; i < filteredCustomers.length; i++) {
          await recordAction(channel === 'sms' ? 'sms' : 'email');
        }
      }

      toast.success("Successfully sent ${filteredCustomers.length} ${channel} messages.");

      setMessage('');
      setSubject('');
    } catch {
      toast.error("Send Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send Bulk Message
          </CardTitle>
          <CardDescription>
            Send messages to customers based on their order status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel Selection */}
          <div className="space-y-2">
            <Label>Notification Channel</Label>
            <Select value={channel} onValueChange={(value: string) => setChannel(value as 'email' | 'sms')}>
              <SelectTrigger>
                <SelectValue placeholder="Select channel" />
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
                    <Phone className="h-4 w-4" />
                    SMS
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter by Status */}
          <div className="space-y-2">
            <Label>Filter Recipients by Order Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter recipients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="pending">Pending Orders</SelectItem>
                <SelectItem value="processing">Processing Orders</SelectItem>
                <SelectItem value="completed">Completed Orders</SelectItem>
                <SelectItem value="cancelled">Cancelled Orders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{filteredCustomers.length} recipients selected</span>
          </div>

          <Separator />

          {/* Message Composition */}
          {channel === 'email' && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here. Use {{customer_name}} and {{order_id}} as variables."
              rows={6}
            />
          </div>

          <Button 
            onClick={handleSendMessage} 
            disabled={sending || filteredCustomers.length === 0}
            className="w-full"
            size="lg"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {filteredCustomers.length} Customer{filteredCustomers.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recipients ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No customers match the selected filter
                </div>
              ) : (
                filteredCustomers.map((customer: Customer) => (
                  <div key={customer.phone} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {formatPhoneNumber(customer.phone)}
                        </div>
                        {customer.email && (
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {customer.email}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {customer.orderCount} order{customer.orderCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {customer.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
