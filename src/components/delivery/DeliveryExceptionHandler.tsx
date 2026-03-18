/**
 * Task 347: Create delivery exception handling
 * Report exceptions: wrong address, no answer, refused. Track resolution. Admin alerts.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/hooks/useTenantAdminAuth';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { notifyDeliveryAlert } from '@/components/notifications/notificationHelpers';

interface DeliveryExceptionHandlerProps {
  deliveryId: string;
  orderId: string;
}

type ExceptionType = 'wrong_address' | 'no_answer' | 'refused' | 'damaged' | 'other';

export function DeliveryExceptionHandler({ deliveryId, orderId }: DeliveryExceptionHandlerProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [exceptionType, setExceptionType] = useState<ExceptionType | ''>('');
  const [notes, setNotes] = useState('');

  const reportMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !exceptionType) throw new Error('Missing required fields');

      // Create exception record (would need a delivery_exceptions table)
      // For now, add notes to delivery and update order status
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          delivery_notes: `EXCEPTION: ${exceptionType} - ${notes}`,
        })
        .eq('id', deliveryId)
        .eq('tenant_id', tenant.id);

      if (deliveryError) throw deliveryError;

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'exception' })
        .eq('id', orderId)
        .eq('tenant_id', tenant.id);

      if (orderError) throw orderError;

      // Send admin alert notification (broadcast to all admins)
      const { error: notifError } = await supabase.from('notifications').insert({
        tenant_id: tenant.id,
        user_id: null,
        title: 'Delivery Exception',
        message: `Exception on delivery ${deliveryId.slice(0, 8)}: ${exceptionType.replace('_', ' ')} — ${notes}`,
        type: 'warning',
        entity_type: 'delivery',
        entity_id: deliveryId,
        read: false,
      });

      if (notifError) {
        logger.warn('Failed to create admin notification for exception', notifError);
      }

      logger.info('Delivery exception reported', { deliveryId, exceptionType, notes });
    },
    onSuccess: () => {
      toast.success('Exception reported successfully');
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(tenant?.id || '', orderId) });
      setExceptionType('');
      setNotes('');
    },
    onError: (error) => {
      logger.error('Failed to report exception', error);
      toast.error('Failed to report exception');
    },
  });

  const exceptionTypes: { value: ExceptionType; label: string }[] = [
    { value: 'wrong_address', label: 'Wrong Address' },
    { value: 'no_answer', label: 'No Answer / Nobody Home' },
    { value: 'refused', label: 'Customer Refused' },
    { value: 'damaged', label: 'Package Damaged' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Report Delivery Exception
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Exception Type</label>
          <Select value={exceptionType} onValueChange={(v) => setExceptionType(v as ExceptionType)}>
            <SelectTrigger>
              <SelectValue placeholder="Select exception type..." />
            </SelectTrigger>
            <SelectContent>
              {exceptionTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Details</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe what happened..."
            rows={4}
          />
        </div>

        <Button
          onClick={() => reportMutation.mutate()}
          disabled={!exceptionType || !notes || reportMutation.isPending}
          variant="destructive"
          className="w-full"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          {reportMutation.isPending ? 'Reporting...' : 'Report Exception'}
        </Button>
      </CardContent>
    </Card>
  );
}
