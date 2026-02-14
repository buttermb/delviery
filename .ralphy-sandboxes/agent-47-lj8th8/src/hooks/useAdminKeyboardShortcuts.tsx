import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Coins } from 'lucide-react';
import React from 'react';
import { useCredits } from '@/hooks/useCredits';
import { useCommandPaletteStore } from '@/components/tenant-admin/CommandPalette';
import { logger } from '@/lib/logger';

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onCreate?: () => void;
  onEscape?: () => void;
}

/** Hub routes mapped to Cmd/Ctrl + number keys (1-8) */
const HUB_ROUTES = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/orders', label: 'Orders Hub' },
  { path: '/admin/inventory-hub', label: 'Inventory Hub' },
  { path: '/admin/customer-hub', label: 'Customers Hub' },
  { path: '/admin/finance-hub', label: 'Finance Hub' },
  { path: '/admin/fulfillment-hub', label: 'Fulfillment Hub' },
  { path: '/admin/marketing-hub', label: 'Marketing Hub' },
  { path: '/admin/analytics-hub', label: 'Analytics Hub' },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
}

export const useAdminKeyboardShortcuts = (options: KeyboardShortcutsOptions = {}) => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const { setOpen: setCommandPaletteOpen } = useCommandPaletteStore();
  const { balance, isFreeTier } = useCredits();

  // Stable refs so the effect doesn't re-register on every render
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const getAdminPath = useCallback(
    (path: string) => {
      if (!tenantSlug) return path;
      return `/${tenantSlug}${path}`;
    },
    [tenantSlug],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const typing = isTypingTarget(e.target);

      // ── Cmd/Ctrl shortcuts ──────────────────────────────
      if (isMod) {
        // Cmd+K — open command palette / search
        if (e.key.toLowerCase() === 'k' && !e.shiftKey) {
          e.preventDefault();
          if (optionsRef.current.onSearch) {
            optionsRef.current.onSearch();
          } else {
            setCommandPaletteOpen(true);
          }
          return;
        }

        // Cmd+1-8 — hub navigation (only without Shift)
        if (!e.shiftKey && e.key >= '1' && e.key <= '8') {
          e.preventDefault();
          const idx = parseInt(e.key, 10) - 1;
          const hub = HUB_ROUTES[idx];
          if (hub) {
            navigate(getAdminPath(hub.path));
            toast.success(hub.label);
            logger.debug('Keyboard nav', { shortcut: `Cmd+${e.key}`, hub: hub.label });
          }
          return;
        }

        // Cmd+Shift combinations
        if (e.shiftKey) {
          switch (e.key.toLowerCase()) {
            case 'd':
              e.preventDefault();
              navigate(getAdminPath('/admin/dashboard'));
              toast.success('Dashboard');
              return;
            case 'n':
              e.preventDefault();
              navigate(getAdminPath('/admin/orders'));
              toast.success('Orders');
              return;
            case 'm':
              e.preventDefault();
              navigate(getAdminPath('/admin/disposable-menus'));
              toast.success('Menus');
              return;
            case 'i':
              e.preventDefault();
              navigate(getAdminPath('/admin/inventory-hub'));
              toast.success('Inventory');
              return;
          }
        }

        // Let other Cmd shortcuts (Cmd+B for sidebar) pass through
        return;
      }

      // ── Non-modifier shortcuts (only when not typing) ──
      if (typing) return;

      switch (e.key) {
        // ? — show shortcuts dialog
        case '?':
          e.preventDefault();
          setShortcutsVisible(true);
          return;

        // / — focus search (open command palette)
        case '/':
          e.preventDefault();
          setCommandPaletteOpen(true);
          return;

        // Escape — close dialogs or custom handler
        case 'Escape':
          if (optionsRef.current.onEscape) {
            optionsRef.current.onEscape();
          }
          return;

        // Shift+C — show credit balance
        default:
          if (e.key.toLowerCase() === 'c' && e.shiftKey) {
            e.preventDefault();
            toast('Credit Balance', {
              description: isFreeTier
                ? `You have ${balance.toLocaleString()} credits remaining.`
                : 'You are on an unlimited plan.',
              icon: <Coins className="h-4 w-4 text-emerald-500" />,
              duration: 2000,
            });
            return;
          }

          // c — create action (if handler provided)
          if (e.key.toLowerCase() === 'c' && !e.shiftKey && optionsRef.current.onCreate) {
            e.preventDefault();
            optionsRef.current.onCreate();
            return;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, tenantSlug, getAdminPath, balance, isFreeTier, setCommandPaletteOpen]);

  return {
    shortcutsVisible,
    setShortcutsVisible,
  };
};
