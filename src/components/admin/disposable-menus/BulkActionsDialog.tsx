import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

interface BulkActionsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMenuIds: string[];
  onComplete: () => void;
}

export function BulkActionsDialog({
  open,
  onClose,
  selectedMenuIds,
  onComplete,
}: BulkActionsDialogProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'activate' | 'deactivate' | 'delete'>('activate');
  const [loading, setLoading] = useState(false);

  const handleBulkAction = async () => {
    if (selectedMenuIds.length === 0) return;

    setLoading(true);
    try {
      let error;

      switch (action) {
        case 'activate':
          ({ error } = await supabase
            .from('disposable_menus')
            .update({ status: 'active' })
            .in('id', selectedMenuIds));
          break;

        case 'deactivate':
          ({ error } = await supabase
            .from('disposable_menus')
            .update({ status: 'soft_burned' })
            .in('id', selectedMenuIds));
          break;

        case 'delete':
          // Delete related records first
          await supabase
            .from('menu_access_whitelist')
            .delete()
            .in('menu_id', selectedMenuIds);

          await supabase
            .from('menu_orders')
            .delete()
            .in('menu_id', selectedMenuIds);

          ({ error } = await supabase
            .from('disposable_menus')
            .delete()
            .in('id', selectedMenuIds));
          break;
      }

      if (error) throw error;

      toast.success(`Successfully ${action === 'activate' ? 'activated' : action === 'deactivate' ? 'deactivated' : 'deleted'} ${selectedMenuIds.length} menu(s)`);

      queryClient.invalidateQueries({ queryKey: queryKeys.menus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      onComplete();
      onClose();
    } catch (error: unknown) {
      logger.error('Bulk action error', error, { component: 'BulkActionsDialog' });
      toast.error(humanizeError(error, 'Failed to perform bulk action'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Actions</DialogTitle>
          <DialogDescription>
            Perform actions on {selectedMenuIds.length} selected menu(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <Label>Select Action</Label>
            <RadioGroup value={action} onValueChange={(v) => setAction(v as 'activate' | 'deactivate' | 'delete')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="activate" id="activate" />
                <Label htmlFor="activate" className="font-normal">
                  Activate selected menus
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deactivate" id="deactivate" />
                <Label htmlFor="deactivate" className="font-normal">
                  Deactivate selected menus
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete" />
                <Label htmlFor="delete" className="font-normal text-destructive">
                  Delete selected menus (permanent)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {action === 'delete' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. All menu data, orders, and access logs will be permanently deleted.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAction}
            disabled={loading || selectedMenuIds.length === 0}
            variant={action === 'delete' ? 'destructive' : 'default'}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `${action === 'activate' ? 'Activate' : action === 'deactivate' ? 'Deactivate' : 'Delete'} ${selectedMenuIds.length} Menu(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
