import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Flame, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBurnMenu } from '@/hooks/useDisposableMenus';
import type { DisposableMenu } from '@/types/admin';

interface BurnMenuDialogProps {
  menu: DisposableMenu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BurnMenuDialog = ({ menu, open, onOpenChange }: BurnMenuDialogProps) => {
  const [burnType, setBurnType] = useState<'soft' | 'hard'>('hard');
  const [burnReason, setBurnReason] = useState('');
  const [autoRegenerate, setAutoRegenerate] = useState(false);
  const [migrateCustomers, setMigrateCustomers] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const burnMenu = useBurnMenu();

  const handleBurn = async () => {
    if (confirmText !== 'BURN') return;

    try {
      await burnMenu.mutateAsync({
        menu_id: menu.id,
        burn_type: burnType,
        burn_reason: burnReason,
        auto_regenerate: autoRegenerate,
        migrate_customers: migrateCustomers
      });

      // Reset and close
      setBurnReason('');
      setConfirmText('');
      setAutoRegenerate(false);
      setMigrateCustomers(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to burn menu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Flame className="h-5 w-5" />
            Burn Menu: {menu.name}
          </DialogTitle>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>WARNING:</strong> This action is IMMEDIATE and IRREVERSIBLE. All links will instantly become invalid.
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          {/* Burn Type */}
          <div className="space-y-3">
            <Label>Burn Type</Label>
            <RadioGroup value={burnType} onValueChange={(v) => setBurnType(v as 'soft' | 'hard')}>
              <div className="flex items-start space-x-2 rounded-lg border p-4">
                <RadioGroupItem value="soft" id="soft" />
                <div className="flex-1">
                  <Label htmlFor="soft" className="font-semibold cursor-pointer">
                    Soft Burn (Temporary)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Disable for 24-48 hours. Can reactivate later. Use if suspected leak.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 rounded-lg border p-4">
                <RadioGroupItem value="hard" id="hard" />
                <div className="flex-1">
                  <Label htmlFor="hard" className="font-semibold cursor-pointer">
                    Hard Burn (Permanent)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently destroy all access. Cannot be undone. Use if confirmed compromise.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Burn Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Burn (Required)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Suspected leak - URL seen on social media"
              value={burnReason}
              onChange={(e) => setBurnReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="regen"
                checked={autoRegenerate}
                onCheckedChange={(checked) => setAutoRegenerate(checked as boolean)}
              />
              <Label htmlFor="regen" className="cursor-pointer">
                Automatically generate new menu with same products
              </Label>
            </div>

            {autoRegenerate && (
              <div className="flex items-center space-x-2 ml-6">
                <Checkbox
                  id="migrate"
                  checked={migrateCustomers}
                  onCheckedChange={(checked) => setMigrateCustomers(checked as boolean)}
                />
                <Label htmlFor="migrate" className="cursor-pointer">
                  Re-invite whitelisted customers ({('menu_access_whitelist' in menu && Array.isArray(menu.menu_access_whitelist) && menu.menu_access_whitelist[0]?.count) || 0} customers)
                </Label>
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirm">Type "BURN" to confirm</Label>
            <Input
              id="confirm"
              placeholder="BURN"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBurn}
              disabled={!burnReason || confirmText !== 'BURN' || burnMenu.isPending}
            >
              {burnMenu.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Flame className="h-4 w-4 mr-2" />
              Burn Menu Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
