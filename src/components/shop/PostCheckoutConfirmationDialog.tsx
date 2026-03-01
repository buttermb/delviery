/**
 * Post-Checkout Confirmation Dialog
 * Immediate modal shown after successful order placement, before navigating to the full confirmation page.
 * Displays order confirmed message, tenant contact link, and View Order Details button.
 * Auto-closes after 10 seconds.
 */

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, MessageCircle, ExternalLink } from 'lucide-react';

interface PostCheckoutConfirmationDialogProps {
  open: boolean;
  orderNumber: string;
  telegramLink?: string | null;
  storePrimaryColor: string;
  storeName: string;
  onViewOrderDetails: () => void;
}

const AUTO_CLOSE_SECONDS = 10;

export function PostCheckoutConfirmationDialog({
  open,
  orderNumber,
  telegramLink,
  storePrimaryColor,
  storeName,
  onViewOrderDetails,
}: PostCheckoutConfirmationDialogProps) {
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);

  const handleClose = useCallback(() => {
    onViewOrderDetails();
  }, [onViewOrderDetails]);

  // Countdown timer — auto-navigate after 10 seconds
  useEffect(() => {
    if (!open) {
      setCountdown(AUTO_CLOSE_SECONDS);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-sm sm:max-w-md text-center">
        <div className="flex flex-col items-center gap-4 pt-2">
          {/* Success icon */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${storePrimaryColor}20` }}
          >
            <CheckCircle
              className="w-10 h-10"
              style={{ color: storePrimaryColor }}
            />
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold text-center">
            Order Confirmed!
          </DialogTitle>

          <DialogDescription className="text-sm sm:text-base text-muted-foreground text-center">
            Thanks for your order{storeName ? ` from ${storeName}` : ''}!
            <br />
            Order <strong className="text-foreground">#{orderNumber}</strong> has been placed.
          </DialogDescription>

          {/* Tenant contact link */}
          {telegramLink && (
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button
                className="w-full h-12 text-base font-semibold gap-2"
                style={{ backgroundColor: storePrimaryColor }}
              >
                <MessageCircle className="w-5 h-5" />
                Chat with us on Telegram
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          )}

          {/* View Order Details button */}
          <Button
            variant={telegramLink ? 'outline' : 'default'}
            className="w-full h-11 text-sm font-medium"
            style={!telegramLink ? { backgroundColor: storePrimaryColor } : undefined}
            onClick={handleClose}
          >
            View Order Details
          </Button>

          {/* Auto-close countdown */}
          <p className="text-xs text-muted-foreground">
            Redirecting to order details in {countdown}s
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
