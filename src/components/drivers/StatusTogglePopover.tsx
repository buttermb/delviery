import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { Driver } from '@/pages/drivers/DriverDirectoryPage';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface StatusTogglePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver;
  tenantId: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', description: 'Driver can accept deliveries' },
  { value: 'inactive', label: 'Inactive', description: 'Temporarily not available' },
  { value: 'suspended', label: 'Suspended', description: 'Account is suspended' },
] as const;

export function StatusTogglePopover({ open, onOpenChange, driver, tenantId }: StatusTogglePopoverProps) {
  const [selected, setSelected] = useState<string>(driver.status);
  const queryClient = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === 'active') {
        updates.is_active = true;
      } else {
        updates.is_active = false;
        updates.is_online = false;
        updates.availability = 'offline';
      }

      const { error } = await supabase
        .from('couriers')
        .update(updates)
        .eq('id', driver.id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success(`Status updated to ${selected}`);
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error('Status update failed', error);
      toast.error('Failed to update status');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[280px] border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-foreground">
            Change Status
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 py-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                selected === opt.value
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <div
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                  selected === opt.value
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-muted-foreground'
                }`}
              >
                {selected === opt.value && (
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </div>
              <div>
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected === driver.status || updateStatus.isPending}
            onClick={() => updateStatus.mutate(selected)}
            className="h-7 bg-emerald-500 text-xs text-white hover:bg-emerald-600"
          >
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
