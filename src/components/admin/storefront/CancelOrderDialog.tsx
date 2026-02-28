/**
 * Cancel Order Dialog
 * Prompts admin to select a cancellation reason before cancelling a storefront order.
 */

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';

const CANCELLATION_REASONS = [
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'customer_request', label: 'Customer request' },
  { value: 'unable_to_deliver', label: 'Unable to deliver' },
  { value: 'payment_issue', label: 'Payment issue' },
  { value: 'other', label: 'Other' },
] as const;

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderNumber,
  onConfirm,
  isPending,
}: CancelOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customNotes, setCustomNotes] = useState('');

  const handleConfirm = () => {
    const reason = selectedReason === 'other'
      ? customNotes.trim() || 'Other'
      : CANCELLATION_REASONS.find(r => r.value === selectedReason)?.label ?? selectedReason;
    onConfirm(reason);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSelectedReason('');
      setCustomNotes('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Order #{orderNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the order and restore inventory. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Cancellation reason</Label>
            <RadioGroup
              value={selectedReason}
              onValueChange={setSelectedReason}
              className="space-y-2"
            >
              {CANCELLATION_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={`reason-${reason.value}`} />
                  <Label htmlFor={`reason-${reason.value}`} className="font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {selectedReason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="cancel-notes">Details</Label>
              <Textarea
                id="cancel-notes"
                placeholder="Describe why this order is being cancelled..."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep Order</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cancel Order
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
