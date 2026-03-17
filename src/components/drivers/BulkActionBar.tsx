import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  tenantId: string;
  onClear: () => void;
}

export function BulkActionBar({ selectedCount, selectedIds, tenantId, onClear }: BulkActionBarProps) {
  const queryClient = useQueryClient();
  const ids = Array.from(selectedIds);

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ status, isActive }: { status: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('couriers')
        .update({ status, is_active: isActive })
        .in('id', ids)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.couriersAdmin.byTenant(tenantId) });
      toast.success(`${selectedCount} driver${selectedCount > 1 ? 's' : ''} updated to ${status}`);
      onClear();
    },
    onError: (error) => {
      logger.error('Bulk status update failed', error);
      toast.error('Failed to update drivers');
    },
  });

  return (
    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5">
      <span className="text-sm font-medium text-emerald-500">
        {selectedCount} driver{selectedCount > 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkUpdateStatus.mutate({ status: 'active', isActive: true })}
          disabled={bulkUpdateStatus.isPending}
          className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Activate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkUpdateStatus.mutate({ status: 'inactive', isActive: false })}
          disabled={bulkUpdateStatus.isPending}
          className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Deactivate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="h-7 border-border bg-transparent text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
