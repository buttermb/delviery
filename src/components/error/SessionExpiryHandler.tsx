import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function SessionExpiryHandler() {
  const [showExpiryDialog, setShowExpiryDialog] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        logger.info('[SessionExpiry] Session token refreshed');
        setShowExpiryDialog(false);
        setCountdown(60);
      }

      if (event === 'SIGNED_OUT') {
        logger.warn('[SessionExpiry] User signed out');
        setShowExpiryDialog(false);
        navigate('/login');
      }

      if (event === 'USER_UPDATED' && !session) {
        logger.warn('[SessionExpiry] Session expired');
        setShowExpiryDialog(true);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (!showExpiryDialog) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showExpiryDialog]);

  const handleRefresh = async () => {
    logger.info('[SessionExpiry] Attempting to refresh session');

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('[SessionExpiry] Failed to refresh session', { error });
        handleLogout();
        return;
      }

      if (data.session) {
        logger.info('[SessionExpiry] Session refreshed successfully');
        setShowExpiryDialog(false);
        setCountdown(60);
      } else {
        logger.warn('[SessionExpiry] No session after refresh');
        handleLogout();
      }
    } catch (error) {
      logger.error('[SessionExpiry] Error refreshing session', { error });
      handleLogout();
    }
  };

  const handleLogout = async () => {
    logger.info('[SessionExpiry] Logging out user');
    setShowExpiryDialog(false);

    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      logger.error('[SessionExpiry] Error signing out', { error });
      navigate('/login');
    }
  };

  return (
    <Dialog open={showExpiryDialog} onOpenChange={setShowExpiryDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
          <DialogDescription>
            Your session has expired. You can refresh your session to continue or log out.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Automatically logging out in{' '}
              <span className="font-semibold text-gray-900">{countdown}</span> seconds
            </p>
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
          <Button
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
