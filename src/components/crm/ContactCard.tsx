/**
 * Contact Card Component
 * Inspired by Twenty CRM - compact contact display with quick actions
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  MessageSquare,
  User,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  ShoppingBag,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ContactCardProps {
  customerId: string;
  tenantId: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    total_spent?: number;
    loyalty_points?: number;
    last_purchase_at?: string | null;
  };
  onCall?: () => void;
  onEmail?: () => void;
  onMessage?: () => void;
}

export function ContactCard({
  customer,
  customerId,
  tenantId,
  onCall,
  onEmail,
  onMessage,
}: ContactCardProps) {
  // Fetch recent activity count
  const { data: activityCount } = useQuery({
    queryKey: ['customer-activity-count', customerId, tenantId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customer_activities')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId);

      if (error && error.code !== '42P01') throw error;
      return count || 0;
    },
    enabled: !!customerId && !!tenantId,
  });

  // Fetch order count
  const { data: orderCount } = useQuery({
    queryKey: ['customer-order-count', customerId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!customerId,
  });

  const fullName = `${customer.first_name} ${customer.last_name}`;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{fullName}</h3>
                <p className="text-sm text-muted-foreground">
                  {customer.email || 'No email'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            {customer.phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCall}
                className="flex-1 min-w-[100px]"
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            )}
            {customer.email && (
              <Button
                size="sm"
                variant="outline"
                onClick={onEmail}
                className="flex-1 min-w-[100px]"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onMessage}
              className="flex-1 min-w-[100px]"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Message
            </Button>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 pt-2 border-t">
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email}</span>
              </div>
            )}
            {(customer.address || customer.city || customer.state) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>
                  {[customer.address, customer.city, customer.state]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>Total Spent</span>
              </div>
              <p className="font-semibold">
                ${(customer.total_spent || 0).toLocaleString()}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingBag className="h-4 w-4" />
                <span>Orders</span>
              </div>
              <p className="font-semibold">{orderCount || 0}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Activities</span>
              </div>
              <p className="font-semibold">{activityCount || 0}</p>
            </div>
            {customer.last_purchase_at && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Last Purchase</span>
                </div>
                <p className="font-semibold text-xs">
                  {format(new Date(customer.last_purchase_at), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>

          {/* Loyalty Points */}
          {customer.loyalty_points !== undefined && customer.loyalty_points > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Loyalty Points</span>
                <Badge variant="secondary">{customer.loyalty_points}</Badge>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

