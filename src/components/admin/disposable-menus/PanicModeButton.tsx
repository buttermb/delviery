import { logger } from '@/lib/logger';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export const PanicModeButton = () => {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handlePanicMode = async () => {
    if (confirmText !== 'PANIC') {
      toast.error('Please type PANIC to confirm');
      return;
    }

    setLoading(true);

    try {
      // 1. Get all active menus
      const { data: activeMenus, error: fetchError } = await supabase
        .from('disposable_menus')
        .select('id, name')
        .eq('status', 'active');

      if (fetchError) throw fetchError;

      // 2. Burn all active menus
      const { error: burnError } = await supabase
        .from('disposable_menus')
        .update({
          status: 'hard_burned',
          burned_at: new Date().toISOString(),
        })
        .eq('status', 'active');

      if (burnError) throw burnError;

      // 3. Revoke all whitelist access
      const { error: revokeError } = await supabase
        .from('menu_access_whitelist')
        .update({ status: 'revoked' })
        .eq('status', 'active');

      if (revokeError) throw revokeError;

      // 4. Log panic event
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from('menu_panic_events').insert({
        triggered_by: userData.user?.id,
        triggered_at: new Date().toISOString(),
        affected_menus: activeMenus?.map(m => ({ id: m.id, name: m.name })),
        reason: reason || 'Emergency panic mode activated',
        actions_taken: {
          menus_burned: activeMenus?.length ?? 0,
          whitelist_revoked: true,
          timestamp: new Date().toISOString(),
        },
        notifications_sent: {
          admin: true,
          customers: false, // Can be enhanced to send SMS
        },
      });

      toast.success(
        `Panic Mode Activated - ${activeMenus?.length ?? 0} menus burned`,
        {
          description: 'All active menus have been disabled and access revoked.',
          duration: 5000,
        }
      );

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: queryKeys.disposableMenus.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.menuSecurityEvents.all });

      setOpen(false);
      setConfirmText('');
      setReason('');
    } catch (error) {
      logger.error('Panic mode error:', error);
      toast.error('Failed to activate panic mode', { description: humanizeError(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="gap-2 whitespace-nowrap"
      >
        <AlertTriangle className="h-4 w-4" />
        PANIC MODE
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              EMERGENCY PANIC MODE
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold">This will immediately:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Burn ALL active menus (cannot be undone)</li>
                <li>Revoke ALL customer access instantly</li>
                <li>Invalidate ALL menu links permanently</li>
                <li>Log security event for investigation</li>
              </ul>
              <p className="text-destructive font-semibold mt-4">
                This action is IMMEDIATE and IRREVERSIBLE
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="LEO investigation, major security breach, etc."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Type "PANIC" to confirm:</Label>
              <Input
                id="confirm"
                placeholder="PANIC"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePanicMode}
              disabled={confirmText !== 'PANIC' || loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating...
                </>
              ) : (
                'ACTIVATE PANIC MODE'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};