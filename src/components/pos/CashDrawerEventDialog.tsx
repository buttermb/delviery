import { useState } from 'react';
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
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import ArrowDownCircle from "lucide-react/dist/esm/icons/arrow-down-circle";
import ArrowUpCircle from "lucide-react/dist/esm/icons/arrow-up-circle";

interface CashDrawerEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'add' | 'remove' | 'payout';
  onConfirm: (amount: number, reason: string) => Promise<void>;
  isPending: boolean;
}

const typeConfig = {
  add: {
    title: 'Add Cash to Drawer',
    description: 'Record cash being added to the drawer',
    icon: <ArrowDownCircle className="h-5 w-5 text-green-600" />,
    buttonText: 'Add Cash',
    placeholder: 'e.g., Change from bank, additional float',
  },
  remove: {
    title: 'Remove Cash from Drawer',
    description: 'Record cash being removed from the drawer',
    icon: <ArrowUpCircle className="h-5 w-5 text-amber-600" />,
    buttonText: 'Remove Cash',
    placeholder: 'e.g., Deposit, safe drop',
  },
  payout: {
    title: 'Record Payout',
    description: 'Record a cash payout from the drawer',
    icon: <ArrowUpCircle className="h-5 w-5 text-red-600" />,
    buttonText: 'Record Payout',
    placeholder: 'e.g., Vendor payment, refund',
  },
};

export function CashDrawerEventDialog({
  open,
  onOpenChange,
  type,
  onConfirm,
  isPending,
}: CashDrawerEventDialogProps) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const config = typeConfig[type];
  const amountValue = parseFloat(amount) || 0;
  const isValid = amountValue > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    await onConfirm(amountValue, reason);
    setAmount('');
    setReason('');
  };

  const handleClose = () => {
    setAmount('');
    setReason('');
    onOpenChange(false);
  };

  const handleAmountChange = (value: string) => {
    // Allow only valid decimal numbers
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder={config.placeholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 resize-none"
              rows={2}
            />
          </div>

          {amountValue > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {type === 'add' ? 'Adding' : 'Removing'}:
                </span>{' '}
                <span className="font-bold">${amountValue.toFixed(2)}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isPending}>
            {isPending ? 'Processing...' : config.buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
