import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';

const FLAG_REASONS = [
  { value: 'suspicious_activity', label: 'Suspicious Activity' },
  { value: 'payment_issues', label: 'Payment Issues' },
  { value: 'compliance_concern', label: 'Compliance Concern' },
  { value: 'fraud_risk', label: 'Fraud Risk' },
  { value: 'identity_verification', label: 'Identity Verification Needed' },
  { value: 'other', label: 'Other' },
] as const;

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const;

interface FlagClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  tenantId: string;
}

export function FlagClientDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  tenantId,
}: FlagClientDialogProps) {
  const [flagType, setFlagType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const flagMutation = useMutation({
    mutationFn: async () => {
      // Insert fraud flag record
      const { error: flagError } = await supabase
        .from('fraud_flags')
        .insert({
          user_id: clientId,
          flag_type: flagType,
          severity,
          description: description.trim() || `${flagType} flag on ${clientName}`,
          tenant_id: tenantId,
        });
      if (flagError) throw flagError;

      // Update client status to flagged
      const { error: statusError } = await supabase
        .from('wholesale_clients')
        .update({ status: 'flagged' })
        .eq('id', clientId)
        .eq('tenant_id', tenantId);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      showSuccessToast('Client Flagged', `${clientName} has been flagged for review`);
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClient.byId(clientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleData.clientDetail(clientId, tenantId) });
      resetAndClose();
    },
    onError: (error) => {
      logger.error('Failed to flag client', error, { component: 'FlagClientDialog', clientId });
      showErrorToast('Failed to flag client');
    },
  });

  const resetAndClose = () => {
    setFlagType('');
    setSeverity('medium');
    setDescription('');
    onOpenChange(false);
  };

  const canSubmit = flagType.length > 0 && severity.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            Flag Client
          </DialogTitle>
          <DialogDescription>
            Flag {clientName} for review. This will mark the client as flagged and create a fraud alert.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="flag-reason">Reason</Label>
            <Select value={flagType} onValueChange={setFlagType}>
              <SelectTrigger id="flag-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {FLAG_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="flag-severity">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="flag-severity">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="flag-description">Notes (optional)</Label>
            <Textarea
              id="flag-description"
              placeholder="Add details about why this client is being flagged..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={flagMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => flagMutation.mutate()}
            disabled={!canSubmit || flagMutation.isPending}
          >
            {flagMutation.isPending ? 'Flagging...' : 'Flag Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
