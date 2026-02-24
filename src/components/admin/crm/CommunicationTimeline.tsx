import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useTenantAdminAuth } from "@/contexts/TenantAdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, ShoppingCart, Calendar, MessageSquare } from "lucide-react";
import { Loader2 } from "lucide-react";
import { formatSmartDate } from "@/lib/formatters";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
}

interface CommunicationTimelineProps {
  customers: Customer[];
}

interface TimelineEvent {
  type: "order" | "email" | "sms" | "call" | "note";
  date: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export function CommunicationTimeline({ customers }: CommunicationTimelineProps) {
  const { tenant } = useTenantAdminAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const { data: timeline, isLoading } = useQuery({
    queryKey: queryKeys.customerTimeline.byCustomer(selectedCustomerId),
    queryFn: async () => {
      if (!selectedCustomerId || !tenant?.id) return [];

      const events: TimelineEvent[] = [];

      // Get orders
      try {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, created_at, total_amount, status")
          .eq("customer_id", selectedCustomerId)
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (orders) {
          orders.forEach((order) => {
            events.push({
              type: "order",
              date: order.created_at,
              description: `Order #${order.id.substring(0, 8)} - $${order.total_amount}`,
              metadata: order,
            });
          });
        }
      } catch {
        // Orders table might not exist
      }

      // Sort by date
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return events;
    },
    enabled: !!selectedCustomerId && !!tenant?.id,
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case "order":
        return ShoppingCart;
      case "email":
        return Mail;
      case "sms":
        return MessageSquare;
      case "call":
        return Phone;
      default:
        return Calendar;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Timeline</CardTitle>
        <CardDescription>
          View all customer touchpoints in one place
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
          <SelectTrigger className="min-h-[44px] touch-manipulation">
            <SelectValue placeholder="Select a customer" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((customer) => (
              <SelectItem key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedCustomerId && (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : timeline && timeline.length > 0 ? (
              <div className="space-y-2">
                {timeline.map((event, index) => {
                  const Icon = getEventIcon(event.type);
                  return (
                    <div
                      key={`${event.type}-${event.date}-${index}`}
                      className="flex items-start gap-3 p-3 border rounded-lg"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <div className="font-medium line-clamp-2">{event.description}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatSmartDate(event.date, { includeTime: true })}
                        </div>
                      </div>
                      <Badge variant="outline">{event.type}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No communication history found for this customer.
              </div>
            )}
          </>
        )}

        {!selectedCustomerId && (
          <div className="text-center py-8 text-muted-foreground">
            Select a customer to view their communication timeline.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

