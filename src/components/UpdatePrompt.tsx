import { useEffect, useState } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
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
import { ArrowUpCircle } from 'lucide-react';

export function UpdatePrompt() {
  const { hasUpdate, updateVersion, dismissUpdate } = useVersionCheck();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (hasUpdate) {
      // Small delay to avoid showing immediately on load
      const timer = setTimeout(() => setShowPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasUpdate]);

  const handleUpdate = () => {
    setShowPrompt(false);
    updateVersion();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    dismissUpdate();
  };

  if (!hasUpdate || !showPrompt) return null;

  return (
    <AlertDialog open={showPrompt} onOpenChange={setShowPrompt}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <ArrowUpCircle className="h-6 w-6 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">Update Available</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base space-y-2">
            <p>A new version of the app is available with improvements and bug fixes.</p>
            <p className="text-sm text-muted-foreground">
              Please refresh to get the latest version.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDismiss}>
            Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdate} className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Update Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
