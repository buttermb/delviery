/**
 * StorefrontGiftCardManager Component
 * Issue dialog for creating new gift cards
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface IssueFormData {
  initial_balance: string;
  recipient_email: string;
  recipient_name: string;
  notes: string;
  custom_code: string;
}

const initialFormData: IssueFormData = {
  initial_balance: '',
  recipient_email: '',
  recipient_name: '',
  notes: '',
  custom_code: '',
};

const PRESET_AMOUNTS = [25, 50, 100, 250];

interface GiftCardManagerProps {
  storeId: string;
}

export function StorefrontGiftCardManager({ storeId }: GiftCardManagerProps) {
  const queryClient = useQueryClient();
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState<IssueFormData>(initialFormData);

  const issueCardMutation = useMutation({
    mutationFn: async (data: IssueFormData) => {
      const { data: cardId, error } = await (supabase.rpc as unknown as (
        fn: string,
        params: Record<string, unknown>
      ) => Promise<{ data: string | null; error: { message: string } | null }>)(
        'issue_marketplace_gift_card',
        {
          p_store_id: storeId,
          p_initial_balance: Number(data.initial_balance),
          p_code: data.custom_code || null,
          p_recipient_email: data.recipient_email || null,
          p_recipient_name: data.recipient_name || null,
          p_notes: data.notes || null,
        }
      );

      if (error) throw new Error(error.message);
      return cardId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gift-cards', storeId] });
      toast.success("Gift Card Issued Successfully");
      setIsIssueDialogOpen(false);
      setIssueForm(initialFormData);
    },
    onError: (err: Error) => {
      logger.error('Gift card issue failed', { error: err.message });
      toast.error("Error issuing card");
    },
  });

  const openIssueDialog = () => setIsIssueDialogOpen(true);

  return (
    <>
      <Button onClick={openIssueDialog}>
        <Plus className="h-4 w-4 mr-2" />
        Issue Card
      </Button>

      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Gift Card</DialogTitle>
            <DialogDescription>
              Create a new gift card. Use for comps, refunds, or promotional gifts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <div className="flex gap-2 mb-2">
                {PRESET_AMOUNTS.map(amount => (
                  <Button
                    key={amount}
                    type="button"
                    variant={issueForm.initial_balance === String(amount) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIssueForm({ ...issueForm, initial_balance: String(amount) })}
                  >
                    ${amount}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                placeholder="Custom amount..."
                value={issueForm.initial_balance}
                onChange={e => setIssueForm({ ...issueForm, initial_balance: e.target.value })}
                min="0.01"
                step="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label>Recipient Email (Optional)</Label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={issueForm.recipient_email}
                onChange={e => setIssueForm({ ...issueForm, recipient_email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Recipient Name (Optional)</Label>
              <Input
                placeholder="Customer name"
                value={issueForm.recipient_name}
                onChange={e => setIssueForm({ ...issueForm, recipient_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Custom Code (Optional)</Label>
              <Input
                placeholder="Leave empty to auto-generate"
                value={issueForm.custom_code}
                onChange={e => setIssueForm({ ...issueForm, custom_code: e.target.value.toUpperCase() })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Auto-generated format: GC-ABCD1234</p>
            </div>

            <div className="space-y-2">
              <Label>Internal Notes (Optional)</Label>
              <Input
                placeholder="Reason for issue..."
                value={issueForm.notes}
                onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => issueCardMutation.mutate(issueForm)}
              disabled={!issueForm.initial_balance || Number(issueForm.initial_balance) <= 0 || issueCardMutation.isPending}
            >
              {issueCardMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Issuing...
                </>
              ) : (
                'Issue Card'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
