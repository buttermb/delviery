/**
 * Beta Banner Component
 * Non-intrusive banner to indicate beta preview status
 */

import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import X from "lucide-react/dist/esm/icons/x";
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { STORAGE_KEYS } from '@/constants/storageKeys';

export function BetaBanner() {
  const [dismissed, setDismissed] = useLocalStorage<boolean>(
    STORAGE_KEYS.BETA_BANNER_DISMISSED,
    false
  );
  const [isVisible, setIsVisible] = useState(!dismissed);

  if (!isVisible) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setIsVisible(false);
  };

  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-sm text-amber-800 dark:text-amber-200">
          ⚠️ <strong>Beta Preview</strong> – Features may update frequently during testing.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="ml-4 h-6 w-6 p-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          aria-label="Dismiss beta banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}

