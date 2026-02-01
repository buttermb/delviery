import { useEffect } from 'react';
import { toast } from 'sonner';

interface CourierKeyboardShortcutsProps {
  onAcceptOrder?: () => void;
  onRejectOrder?: () => void;
  onToggleOnline?: () => void;
  onViewEarnings?: () => void;
  onNavigate?: () => void;
  hasActiveOrder: boolean;
  hasPendingOrder: boolean;
}

export const useCourierKeyboardShortcuts = ({
  onAcceptOrder,
  onRejectOrder,
  onToggleOnline,
  onViewEarnings,
  onNavigate,
  hasActiveOrder,
  hasPendingOrder
}: CourierKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if ((e.target as HTMLElement).tagName === 'INPUT' || 
          (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // A key - Accept order
      if (e.key === 'a' && hasPendingOrder && onAcceptOrder) {
        e.preventDefault();
        onAcceptOrder();
        toast.success('Order accepted via keyboard shortcut');
      }

      // R key - Reject order
      if (e.key === 'r' && hasPendingOrder && onRejectOrder) {
        e.preventDefault();
        onRejectOrder();
        toast.info('Order rejected');
      }

      // N key - Navigate
      if (e.key === 'n' && hasActiveOrder && onNavigate) {
        e.preventDefault();
        onNavigate();
      }

      // E key - View earnings
      if (e.key === 'e' && onViewEarnings) {
        e.preventDefault();
        onViewEarnings();
      }

      // O key - Toggle online status
      if (e.key === 'o' && onToggleOnline) {
        e.preventDefault();
        onToggleOnline();
      }

      // ? key - Show shortcuts
      if (e.key === '?') {
        e.preventDefault();
        toast.info('Shortcuts: A=Accept, R=Reject, N=Navigate, E=Earnings, O=Online', {
          duration: 5000
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [hasActiveOrder, hasPendingOrder, onAcceptOrder, onRejectOrder, onToggleOnline, onViewEarnings, onNavigate]);
};

export default function CourierKeyboardShortcuts(props: CourierKeyboardShortcutsProps) {
  useCourierKeyboardShortcuts(props);
  return null;
}