/**
 * OrderHoldButton - Button to pause/resume order processing
 *
 * Features:
 * - Toggle between Hold and Resume actions based on current order status
 * - Requires a reason when placing an order on hold
 * - Shows hold information when order is on hold
 * - Supports both button and icon-only variants
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, PauseCircle, PlayCircle, AlertCircle } from 'lucide-react';
import { useOrderHold } from '@/hooks/useOrderHold';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export interface OrderHoldButtonProps {
  orderId: string;
  orderNumber?: string;
  currentStatus: string;
  tenantId: string;
  /** Optional metadata containing hold information */
  metadata?: {
    hold_reason?: string;
    held_at?: string;
    previous_status?: string;
  } | null;
  /** Display variant */
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  /** Size of the button */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Additional class names */
  className?: string;
  /** Callback when hold/resume action completes */
  onComplete?: () => void;
  /** Whether to show both hold and resume options */
  showResumeWhenOnHold?: boolean;
}

const COMMON_HOLD_REASONS = [
  'Pending customer verification',
  'Payment issue - awaiting resolution',
  'Out of stock - awaiting restock',
  'Customer requested delay',
  'Compliance review required',
  'Address verification needed',
  'Other',
];

export function OrderHoldButton({
  orderId,
  orderNumber,
  currentStatus,
  tenantId,
  metadata,
  variant = 'outline',
  size = 'default',
  className,
  onComplete,
  showResumeWhenOnHold = true,
}: OrderHoldButtonProps) {
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false);
  const [isResumeDialogOpen, setIsResumeDialogOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [selectedPresetReason, setSelectedPresetReason] = useState<string | null>(null);

  const { holdOrder, resumeOrder, isHolding, isResuming, isProcessing } = useOrderHold();

  const isOnHold = currentStatus === 'on_hold';
  const displayOrderNumber = orderNumber || orderId.slice(0, 8);

  const handleHold = () => {
    const reason = selectedPresetReason === 'Other' ? holdReason : (selectedPresetReason || holdReason);

    if (!reason.trim()) {
      return;
    }

    holdOrder(
      {
        orderId,
        reason: reason.trim(),
        tenantId,
        previousStatus: currentStatus,
      },
      {
        onSuccess: () => {
          setIsHoldDialogOpen(false);
          setHoldReason('');
          setSelectedPresetReason(null);
          onComplete?.();
        },
      }
    );
  };

  const handleResume = () => {
    resumeOrder(
      {
        orderId,
        tenantId,
      },
      {
        onSuccess: () => {
          setIsResumeDialogOpen(false);
          onComplete?.();
        },
      }
    );
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedPresetReason(preset);
    if (preset !== 'Other') {
      setHoldReason(preset);
    } else {
      setHoldReason('');
    }
  };

  const isReasonValid = selectedPresetReason === 'Other'
    ? holdReason.trim().length > 0
    : selectedPresetReason !== null;

  // Render Resume button when on hold
  if (isOnHold && showResumeWhenOnHold) {
    return (
      <AlertDialog open={isResumeDialogOpen} onOpenChange={setIsResumeDialogOpen}>
        <Button
          variant={variant === 'icon' ? 'ghost' : variant}
          size={size}
          className={cn(
            'text-green-600 hover:text-green-700 hover:bg-green-50',
            className
          )}
          onClick={() => setIsResumeDialogOpen(true)}
          disabled={isProcessing}
        >
          {isResuming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {variant !== 'icon' && size !== 'icon' && (
            <span className="ml-2">Resume</span>
          )}
        </Button>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-green-600" />
              Resume Order Processing
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to resume processing for order{' '}
                  <strong>#{displayOrderNumber}</strong>?
                </p>

                {metadata?.hold_reason && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Hold Information
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Reason:</span>{' '}
                      {metadata.hold_reason}
                    </p>
                    {metadata.held_at && (
                      <p className="text-sm text-muted-foreground">
                        On hold since{' '}
                        {formatDistanceToNow(new Date(metadata.held_at), {
                          addSuffix: true,
                        })}
                      </p>
                    )}
                    {metadata.previous_status && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Will resume to:</span>{' '}
                        <Badge variant="outline" className="ml-1">
                          {metadata.previous_status}
                        </Badge>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsResumeDialogOpen(false)}
              disabled={isResuming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResume}
              disabled={isResuming}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResuming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resuming...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Resume Order
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Render Hold button for non-hold statuses
  return (
    <Dialog open={isHoldDialogOpen} onOpenChange={setIsHoldDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant === 'icon' ? 'ghost' : variant}
          size={size}
          className={cn(
            'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
            className
          )}
          disabled={isProcessing || currentStatus === 'cancelled' || currentStatus === 'completed' || currentStatus === 'delivered'}
        >
          {isHolding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PauseCircle className="h-4 w-4" />
          )}
          {variant !== 'icon' && size !== 'icon' && (
            <span className="ml-2">Hold</span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-600" />
            Place Order On Hold
          </DialogTitle>
          <DialogDescription>
            Pausing order <strong>#{displayOrderNumber}</strong> will temporarily stop
            all processing. Please provide a reason for the hold.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Current Status:</span>
            <Badge variant="secondary">{currentStatus}</Badge>
          </div>

          {/* Preset Reasons */}
          <div className="space-y-2">
            <Label>Select a reason</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_HOLD_REASONS.map((preset) => (
                <Badge
                  key={preset}
                  variant={selectedPresetReason === preset ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedPresetReason === preset
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'hover:bg-amber-50'
                  )}
                  onClick={() => handlePresetSelect(preset)}
                >
                  {preset}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom Reason Textarea */}
          {selectedPresetReason === 'Other' && (
            <div className="space-y-2">
              <Label htmlFor="hold-reason">
                Specify reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="hold-reason"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="Enter the reason for placing this order on hold..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}

          {/* Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Orders on hold will not be processed until resumed. The customer
                will not be notified automatically.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsHoldDialogOpen(false);
              setHoldReason('');
              setSelectedPresetReason(null);
            }}
            disabled={isHolding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleHold}
            disabled={isHolding || !isReasonValid}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isHolding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Holding...
              </>
            ) : (
              <>
                <PauseCircle className="mr-2 h-4 w-4" />
                Place On Hold
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact version of OrderHoldButton for use in tables and context menus
 */
export function OrderHoldAction({
  orderId,
  orderNumber,
  currentStatus,
  tenantId,
  metadata,
  onComplete,
}: Omit<OrderHoldButtonProps, 'variant' | 'size' | 'className' | 'showResumeWhenOnHold'>) {
  return (
    <OrderHoldButton
      orderId={orderId}
      orderNumber={orderNumber}
      currentStatus={currentStatus}
      tenantId={tenantId}
      metadata={metadata}
      variant="ghost"
      size="sm"
      onComplete={onComplete}
      showResumeWhenOnHold={true}
    />
  );
}
