import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export interface ProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Current progress (0-100) or undefined for indeterminate */
  progress?: number;
  /** Status message */
  message?: string;
  /** Current item count */
  current?: number;
  /** Total item count */
  total?: number;
  /** Current status */
  status: 'idle' | 'processing' | 'complete' | 'error' | 'cancelled';
  /** Error message if status is 'error' */
  error?: string;
  /** Whether the operation can be cancelled */
  cancellable?: boolean;
  /** Cancel handler */
  onCancel?: () => void;
  /** Retry handler (shown on error) */
  onRetry?: () => void;
  /** Close handler (shown on complete) */
  onClose?: () => void;
}

/**
 * Progress dialog for long-running operations
 * Shows progress bar, status messages, and allows cancellation
 */
export function ProgressDialog({
  open,
  onOpenChange,
  title,
  description,
  progress,
  message,
  current,
  total,
  status,
  error,
  cancellable = true,
  onCancel,
  onRetry,
  onClose,
}: ProgressDialogProps) {
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isCancelled = status === 'cancelled';
  const isProcessing = status === 'processing';

  // Prevent closing during processing unless cancellable
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen && isProcessing && !cancellable) {
        return; // Prevent close during processing
      }
      if (!newOpen && isProcessing && cancellable) {
        onCancel?.();
        return;
      }
      onOpenChange(newOpen);
    },
    [isProcessing, cancellable, onCancel, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (isProcessing) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isProcessing && !cancellable) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon status={status} />
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4 space-y-4" aria-live="polite" aria-atomic="true">
          {/* Progress bar */}
          {isProcessing && (
            <div className="space-y-2" role="status">
              {progress !== undefined ? (
                <Progress value={progress} className="h-2" />
              ) : (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-full" />
                </div>
              )}

              {/* Progress text */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{message || 'Processing...'}</span>
                {total !== undefined && current !== undefined && (
                  <span>
                    {current} / {total}
                  </span>
                )}
                {progress !== undefined && total === undefined && (
                  <span>{Math.round(progress)}%</span>
                )}
              </div>
            </div>
          )}

          {/* Complete message */}
          {isComplete && (
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-400" role="status">
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
              <span>{message || 'Operation completed successfully'}</span>
            </div>
          )}

          {/* Error message */}
          {isError && (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg text-destructive" role="alert">
              <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Operation failed</p>
                {error && <p className="text-sm opacity-90">{error}</p>}
              </div>
            </div>
          )}

          {/* Cancelled message */}
          {isCancelled && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-700 dark:text-amber-400" role="status">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>
                {message ||
                  (current && total
                    ? `Cancelled after ${current} of ${total} items`
                    : 'Operation cancelled')}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* Processing state - show cancel */}
          {isProcessing && cancellable && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}

          {/* Error state - show retry and close */}
          {isError && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {onRetry && <Button onClick={onRetry}>Retry</Button>}
            </>
          )}

          {/* Complete or cancelled - show close */}
          {(isComplete || isCancelled) && (
            <Button
              onClick={() => {
                onClose?.();
                onOpenChange(false);
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({ status }: { status: ProgressDialogProps['status'] }) {
  switch (status) {
    case 'processing':
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case 'complete':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-destructive" />;
    case 'cancelled':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    default:
      return null;
  }
}

/**
 * Hook to manage progress dialog state
 */
export function useProgressDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    progress?: number;
    message?: string;
    current?: number;
    total?: number;
    status: ProgressDialogProps['status'];
    error?: string;
  }>({
    open: false,
    title: '',
    status: 'idle',
  });

  const start = useCallback(
    (options: { title: string; description?: string; total?: number }) => {
      setState({
        open: true,
        title: options.title,
        description: options.description,
        total: options.total,
        current: 0,
        progress: options.total ? 0 : undefined,
        status: 'processing',
        message: 'Starting...',
      });
    },
    []
  );

  const update = useCallback(
    (options: { current?: number; progress?: number; message?: string }) => {
      setState((prev) => ({
        ...prev,
        current: options.current ?? prev.current,
        progress:
          options.progress ??
          (options.current && prev.total
            ? (options.current / prev.total) * 100
            : prev.progress),
        message: options.message ?? prev.message,
      }));
    },
    []
  );

  const complete = useCallback((message?: string) => {
    setState((prev) => ({
      ...prev,
      status: 'complete',
      progress: 100,
      current: prev.total,
      message: message ?? 'Complete',
    }));
  }, []);

  const fail = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      error,
    }));
  }, []);

  const cancel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'cancelled',
    }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({
      ...prev,
      open: false,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      open: false,
      title: '',
      status: 'idle',
    });
  }, []);

  return {
    state,
    start,
    update,
    complete,
    fail,
    cancel,
    close,
    reset,
    // Convenience props for the component
    dialogProps: {
      ...state,
      onOpenChange: (open: boolean) => {
        if (!open) close();
      },
      onCancel: cancel,
    },
  };
}

export default ProgressDialog;
