import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import Mail from "lucide-react/dist/esm/icons/mail";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderEmailButtonProps {
  orderId: string;
  orderNumber: string;
  customerEmail: string | null;
  customerName: string | null;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  storeName: string;
  trackingUrl?: string;
  loyaltyPointsEarned?: number;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function OrderEmailButton({
  orderId,
  orderNumber,
  customerEmail,
  customerName,
  items,
  subtotal,
  deliveryFee,
  total,
  storeName,
  trackingUrl,
  loyaltyPointsEarned,
  variant = 'outline',
  size = 'default',
  className,
  showLabel = true,
}: OrderEmailButtonProps) {
  const [isSending, setIsSending] = useState(false);

  const handleSendEmail = useCallback(async () => {
    if (!customerEmail) {
      showErrorToast('Cannot send email', 'Customer email address is required');
      return;
    }

    try {
      setIsSending(true);

      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: {
          order_id: orderId,
          customer_email: customerEmail,
          customer_name: customerName || 'Valued Customer',
          order_number: orderNumber,
          items,
          subtotal,
          delivery_fee: deliveryFee,
          total,
          store_name: storeName,
          tracking_url: trackingUrl,
          loyalty_points_earned: loyaltyPointsEarned,
        },
      });

      if (error) {
        logger.error('Failed to send order confirmation email', error, {
          component: 'OrderEmailButton',
          orderId,
        });
        showErrorToast('Failed to send email', error.message || 'Please try again later');
        return;
      }

      if (data && typeof data === 'object' && 'error' in data) {
        showErrorToast('Failed to send email', (data.error as string) || 'An error occurred');
        return;
      }

      showSuccessToast(
        'Email sent successfully',
        `Confirmation receipt sent to ${customerEmail}`
      );
    } catch (err) {
      logger.error('Error sending order confirmation email', err, {
        component: 'OrderEmailButton',
        orderId,
      });
      showErrorToast('Failed to send email', 'An unexpected error occurred');
    } finally {
      setIsSending(false);
    }
  }, [
    orderId,
    orderNumber,
    customerEmail,
    customerName,
    items,
    subtotal,
    deliveryFee,
    total,
    storeName,
    trackingUrl,
    loyaltyPointsEarned,
  ]);

  const isDisabled = isSending || !customerEmail;

  if (size === 'icon') {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleSendEmail}
        disabled={isDisabled}
        className={className}
        title={customerEmail ? 'Send confirmation email' : 'No email address available'}
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSendEmail}
      disabled={isDisabled}
      className={className}
    >
      {isSending ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {showLabel && 'Sending...'}
        </>
      ) : (
        <>
          <Mail className="h-4 w-4 mr-2" />
          {showLabel && 'Send Receipt'}
        </>
      )}
    </Button>
  );
}
