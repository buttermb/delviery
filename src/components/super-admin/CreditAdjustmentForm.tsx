/**
 * Credit Adjustment Form
 * 
 * Dialog for super admins to manually adjust tenant credit balances.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Plus,
  Minus,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
import { queryKeys } from '@/lib/queryKeys';
  adjustTenantCredits,
  getTenantCreditDetail,
  type AdjustmentReason,
} from '@/lib/credits';

interface CreditAdjustmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  onSuccess: () => void;
}

const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'support_resolution', label: 'Support Resolution' },
  { value: 'billing_correction', label: 'Billing Correction' },
  { value: 'promotional_grant', label: 'Promotional Grant' },
  { value: 'goodwill_gesture', label: 'Goodwill Gesture' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'testing', label: 'Testing' },
  { value: 'other', label: 'Other' },
];

export function CreditAdjustmentForm({
  open,
  onOpenChange,
  tenantId,
  onSuccess,
}: CreditAdjustmentFormProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState<AdjustmentReason>('support_resolution');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // Fetch current tenant balance
  const { data: tenantDetail } = useQuery({
    queryKey: queryKeys.superAdminTools.creditAdjustmentForm(tenantId),
    queryFn: () => getTenantCreditDetail(tenantId),
    enabled: open && !!tenantId,
  });

  // Adjustment mutation
  const mutation = useMutation({
    mutationFn: () => {
      const adjustmentAmount = adjustmentType === 'add' ? amount : -amount;
      return adjustTenantCredits({
        tenantId,
        amount: adjustmentAmount,
        reason,
        notes: notes || undefined,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Credits adjusted. New balance: ${result.newBalance?.toLocaleString()}`);
        resetForm();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to adjust credits');
      }
    },
    onError: (error) => {
      toast.error('Failed to adjust credits', { description: humanizeError(error) });
    },
  });

  // Reset form
  const resetForm = () => {
    setAdjustmentType('add');
    setAmount(100);
    setReason('support_resolution');
    setNotes('');
    setConfirmed(false);
  };

  // Calculate new balance preview
  const currentBalance = tenantDetail?.credits.balance || 0;
  const newBalance = adjustmentType === 'add' 
    ? currentBalance + amount 
    : Math.max(0, currentBalance - amount);

  // Check if confirmation is required (for large adjustments)
  const requiresConfirmation = amount > 500;

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresConfirmation && !confirmed) {
      toast.error('Please confirm this large adjustment');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Credit Balance</DialogTitle>
          <DialogDescription>
            {tenantDetail?.tenant.name ? (
              <>Adjusting credits for <strong>{tenantDetail.tenant.name}</strong></>
            ) : (
              'Manually add or remove credits from this tenant account.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Balance Display */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-mono font-medium">
                {currentBalance.toLocaleString()} credits
              </span>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === 'add' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('add')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Credits
              </Button>
              <Button
                type="button"
                variant={adjustmentType === 'subtract' ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('subtract')}
              >
                <Minus className="h-4 w-4 mr-2" />
                Remove Credits
              </Button>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 0))}
              min={1}
              max={100000}
              required
            />
            <div className="flex gap-2">
              {[50, 100, 250, 500, 1000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preset)}
                  className={amount === preset ? 'border-primary' : ''}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          {/* New Balance Preview */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New Balance</span>
              <span className={`font-mono font-medium ${
                adjustmentType === 'add' ? 'text-green-600' : 'text-red-600'
              }`}>
                {newBalance.toLocaleString()} credits
                <span className="text-muted-foreground ml-1">
                  ({adjustmentType === 'add' ? '+' : '-'}{amount.toLocaleString()})
                </span>
              </span>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional context..."
              rows={2}
            />
          </div>

          {/* Large Amount Warning */}
          {requiresConfirmation && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a large adjustment ({amount.toLocaleString()} credits). 
                Please confirm this action.
              </AlertDescription>
            </Alert>
          )}

          {/* Confirmation Checkbox */}
          {requiresConfirmation && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              />
              <Label htmlFor="confirm" className="text-sm">
                I confirm this credit adjustment is correct
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={adjustmentType === 'subtract' ? 'destructive' : 'default'}
              disabled={mutation.isPending || (requiresConfirmation && !confirmed)}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {adjustmentType === 'add' ? 'Add' : 'Remove'} {amount.toLocaleString()} Credits
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}







