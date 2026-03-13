/**
 * Wholesale Order Approval Workflow Component
 * Allows admin to approve/reject wholesale orders with notes
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface WholesaleOrderApprovalProps {
  orderId: string;
  currentStatus: string;
  clientName: string;
  orderTotal: number;
}

export function WholesaleOrderApproval({
  orderId,
  currentStatus,
  clientName,
  orderTotal,
}: WholesaleOrderApprovalProps) {
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (action: 'approve' | 'reject') => {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';

      const { error } = await supabase
        .from('marketplace_orders')
        .update({
          status: newStatus,
          approval_notes: notes,
          approved_at: action === 'approve' ? new Date().toISOString() : null,
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: (_data, action) => {
      toast.success(
        action === 'approve' ? 'Order approved successfully' : 'Order rejected'
      );
      queryClient.invalidateQueries({ queryKey: ['wholesale-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      setNotes('');
    },
    onError: (error) => {
      logger.error('Failed to update order status', { error, orderId });
      toast.error('Failed to update order status');
    },
  });

  if (currentStatus !== 'pending') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p>This order has already been {currentStatus}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Client</p>
            <p className="font-medium">{clientName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Order Total</p>
            <p className="font-medium">${orderTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="approval-notes">Approval Notes (Optional)</Label>
          <Textarea
            id="approval-notes"
            placeholder="Add notes about this approval decision..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button
            variant="default"
            className="flex-1 bg-success hover:bg-success/90"
            onClick={() => approveMutation.mutate('approve')}
            disabled={approveMutation.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve Order
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => approveMutation.mutate('reject')}
            disabled={approveMutation.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
