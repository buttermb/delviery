/**
 * CreditTransactionRow Component
 *
 * Individual transaction list item with expandable details.
 * Shows icon based on type, signed amount, running balance,
 * truncated description, and relative date.
 */

import { useState } from 'react';
import {
  Plus,
  Minus,
  RotateCcw,
  Gift,
  Coins,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export interface CreditTransactionRowTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: 'purchase' | 'usage' | 'refund' | 'free_grant' | 'bonus' | 'promo';
  description?: string;
  reference_id?: string;
  reference_url?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreditTransactionRowProps {
  transaction: CreditTransactionRowTransaction;
  className?: string;
  defaultExpanded?: boolean;
}

function getRelativeDate(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}

function getTransactionIcon(type: CreditTransactionRowTransaction['transaction_type']) {
  switch (type) {
    case 'purchase':
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
      );
    case 'usage':
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30">
          <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
        </div>
      );
    case 'refund':
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30">
          <RotateCcw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
      );
    case 'free_grant':
    case 'bonus':
    case 'promo':
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30">
          <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
      );
    default:
      return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
          <Coins className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

function getAmountColor(type: CreditTransactionRowTransaction['transaction_type']): string {
  switch (type) {
    case 'purchase':
    case 'free_grant':
    case 'bonus':
    case 'promo':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'usage':
      return 'text-red-600 dark:text-red-400';
    case 'refund':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-muted-foreground';
  }
}

function formatAmount(amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  return `${sign}${amount.toLocaleString()}`;
}

function truncateDescription(text: string, maxLength: number = 40): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function getTransactionLabel(type: CreditTransactionRowTransaction['transaction_type']): string {
  switch (type) {
    case 'purchase':
      return 'Purchase';
    case 'usage':
      return 'Usage';
    case 'refund':
      return 'Refund';
    case 'free_grant':
      return 'Grant';
    case 'bonus':
      return 'Bonus';
    case 'promo':
      return 'Promo';
    default:
      return 'Transaction';
  }
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

export function CreditTransactionRow({
  transaction,
  className,
  defaultExpanded = false,
}: CreditTransactionRowProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const description = transaction.description || getTransactionLabel(transaction.transaction_type);
  const truncatedDescription = truncateDescription(description);
  const relativeDate = getRelativeDate(transaction.created_at);
  const hasDetails = !!(
    transaction.metadata && Object.keys(transaction.metadata).length > 0
  ) || transaction.reference_id || (transaction.description && transaction.description.length > 40);

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-3 py-3 px-3 rounded-lg cursor-pointer transition-colors',
            'hover:bg-muted/50',
            isExpanded && 'bg-muted/30',
            className
          )}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={`${getTransactionLabel(transaction.transaction_type)} transaction: ${formatAmount(transaction.amount)} credits`}
        >
          {/* Icon */}
          {getTransactionIcon(transaction.transaction_type)}

          {/* Description + Date */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {truncatedDescription}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeDate}
            </p>
          </div>

          {/* Amount + Balance */}
          <div className="text-right flex-shrink-0">
            <p className={cn('text-sm font-semibold', getAmountColor(transaction.transaction_type))}>
              {formatAmount(transaction.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              bal: {transaction.balance_after.toLocaleString()}
            </p>
          </div>

          {/* Expand indicator */}
          {hasDetails && (
            <div className="flex-shrink-0 text-muted-foreground">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
      </CollapsibleTrigger>

      {hasDetails && (
        <CollapsibleContent>
          <div className="ml-11 mr-3 mb-3 px-3 py-2 rounded-md bg-muted/40 border border-border/50 space-y-2">
            {/* Full description */}
            {transaction.description && transaction.description.length > 40 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-sm">{transaction.description}</p>
              </div>
            )}

            {/* Reference */}
            {transaction.reference_id && (
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">Reference</p>
                {transaction.reference_url ? (
                  <a
                    href={transaction.reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {transaction.reference_id}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Badge variant="outline" className="text-xs font-mono">
                    {transaction.reference_id}
                  </Badge>
                )}
              </div>
            )}

            {/* Metadata */}
            {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(transaction.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-baseline gap-1">
                      <span className="text-xs text-muted-foreground capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="text-xs font-medium truncate">
                        {formatMetadataValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full timestamp */}
            <p className="text-xs text-muted-foreground">
              {new Date(transaction.created_at).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
