import { useNavigate } from 'react-router-dom';
import { Eye, UserPlus, CheckCircle, Truck, FileText } from 'lucide-react';

import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';

import type { NotificationWithActions } from '@/types/notifications/notification';

interface NotificationActionButtonsProps {
  notification: NotificationWithActions;
  onAction?: () => void;
}

export function NotificationActionButtons({ notification, onAction }: NotificationActionButtonsProps) {
  const { tenantSlug } = useTenantContext();
  const navigate = useNavigate();

  const handleAction = (path: string) => {
    logger.info('[NotificationActions] Action clicked', {
      notificationId: notification.id,
      actionType: notification.actionType,
      path,
    });

    navigate(path);
    onAction?.();
  };

  if (!notification.actionType || !notification.actionData) {
    return null;
  }

  switch (notification.actionType) {
    case 'view_order': {
      const orderId = notification.actionData.orderId as string;
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction(`/${tenantSlug}/admin/orders/${orderId}`)}
          className="gap-2"
        >
          <Eye className="h-3 w-3" />
          View Order
        </Button>
      );
    }

    case 'assign_driver': {
      const deliveryId = notification.actionData.deliveryId as string;
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction(`/${tenantSlug}/admin/deliveries/${deliveryId}`)}
          className="gap-2"
        >
          <UserPlus className="h-3 w-3" />
          Assign Driver
        </Button>
      );
    }

    case 'approve': {
      const itemId = notification.actionData.itemId as string;
      const itemType = notification.actionData.itemType as string;
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction(`/${tenantSlug}/admin/${itemType}/${itemId}`)}
          className="gap-2"
        >
          <CheckCircle className="h-3 w-3" />
          Approve
        </Button>
      );
    }

    case 'view_delivery': {
      const deliveryId = notification.actionData.deliveryId as string;
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction(`/${tenantSlug}/admin/deliveries/${deliveryId}`)}
          className="gap-2"
        >
          <Truck className="h-3 w-3" />
          View Delivery
        </Button>
      );
    }

    case 'view_invoice': {
      const invoiceId = notification.actionData.invoiceId as string;
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAction(`/${tenantSlug}/admin/invoices/${invoiceId}`)}
          className="gap-2"
        >
          <FileText className="h-3 w-3" />
          View Invoice
        </Button>
      );
    }

    default:
      return null;
  }
}
