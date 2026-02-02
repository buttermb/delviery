import React from 'react';
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import XCircle from "lucide-react/dist/esm/icons/x-circle";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import Download from "lucide-react/dist/esm/icons/download";
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FailedItem {
  id: string;
  name: string;
  error: string;
}

interface BulkOperationProgressProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Title of the operation */
  title: string;
  /** Description of what's happening */
  description?: string;
  /** Total items to process */
  total: number;
  /** Number of items completed */
  completed: number;
  /** Number of items that succeeded */
  succeeded: number;
  /** Number of items that failed */
  failed: number;
  /** List of failed items with errors */
  failedItems?: FailedItem[];
  /** Whether the operation is still running */
  isRunning: boolean;
  /** Whether the operation is complete */
  isComplete: boolean;
  /** Callback to retry failed items */
  onRetryFailed?: () => void;
  /** Callback to export failed items list */
  onExportFailed?: () => void;
  /** Callback to run in background */
  onRunInBackground?: () => void;
  /** Callback to cancel */
  onCancel?: () => void;
}

export function BulkOperationProgress({
  open,
  onOpenChange,
  title,
  description,
  total,
  completed,
  succeeded,
  failed,
  failedItems = [],
  isRunning,
  isComplete,
  onRetryFailed,
  onExportFailed,
  onRunInBackground,
  onCancel,
}: BulkOperationProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const getStatusIcon = () => {
    if (isRunning) return <RefreshCw className="h-5 w-5 animate-spin text-primary" />;
    if (failed > 0 && succeeded > 0) return <AlertCircle className="h-5 w-5 text-amber-500" />;
    if (failed > 0 && succeeded === 0) return <XCircle className="h-5 w-5 text-destructive" />;
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (isRunning) return `Processing ${completed} of ${total}...`;
    if (failed > 0 && succeeded > 0) return 'Completed with some errors';
    if (failed > 0 && succeeded === 0) return 'Operation failed';
    return 'Completed successfully';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{getStatusText()}</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>

          {/* Summary stats */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{succeeded} succeeded</span>
            </div>
            {failed > 0 && (
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-destructive" />
                <span>{failed} failed</span>
              </div>
            )}
          </div>

          {/* Failed items list */}
          {isComplete && failedItems.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-destructive/10 px-3 py-2 border-b border-border">
                <span className="text-sm font-medium text-destructive">
                  Failed Items ({failedItems.length})
                </span>
              </div>
              <ScrollArea className="max-h-40">
                <div className="divide-y divide-border">
                  {failedItems.map((item) => (
                    <div key={item.id} className="px-3 py-2 text-sm">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-muted-foreground text-xs truncate">
                        {item.error}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isRunning && (
            <>
              {onRunInBackground && (
                <Button variant="outline" onClick={onRunInBackground}>
                  Run in Background
                </Button>
              )}
              {onCancel && (
                <Button variant="destructive" onClick={onCancel}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </>
          )}

          {isComplete && (
            <>
              {failedItems.length > 0 && onRetryFailed && (
                <Button variant="outline" onClick={onRetryFailed}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Retry Failed
                </Button>
              )}
              {failedItems.length > 0 && onExportFailed && (
                <Button variant="outline" onClick={onExportFailed}>
                  <Download className="h-4 w-4 mr-1" />
                  Export Failed
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage bulk operation state
 */
interface UseBulkOperationOptions<T, R> {
  items: T[];
  operation: (item: T) => Promise<R>;
  getItemId: (item: T) => string;
  getItemName: (item: T) => string;
  onComplete?: (results: { succeeded: R[]; failed: FailedItem[] }) => void;
}

export function useBulkOperation<T, R>({
  items,
  operation,
  getItemId,
  getItemName,
  onComplete,
}: UseBulkOperationOptions<T, R>) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [isComplete, setIsComplete] = React.useState(false);
  const [completed, setCompleted] = React.useState(0);
  const [succeeded, setSucceeded] = React.useState(0);
  const [failed, setFailed] = React.useState(0);
  const [failedItems, setFailedItems] = React.useState<FailedItem[]>([]);
  const [succeededResults, setSucceededResults] = React.useState<R[]>([]);
  
  const abortRef = React.useRef(false);

  const reset = React.useCallback(() => {
    setIsRunning(false);
    setIsComplete(false);
    setCompleted(0);
    setSucceeded(0);
    setFailed(0);
    setFailedItems([]);
    setSucceededResults([]);
    abortRef.current = false;
  }, []);

  const start = React.useCallback(async () => {
    reset();
    setIsRunning(true);
    abortRef.current = false;

    const results: R[] = [];
    const failures: FailedItem[] = [];

    for (let i = 0; i < items.length; i++) {
      if (abortRef.current) break;

      const item = items[i];
      try {
        const result = await operation(item);
        results.push(result);
        setSucceeded((prev) => prev + 1);
        setSucceededResults([...results]);
      } catch (error) {
        const failedItem: FailedItem = {
          id: getItemId(item),
          name: getItemName(item),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        failures.push(failedItem);
        setFailed((prev) => prev + 1);
        setFailedItems([...failures]);
      }

      setCompleted((prev) => prev + 1);
    }

    setIsRunning(false);
    setIsComplete(true);
    onComplete?.({ succeeded: results, failed: failures });
  }, [items, operation, getItemId, getItemName, onComplete, reset]);

  const cancel = React.useCallback(() => {
    abortRef.current = true;
  }, []);

  const retryFailed = React.useCallback(async () => {
    // This would need the failed items to be retried
    // Implementation depends on how items are stored
  }, []);

  return {
    isRunning,
    isComplete,
    total: items.length,
    completed,
    succeeded,
    failed,
    failedItems,
    succeededResults,
    start,
    cancel,
    reset,
    retryFailed,
  };
}
