/**
 * Quick Actions Floating Button (FAB)
 * 
 * Mobile-friendly floating action button with radial menu for common tasks.
 * Features:
 * - New Order
 * - Record Payment
 * - Add Product
 * - New Client
 * - Context-aware (shows different actions per page)
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import Package from "lucide-react/dist/esm/icons/package";
import Users from "lucide-react/dist/esm/icons/users";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Truck from "lucide-react/dist/esm/icons/truck";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import ClipboardList from "lucide-react/dist/esm/icons/clipboard-list";
import Calculator from "lucide-react/dist/esm/icons/calculator";
import Boxes from "lucide-react/dist/esm/icons/boxes";
import Receipt from "lucide-react/dist/esm/icons/receipt";
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  contexts?: string[]; // Which pages this action is especially relevant for
}

const ALL_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-order',
    label: 'New Order',
    icon: ShoppingCart,
    path: 'orders/new',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    contexts: ['dashboard', 'orders', 'clients'],
  },
  {
    id: 'record-payment',
    label: 'Record Payment',
    icon: DollarSign,
    path: 'payments/new',
    color: 'bg-blue-500 hover:bg-blue-600',
    contexts: ['dashboard', 'payments', 'clients', 'financial-command-center'],
  },
  {
    id: 'add-product',
    label: 'Add Product',
    icon: Package,
    path: 'products/new',
    color: 'bg-purple-500 hover:bg-purple-600',
    contexts: ['products', 'inventory'],
  },
  {
    id: 'new-client',
    label: 'New Client',
    icon: Users,
    path: 'wholesale-clients/new',
    color: 'bg-orange-500 hover:bg-orange-600',
    contexts: ['dashboard', 'clients', 'wholesale-clients'],
  },
  {
    id: 'new-invoice',
    label: 'Create Invoice',
    icon: FileText,
    path: 'invoices/new',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    contexts: ['invoices', 'clients', 'financial-command-center'],
  },
  {
    id: 'new-dispatch',
    label: 'New Dispatch',
    icon: Truck,
    path: 'inventory/dispatch',
    color: 'bg-teal-500 hover:bg-teal-600',
    contexts: ['inventory', 'orders', 'dashboard'],
  },
  {
    id: 'new-route',
    label: 'Plan Route',
    icon: MapPin,
    path: 'route-planning',
    color: 'bg-rose-500 hover:bg-rose-600',
    contexts: ['dispatch', 'orders', 'drivers'],
  },
  {
    id: 'expense',
    label: 'Log Expense',
    icon: Receipt,
    path: 'expenses/new',
    color: 'bg-amber-500 hover:bg-amber-600',
    contexts: ['financial-command-center', 'expenses'],
  },
  {
    id: 'inventory-count',
    label: 'Stock Count',
    icon: Boxes,
    path: 'inventory/count',
    color: 'bg-cyan-500 hover:bg-cyan-600',
    contexts: ['inventory', 'products'],
  },
  {
    id: 'quick-sale',
    label: 'Quick Sale (POS)',
    icon: CreditCard,
    path: 'pos',
    color: 'bg-pink-500 hover:bg-pink-600',
    contexts: ['dashboard', 'pos'],
  },
];

// Get up to 5 most relevant actions based on current page context
function getRelevantActions(pathname: string): QuickAction[] {
  const context = pathname.split('/').pop() || 'dashboard';
  
  // Score actions by relevance
  const scored = ALL_QUICK_ACTIONS.map(action => {
    let score = 0;
    if (action.contexts?.includes(context)) {
      score += 10;
    }
    // Default actions always get a base score
    if (['new-order', 'record-payment', 'add-product', 'new-client'].includes(action.id)) {
      score += 5;
    }
    return { action, score };
  });
  
  // Sort by score and take top 5
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ action }) => action);
}

interface QuickActionsButtonProps {
  className?: string;
}

export function QuickActionsButton({ className }: QuickActionsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const location = useLocation();
  const [actions, setActions] = useState<QuickAction[]>([]);
  
  // Update actions when location changes
  useEffect(() => {
    setActions(getRelevantActions(location.pathname));
  }, [location.pathname]);
  
  const handleActionClick = useCallback((action: QuickAction) => {
    setIsOpen(false);
    
    // Build the full path with tenant slug
    const fullPath = tenantSlug 
      ? `/${tenantSlug}/admin/${action.path}`
      : `/admin/${action.path}`;
    
    logger.info('Quick action triggered', { 
      action: action.id, 
      path: fullPath 
    });
    
    navigate(fullPath);
  }, [navigate, tenantSlug]);
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);
  
  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-quick-actions]')) {
        setIsOpen(false);
      }
    };
    
    // Delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);
  
  return (
    <div 
      data-quick-actions
      className={cn(
        'fixed bottom-6 right-6 z-50',
        className
      )}
    >
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Action buttons - arranged in a semi-circle */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0">
            {actions.map((action, index) => {
              // Calculate position in semi-circle
              const totalActions = actions.length;
              const angle = (Math.PI / 2) * (index / (totalActions - 1)) + Math.PI / 4; // 45 to 135 degrees
              const radius = 80;
              const x = -Math.cos(angle) * radius;
              const y = -Math.sin(angle) * radius;
              
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x, 
                    y,
                    transition: { 
                      delay: index * 0.05,
                      type: 'spring',
                      stiffness: 300,
                      damping: 20
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    scale: 0, 
                    x: 0, 
                    y: 0,
                    transition: { 
                      delay: (totalActions - index - 1) * 0.03 
                    }
                  }}
                  onClick={() => handleActionClick(action)}
                  className={cn(
                    'absolute flex items-center gap-2 px-3 py-2 rounded-full',
                    'text-white text-sm font-medium shadow-lg',
                    'transition-transform hover:scale-110',
                    'whitespace-nowrap',
                    action.color
                  )}
                  style={{
                    // Center the button on its position
                    transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                  }}
                >
                  <action.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </AnimatePresence>
      
      {/* Main FAB button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'h-14 w-14 rounded-full shadow-lg',
          'flex items-center justify-center',
          'text-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          isOpen 
            ? 'bg-gray-700 hover:bg-gray-800 focus:ring-gray-500' 
            : 'bg-primary hover:bg-primary/90 focus:ring-primary'
        )}
        aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </motion.button>
      
      {/* Tooltip hint when closed */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none"
        >
          <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded shadow-sm whitespace-nowrap">
            Quick Actions
          </span>
        </motion.div>
      )}
    </div>
  );
}

export default QuickActionsButton;

