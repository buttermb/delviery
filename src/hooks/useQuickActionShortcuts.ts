/**
 * Shared keyboard shortcut hook for quick actions
 * Used by both Dashboard and Hotbox pages
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface ShortcutAction {
  key: string;
  path: string;
}

export function useQuickActionShortcuts(actions: ShortcutAction[]) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const match = actions.find(a => a.key === e.key.toLowerCase());
        if (match) {
          e.preventDefault();
          navigate(`/${tenantSlug}${match.path}`);
        }
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [actions, navigate, tenantSlug]);
}
