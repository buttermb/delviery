import { toast } from 'sonner';

// Standardized toast notifications for consistent UX

export const showSuccessToast = (message: string, description?: string) => {
  toast.success(message, {
    description,
    duration: 3000,
  });
};

export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, {
    description,
    duration: 4000,
  });
};

export const showInfoToast = (message: string, description?: string) => {
  toast.info(message, {
    description,
    duration: 3000,
  });
};

export const showLoadingToast = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};

// Specific use-case toasts
export const showOrderSuccessToast = (orderNumber: string) => {
  showSuccessToast(
    'Order Placed Successfully!',
    `Order #${orderNumber} is being prepared for delivery`
  );
};

export const showAddToCartToast = (productName: string) => {
  showSuccessToast(
    'Added to Cart',
    `${productName} has been added to your cart`
  );
};

export const showGiveawayEntryToast = (entryCount: number) => {
  showSuccessToast(
    'Entry Submitted!',
    `You now have ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} in the giveaway`
  );
};

export const showCourierOnlineToast = () => {
  showSuccessToast(
    'You\'re Online',
    'You\'ll receive new order notifications'
  );
};

export const showCourierOfflineToast = () => {
  showInfoToast(
    'You\'re Offline',
    'You won\'t receive new orders until you go online'
  );
};

export const showDeliveryCompletedToast = (earnings: number) => {
  showSuccessToast(
    '🎉 Delivery Completed!',
    `You earned $${earnings.toFixed(2)}`
  );
};
