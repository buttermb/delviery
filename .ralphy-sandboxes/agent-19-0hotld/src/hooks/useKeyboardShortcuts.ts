/**
 * Keyboard Shortcuts Hook
 * Global keyboard shortcut handler for super admin panel
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcut {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(
  onCommandPaletteOpen: () => void,
  customShortcuts?: KeyboardShortcut[]
) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette (⌘K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) {
        e.preventDefault();
        onCommandPaletteOpen();
        return;
      }

      // Quick navigation shortcuts (⌘1-7)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key >= '1' && e.key <= '7') {
        e.preventDefault();
        const routes = [
          '/super-admin/dashboard',
          '/super-admin/tenants',
          '/super-admin/revenue-analytics',
          '/super-admin/analytics',
          '/super-admin/monitoring',
          '/super-admin/communication',
          '/super-admin/security',
        ];
        const routeIndex = parseInt(e.key) - 1;
        if (routes[routeIndex]) {
          navigate(routes[routeIndex]);
        }
        return;
      }

      // Custom shortcuts
      if (customShortcuts) {
        for (const shortcut of customShortcuts) {
          const metaMatch = shortcut.metaKey ? e.metaKey : !e.metaKey;
          const ctrlMatch = shortcut.ctrlKey ? e.ctrlKey : !e.ctrlKey;
          const shiftMatch = shortcut.shiftKey ? e.shiftKey : !e.shiftKey;
          const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

          if (metaMatch && ctrlMatch && shiftMatch && keyMatch) {
            e.preventDefault();
            shortcut.action();
            return;
          }
        }
      }

      // Additional shortcuts
      // ⌘T - Find tenant
      if ((e.metaKey || e.ctrlKey) && e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        onCommandPaletteOpen();
        // Focus search on tenant
        setTimeout(() => {
          const input = document.querySelector('[data-command-input]') as HTMLInputElement;
          if (input) {
            input.value = 'tenant';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 100);
        return;
      }

      // ⌘N - Create tenant
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        navigate('/super-admin/tenants/new');
        return;
      }

      // ⌘R - Generate report
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        navigate('/super-admin/report-builder');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onCommandPaletteOpen, customShortcuts]);
}

