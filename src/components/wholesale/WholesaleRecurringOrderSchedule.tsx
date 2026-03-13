/**
 * Wholesale Recurring Order Schedule Component
 * Allows clients to set up automatic recurring orders
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface RecurringSchedule {
  enabled: boolean;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  next_order_date?: string;
}

interface WholesaleRecurringOrderScheduleProps {
  orderId: string;
  currentSchedule?: RecurringSchedule;
}

export function WholesaleRecurringOrderSchedule({
  orderId,
  currentSchedule,
}: WholesaleRecurringOrderScheduleProps) {
  const [enabled, setEnabled] = useState(currentSchedule?.enabled || false);
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>(
    currentSchedule?.frequency || 'monthly'
  );
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextDate = calculateNextOrderDate(frequency);

      const { error } = await supabase
        .from('marketplace_orders')
        .update({
          recurring_enabled: enabled,
          recurring_frequency: enabled ? frequency : null,
          next_recurring_date: enabled ? nextDate : null,
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        enabled ? 'Recurring order scheduled' : 'Recurring order cancelled'
      );
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders', orderId] });
    },
    onError: (error) => {
      logger.error('Failed to update recurring schedule', { error, orderId });
      toast.error('Failed to update schedule');
    },
  });

  const calculateNextOrderDate = (freq: string): string => {
    const now = new Date();
    switch (freq) {
      case 'weekly':
        now.setDate(now.getDate() + 7);
        break;
      case 'biweekly':
        now.setDate(now.getDate() + 14);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now.toISOString();
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'weekly':
        return 'Every week';
      case 'biweekly':
        return 'Every 2 weeks';
      case 'monthly':
        return 'Every month';
      default:
        return freq;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Recurring Order Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Enable Auto-Reorder</span>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly (Every 2 weeks)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">Your order will repeat {getFrequencyLabel(frequency)}</p>
                  <p className="text-xs text-muted-foreground">
                    We'll automatically create a new order with the same items. You can pause or
                    cancel at any time.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <Button
          className="w-full"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Schedule'}
        </Button>
      </CardContent>
    </Card>
  );
}
