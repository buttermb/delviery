/**
 * Order Payment Method Badge Component
 *
 * Displays a badge indicating the payment method for an order.
 * Supports cash, card, invoice, and crypto payment methods.
 */

import { Badge } from '@/components/ui/badge';
import Banknote from "lucide-react/dist/esm/icons/banknote";
import CreditCard from "lucide-react/dist/esm/icons/credit-card";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Bitcoin from "lucide-react/dist/esm/icons/bitcoin";
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export type PaymentMethodType = 'cash' | 'card' | 'invoice' | 'crypto' | string;

interface PaymentMethodConfig {
  icon: LucideIcon;
  label: string;
  className: string;
}

const paymentMethodConfigs: Record<string, PaymentMethodConfig> = {
  cash: {
    icon: Banknote,
    label: 'Cash',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  card: {
    icon: CreditCard,
    label: 'Card',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  credit: {
    icon: CreditCard,
    label: 'Credit',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  debit: {
    icon: CreditCard,
    label: 'Debit',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  invoice: {
    icon: FileText,
    label: 'Invoice',
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  },
  crypto: {
    icon: Bitcoin,
    label: 'Crypto',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  },
};

const defaultConfig: PaymentMethodConfig = {
  icon: CreditCard,
  label: 'Unknown',
  className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

interface OrderPaymentMethodBadgeProps {
  paymentMethod?: string | null;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  showIcon?: boolean;
}

export function OrderPaymentMethodBadge({
  paymentMethod,
  className,
  size = 'default',
  showIcon = true,
}: OrderPaymentMethodBadgeProps) {
  if (!paymentMethod) {
    return null;
  }

  const normalizedMethod = paymentMethod.toLowerCase().trim();
  const config = paymentMethodConfigs[normalizedMethod] || {
    ...defaultConfig,
    label: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1),
  };
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium whitespace-nowrap border',
        sizeClasses[size],
        config.className,
        className
      )}
      title={`Payment method: ${config.label}`}
    >
      {showIcon && <Icon className={cn(iconSizes[size], 'mr-0.5')} />}
      {config.label}
    </Badge>
  );
}
