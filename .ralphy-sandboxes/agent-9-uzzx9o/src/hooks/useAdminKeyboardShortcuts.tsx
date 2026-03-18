import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCredits } from '@/hooks/useCredits';
import { Coins } from 'lucide-react';

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onCreate?: () => void;
  onEscape?: () => void;
  onSave?: () => void;
}

export const useAdminKeyboardShortcuts = (options: KeyboardShortcutsOptions = {}) => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Prefetch credits for the shortcut
  const { balance, isFreeTier } = useCredits();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Guard against undefined key (dead keys, IME events)
      if (!e.key) return;

      // Check if ? is pressed (for shortcuts help)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setShortcutsVisible(true);
        return;
      }

      // Escape key
      if (e.key === 'Escape') {
        if (options.onEscape) {
          options.onEscape();
        }
        return;
      }

      // Create action (c key) - only if not typing
      // But if Shift+C is pressed, show credits
      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {

        // Shift + C = Show Credits
        if (e.shiftKey) {
          e.preventDefault();
          if (isFreeTier) {
            toast.info('Credit Balance', {
              description: `You have ${balance.toLocaleString()} credits remaining.`,
              icon: <Coins className="h-4 w-4 text-emerald-500" />,
              duration: 2000,
            });
          } else {
            toast.info('Credit Balance', {
              description: 'You are on an unlimited plan.',
              icon: <Coins className="h-4 w-4 text-emerald-500" />,
              duration: 2000,
            });
          }
          return;
        }

        if (options.onCreate) {
          e.preventDefault();
          options.onCreate();
          return;
        }
      }

      // Save action (Cmd/Ctrl + S)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        if (options.onSave) {
          options.onSave();
        }
        return;
      }

      // Search action (Cmd/Ctrl + K)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (options.onSearch) {
          options.onSearch();
        } else {
          // Default behavior: open command palette if no specific search handler
          setCommandPaletteOpen(true);
        }
        return;
      }

      // Check if Cmd/Ctrl + Shift is pressed
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();

        const getPath = (path: string) => {
          if (!tenantSlug) return path;
          return path.startsWith('/admin') ? `/${tenantSlug}${path}` : path;
        };

        switch (e.key.toLowerCase()) {
          case 'd':
            // Navigate to current tenant's dashboard
            navigate(getPath('/admin/dashboard'));
            toast.success('Dashboard');
            break;
          case 'n':
            // Create new order
            navigate(getPath('/admin/orders'));
            toast.success('Orders');
            break;
          case 'm':
            // Navigate to menus
            navigate(getPath('/admin/disposable-menus'));
            toast.success('Menus');
            break;
          case 'i':
            // Navigate to inventory
            navigate(getPath('/admin/inventory-hub'));
            toast.success('Inventory');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, tenantSlug, options, balance, isFreeTier]);

  return {
    shortcutsVisible,
    setShortcutsVisible,
    commandPaletteOpen,
    setCommandPaletteOpen,
  };
};

