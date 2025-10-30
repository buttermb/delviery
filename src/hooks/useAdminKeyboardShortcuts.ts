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
        
        switch(e.key.toLowerCase()) {
          case 'd':
            navigate('/admin/dashboard');
            toast({ title: 'Dashboard' });
            break;
          case 'o':
            navigate('/admin/orders');
            toast({ title: 'Orders' });
            break;
          case 'p':
            navigate('/admin/products');
            toast({ title: 'Products' });
            break;
          case 'u':
            navigate('/admin/users');
            toast({ title: 'Users' });
            break;
          case 'c':
            navigate('/admin/couriers');
            toast({ title: 'Couriers' });
            break;
          case 'm':
            navigate('/admin/live-map');
            toast({ title: 'Live Map' });
            break;
          case 'l':
            navigate('/admin/live-orders');
            toast({ title: 'Live Orders' });
            break;
          case 'a':
            navigate('/admin/analytics');
            toast({ title: 'Analytics' });
            break;
          case 's':
            navigate('/admin/settings');
            toast({ title: 'Settings' });
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  return { shortcutsVisible, setShortcutsVisible };
};
