import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export const useAdminKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const [shortcutsVisible, setShortcutsVisible] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if Cmd/Ctrl + K is pressed (for search)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/admin/search');
        toast({ title: 'Opening Global Search' });
        return;
      }

      // Check if ? is pressed (for shortcuts help)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsVisible(true);
        return;
      }

      // Check if Cmd/Ctrl + Shift is pressed
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        
        // Note: Most admin routes are tenant-specific (/:tenantSlug/admin/...)
        // These shortcuts are disabled until routes are properly configured
        switch(e.key.toLowerCase()) {
          case 'd':
            // Navigate to current tenant's dashboard
            const currentPath = window.location.pathname;
            const tenantMatch = currentPath.match(/^\/([^/]+)\/admin/);
            if (tenantMatch) {
              navigate(`/${tenantMatch[1]}/admin/dashboard`);
              toast({ title: 'Dashboard' });
            }
            break;
          // Other shortcuts disabled - routes not configured
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  return { shortcutsVisible, setShortcutsVisible };
};
