import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export const useAdminKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if ? is pressed (for shortcuts help)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsVisible(true);
        return;
      }

      // Check if Cmd/Ctrl + Shift is pressed
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        
        const getPath = (path: string) => {
          if (!tenantSlug) return path;
          return path.startsWith('/admin') ? `/${tenantSlug}${path}` : path;
        };

        switch(e.key.toLowerCase()) {
          case 'd':
            // Navigate to current tenant's dashboard
            navigate(getPath('/admin/dashboard'));
            toast({ title: 'Dashboard', duration: 1000 });
            break;
          case 'n':
            // Create new order
            navigate(getPath('/admin/wholesale-orders'));
            toast({ title: 'New Order', duration: 1000 });
            break;
          case 'm':
            // Navigate to menus
            navigate(getPath('/admin/disposable-menus'));
            toast({ title: 'Menus', duration: 1000 });
            break;
          case 'i':
            // Navigate to inventory
            navigate(getPath('/admin/inventory-dashboard'));
            toast({ title: 'Inventory', duration: 1000 });
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate, tenantSlug]);

  return { 
    shortcutsVisible, 
    setShortcutsVisible,
    commandPaletteOpen,
    setCommandPaletteOpen,
  };
};
