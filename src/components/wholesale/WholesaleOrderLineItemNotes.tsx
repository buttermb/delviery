/**
 * Wholesale Order Line Item Notes Component
 * Add notes to individual line items in wholesale orders
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileText, Edit, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface WholesaleOrderLineItemNotesProps {
  orderItemId: string;
  productName: string;
  currentNotes?: string;
}

export function WholesaleOrderLineItemNotes({
  orderItemId,
  productName,
  currentNotes,
}: WholesaleOrderLineItemNotesProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(currentNotes || '');
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('marketplace_order_items')
        .update({ notes })
        .eq('id', orderItemId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notes saved');
      queryClient.invalidateQueries({ queryKey: ['marketplace-order-items'] });
      setIsEditing(false);
    },
    onError: (error) => {
      logger.error('Failed to save notes', { error });
      toast.error('Failed to save notes');
    },
  });

  if (!isEditing && !notes) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="text-muted-foreground"
      >
        <FileText className="h-4 w-4 mr-2" />
        Add Note
      </Button>
    );
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Badge variant="outline">Note</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">{notes}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Note for {productName}</label>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setNotes(currentNotes || '');
            setIsEditing(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Textarea
        placeholder="Add special instructions, substitution preferences, etc."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Note'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setNotes(currentNotes || '');
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
