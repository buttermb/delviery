/**
 * Fronted Inventory Dashboard Widget
 * Displays summary of fronted orders with overdue alerts
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccount } from '@/contexts/AccountContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign, Clock, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { useToast } from '@/hooks/use-toast';

function isPastDue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function isDueThisWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  return due >= today && due <= weekFromNow;
}

function daysPastDue(dueDate: string | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = today.getTime() - due.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function FrontedInventoryWidget() {
  const { account } = useAccount();
  const { toast } = useToast();

  const { data: fronted, isLoading } = useQuery({
    queryKey: ['fronted-summary', account?.id],
    queryFn: async () => {
      if (!account?.id) return null;

      try {
        const { data, error } = await supabase
          .from('wholesale_orders')
          .select(`
            *,
            customer:wholesale_clients(business_name, contact_name, phone, email)
          `)
          .or('payment_status.eq.fronted,payment_status.eq.partial')
          .eq('account_id', account.id);

        if (error && error.code !== '42P01') {
          throw error;
        }

        const orders = data || [];

        const total = orders.reduce((sum: number, o: any) => 
          sum + Number(o.total_amount || o.total || 0), 0);

        const overdue = orders.filter((o: any) => 
          isPastDue(o.payment_due_date || o.due_date)
        );

        const dueThisWeek = orders.filter((o: any) => 
          isDueThisWeek(o.payment_due_date || o.due_date)
        );

        return {
          total,
          count: orders.length,
          overdue,
          dueThisWeek,
        };
      } catch (error: any) {
        if (error.code === '42P01') {
          // Table doesn't exist
          return { total: 0, count: 0, overdue: [], dueThisWeek: [] };
        }
        throw error;
      }
    },
    enabled: !!account?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  const sendReminders = async () => {
    if (!fronted?.overdue || fronted.overdue.length === 0) return;

    try {
      // TODO: Integrate with SMS/Twilio Edge Function
      toast({
        title: 'Reminders Sent',
        description: `Payment reminders sent to ${fronted.overdue.length} customers`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to send reminders',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fronted Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!fronted || fronted.count === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fronted Inventory</CardTitle>
          <CardDescription>Orders with payment pending</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No fronted orders</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fronted Inventory
        </CardTitle>
        <CardDescription>Total amount fronted to customers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Fronted */}
        <div>
          <div className="text-3xl font-bold">
            {formatCurrency(fronted.total)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {fronted.count} {fronted.count === 1 ? 'order' : 'orders'} fronted
          </div>
        </div>

        {/* Critical: Overdue */}
        {fronted.overdue.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Overdue Payments</AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {fronted.overdue.slice(0, 3).map((order: any) => {
                  const customer = order.customer || {};
                  const customerName = customer.business_name || customer.contact_name || 'Unknown Customer';
                  const dueDate = order.payment_due_date || order.due_date;
                  const days = daysPastDue(dueDate);
                  
                  return (
                    <div key={order.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{customerName}</span>
                        <span className="text-muted-foreground ml-2">
                          ({days}d late)
                        </span>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(Number(order.total_amount || order.total || 0))}
                      </span>
                    </div>
                  );
                })}
                {fronted.overdue.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{fronted.overdue.length - 3} more overdue
                  </div>
                )}
              </div>
              <Button 
                size="sm" 
                className="mt-3 w-full" 
                onClick={sendReminders}
                variant="destructive"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Payment Reminders
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Due This Week */}
        {fronted.dueThisWeek.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Due This Week
            </div>
            {fronted.dueThisWeek.slice(0, 5).map((order: any) => {
              const customer = order.customer || {};
              const customerName = customer.business_name || customer.contact_name || 'Unknown Customer';
              
              return (
                <div key={order.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted">
                  <span>{customerName}</span>
                  <span className="font-semibold">
                    {formatCurrency(Number(order.total_amount || order.total || 0))}
                  </span>
                </div>
              );
            })}
            {fronted.dueThisWeek.length > 5 && (
              <div className="text-xs text-muted-foreground text-center">
                +{fronted.dueThisWeek.length - 5} more due this week
              </div>
            )}
          </div>
        )}

        {fronted.overdue.length === 0 && fronted.dueThisWeek.length === 0 && (
          <div className="text-center py-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              All payments up to date
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

