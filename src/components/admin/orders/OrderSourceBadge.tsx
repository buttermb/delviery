/**
 * Order Source Badge Component
 *
 * Displays a badge indicating where an order originated from.
 * Supports: POS, storefront, phone, manual, admin, menu, and API sources.
 */

import { Badge } from '@/components/ui/badge';
import Store from "lucide-react/dist/esm/icons/store";
import Monitor from "lucide-react/dist/esm/icons/monitor";
import Phone from "lucide-react/dist/esm/icons/phone";
import FileEdit from "lucide-react/dist/esm/icons/file-edit";
import Utensils from "lucide-react/dist/esm/icons/utensils";
import Zap from "lucide-react/dist/esm/icons/zap";
import ShoppingCart from "lucide-react/dist/esm/icons/shopping-cart";
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type OrderSource = 'pos' | 'storefront' | 'phone' | 'manual' | 'admin' | 'menu' | 'api';

interface OrderSourceConfig {
  label: string;
  icon: LucideIcon;
  className: string;
}

const sourceConfigs: Record<OrderSource, OrderSourceConfig> = {
  pos: {
    label: 'POS',
    icon: ShoppingCart,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
  storefront: {
    label: 'Storefront',
    icon: Store,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  },
  phone: {
    label: 'Phone',
    icon: Phone,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  manual: {
    label: 'Manual',
    icon: FileEdit,
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-800',
  },
  admin: {
    label: 'Admin',
    icon: Monitor,
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
  },
  menu: {
    label: 'Menu',
    icon: Utensils,
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
  },
  api: {
    label: 'API',
    icon: Zap,
    className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
  },
};

interface OrderSourceBadgeProps {
  /** The source of the order (pos, storefront, phone, manual, admin, menu, api) */
  source: string | null | undefined;
  /** Additional CSS classes */
  className?: string;
  /** When true, shows only the icon without the label */
  compact?: boolean;
  /** When true, hides the icon and shows only the label */
  labelOnly?: boolean;
}

export function OrderSourceBadge({
  source,
  className,
  compact = false,
  labelOnly = false,
}: OrderSourceBadgeProps) {
  // Default to 'admin' if source is not provided or not recognized
  const normalizedSource = (source?.toLowerCase() || 'admin') as OrderSource;
  const config = sourceConfigs[normalizedSource] || sourceConfigs.admin;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 text-xs font-medium',
        config.className,
        className
      )}
      title={`Order source: ${config.label}`}
    >
      {!labelOnly && <Icon className="h-3 w-3" />}
      {!compact && config.label}
    </Badge>
  );
}

/** Helper to get the display label for a source */
export function getOrderSourceLabel(source: string | null | undefined): string {
  const normalizedSource = (source?.toLowerCase() || 'admin') as OrderSource;
  return sourceConfigs[normalizedSource]?.label || 'Admin';
}

/** Helper to check if a source is valid */
export function isValidOrderSource(source: string | null | undefined): boolean {
  if (!source) return false;
  return source.toLowerCase() in sourceConfigs;
}
