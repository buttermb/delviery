/**
 * Quick Actions Row
 * Grid of quick action buttons with keyboard shortcuts for Dashboard
 */

import { Card } from '@/components/ui/card';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuickActionShortcuts } from '@/hooks/useQuickActionShortcuts';
import {
  PlusCircle,
  Users,
  FileText,
  Monitor,
  DollarSign,
} from 'lucide-react';

interface QuickActionItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  shortcut?: string;
}

const DASHBOARD_ACTIONS: QuickActionItem[] = [
  { label: 'New Order', icon: <PlusCircle className="h-5 w-5" />, path: '/admin/orders?new=true', shortcut: 'Alt+N' },
  { label: 'Add Product', icon: <PlusCircle className="h-5 w-5" />, path: '/admin/inventory-hub?action=add', shortcut: 'Alt+I' },
  { label: 'Add Customer', icon: <Users className="h-5 w-5" />, path: '/admin/customer-hub?action=add', shortcut: 'Alt+C' },
  { label: 'Create Invoice', icon: <FileText className="h-5 w-5" />, path: '/admin/invoices?action=create' },
  { label: 'Open POS', icon: <Monitor className="h-5 w-5" />, path: '/admin/pos', shortcut: 'Alt+P' },
  { label: 'Record Payment', icon: <DollarSign className="h-5 w-5" />, path: '/admin/finance-hub?action=payment' },
];

const SHORTCUT_ACTIONS = [
  { key: 'n', path: '/admin/orders?new=true' },
  { key: 'i', path: '/admin/inventory-hub?action=add' },
  { key: 'c', path: '/admin/customer-hub?action=add' },
  { key: 'p', path: '/admin/pos' },
];

export function QuickActionsRow() {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  useQuickActionShortcuts(SHORTCUT_ACTIONS);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {DASHBOARD_ACTIONS.map((action) => (
        <Card
          key={action.label}
          className="p-3 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/50 hover:shadow-sm transition-all text-center"
          onClick={() => navigate(`/${tenantSlug}${action.path}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate(`/${tenantSlug}${action.path}`);
            }
          }}
        >
          <span className="text-muted-foreground">{action.icon}</span>
          <span className="text-xs font-medium leading-tight">{action.label}</span>
          {action.shortcut && (
            <span className="text-[10px] text-muted-foreground/60">{action.shortcut}</span>
          )}
        </Card>
      ))}
    </div>
  );
}
