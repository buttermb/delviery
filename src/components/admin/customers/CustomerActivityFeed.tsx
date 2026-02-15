/**
 * CustomerActivityFeed Component
 *
 * Shows all activity for a customer across all modules:
 * - Orders placed
 * - Payments made
 * - Deliveries received
 * - Menu interactions
 * - Communications received
 * - Notes added
 * - Credit changes
 *
 * Unified chronological feed with pagination and activity type filtering.
 * Each entry links to related entity.
 */

import { useState, useMemo, useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  CreditCard,
  Truck,
  Menu,
  MessageSquare,
  StickyNote,
  Coins,
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  ExternalLink,
} from 'lucide-react';

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderLink, InvoiceLink } from '@/components/admin/cross-links';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { formatRelativeTime, formatSmartDate } from '@/lib/utils/formatDate';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

// Activity types
type ActivityType = 'order' | 'payment' | 'delivery' | 'menu' | 'communication' | 'note' | 'credit';

interface ActivityEntry {
  id: string;
  type: ActivityType;
  action: string;
  description: string | null;
  metadata: Record<string, unknown>;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

interface CustomerActivityFeedProps {
  customerId: string;
  /** Maximum height for scrollable area */
  maxHeight?: string;
  /** Number of items per page */
  pageSize?: number;
  /** Show card wrapper */
  showCard?: boolean;
  /** Compact mode with smaller entries */
  compact?: boolean;
}

// Activity type configuration
const ACTIVITY_TYPE_CONFIG: Record<ActivityType, {
  icon: typeof Activity;
  label: string;
  color: string;
  bgColor: string;
}> = {
  order: {
    icon: ShoppingCart,
    label: 'Order',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  payment: {
    icon: CreditCard,
    label: 'Payment',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  delivery: {
    icon: Truck,
    label: 'Delivery',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  menu: {
    icon: Menu,
    label: 'Menu',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  communication: {
    icon: MessageSquare,
    label: 'Communication',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  note: {
    icon: StickyNote,
    label: 'Note',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  credit: {
    icon: Coins,
    label: 'Credit',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-100 dark:bg-pink-900/30',
  },
};

// Filter options
const FILTER_OPTIONS: Array<{ value: ActivityType | 'all'; label: string }> = [
  { value: 'all', label: 'All Activities' },
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'delivery', label: 'Deliveries' },
  { value: 'menu', label: 'Menu Interactions' },
  { value: 'communication', label: 'Communications' },
  { value: 'note', label: 'Notes' },
  { value: 'credit', label: 'Credits' },
];

/**
 * Format currency value
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Hook to fetch customer activities from multiple sources
 */
function useCustomerActivities(
  customerId: string,
  tenantId: string | undefined,
  filterType: ActivityType | 'all'
) {
  return useQuery({
    queryKey: ['customer-activities', customerId, tenantId, filterType],
    queryFn: async (): Promise<ActivityEntry[]> => {
      if (!tenantId || !customerId) return [];

      logger.info('[CustomerActivityFeed] Fetching activities', {
        customerId,
        tenantId,
        filterType,
      });

      const activities: ActivityEntry[] = [];

      // Fetch orders
      if (filterType === 'all' || filterType === 'order') {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, created_at, total_amount, status')
          .eq('customer_id', customerId)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (orders) {
          for (const order of orders) {
            activities.push({
              id: `order-${order.id}`,
              type: 'order',
              action: 'Order placed',
              description: `Order #${order.id.slice(0, 8).toUpperCase()} - ${formatCurrency(order.total_amount || 0)} (${order.status || 'pending'})`,
              metadata: {
                orderId: order.id,
                total: order.total_amount,
                status: order.status,
              },
              reference_id: order.id,
              reference_type: 'order',
              created_at: order.created_at,
            });
          }
        }
      }

      // Fetch payments (from unified_orders with payment info)
      if (filterType === 'all' || filterType === 'payment') {
        const { data: payments } = await (supabase as any)
          .from('unified_orders')
          .select('id, created_at, amount_paid, payment_status, payment_method')
          .eq('customer_id', customerId)
          .eq('tenant_id', tenantId)
          .not('amount_paid', 'is', null)
          .gt('amount_paid', 0)
          .order('created_at', { ascending: false })
          .limit(50);

        if (payments) {
          for (const payment of payments) {
            if (payment.amount_paid && payment.amount_paid > 0) {
              activities.push({
                id: `payment-${payment.id}`,
                type: 'payment',
                action: 'Payment received',
                description: `${formatCurrency(payment.amount_paid)} via ${payment.payment_method || 'unknown'} (${payment.payment_status || 'completed'})`,
                metadata: {
                  orderId: payment.id,
                  amount: payment.amount_paid,
                  method: payment.payment_method,
                  status: payment.payment_status,
                },
                reference_id: payment.id,
                reference_type: 'order',
                created_at: payment.created_at,
              });
            }
          }
        }
      }

      // Fetch deliveries
      if (filterType === 'all' || filterType === 'delivery') {
        const { data: deliveries } = await (supabase as any)
          .from('deliveries')
          .select('id, created_at, status, completed_at, order_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(100);

        // Filter by customer's orders
        if (deliveries) {
          const { data: customerOrders } = await supabase
            .from('orders')
            .select('id')
            .eq('customer_id', customerId)
            .eq('tenant_id', tenantId);

          const customerOrderIds = new Set(customerOrders?.map(o => o.id) || []);

          for (const delivery of deliveries) {
            if (delivery.order_id && customerOrderIds.has(delivery.order_id)) {
              const statusText = delivery.status === 'completed'
                ? 'Delivery completed'
                : `Delivery ${delivery.status || 'scheduled'}`;

              activities.push({
                id: `delivery-${delivery.id}`,
                type: 'delivery',
                action: statusText,
                description: `Order delivery ${delivery.status || 'in progress'}`,
                metadata: {
                  deliveryId: delivery.id,
                  orderId: delivery.order_id,
                  status: delivery.status,
                },
                reference_id: delivery.order_id,
                reference_type: 'order',
                created_at: delivery.completed_at || delivery.created_at,
              });
            }
          }
        }
      }

      // Fetch menu interactions (from activity_logs)
      if (filterType === 'all' || filterType === 'menu') {
        try {
          const { data: menuLogs } = await (supabase as unknown as {
            from: (table: string) => {
              select: (cols: string) => {
                eq: (col: string, val: string) => {
                  eq: (col: string, val: string) => {
                    eq: (col: string, val: string) => {
                      order: (col: string, opts: { ascending: boolean }) => {
                        limit: (n: number) => Promise<{ data: Array<{
                          id: string;
                          action: string;
                          description: string | null;
                          metadata: Record<string, unknown> | null;
                          resource_id: string | null;
                          created_at: string;
                        }> | null }>
                      }
                    }
                  }
                }
              }
            }
          }).from('activity_logs')
            .select('id, action, description, metadata, resource_id, created_at')
            .eq('tenant_id', tenantId)
            .eq('category', 'menu')
            .eq('resource', 'customer')
            .order('created_at', { ascending: false })
            .limit(50);

          if (menuLogs) {
            for (const log of menuLogs) {
              const meta = log.metadata as Record<string, unknown> | null;
              if (meta && meta.customer_id === customerId) {
                activities.push({
                  id: `menu-${log.id}`,
                  type: 'menu',
                  action: log.action,
                  description: log.description,
                  metadata: meta || {},
                  reference_id: log.resource_id,
                  reference_type: 'menu',
                  created_at: log.created_at,
                });
              }
            }
          }
        } catch {
          // Table might not exist
          logger.debug('[CustomerActivityFeed] activity_logs table not available');
        }
      }

      // Fetch communications (SMS/email logs)
      if (filterType === 'all' || filterType === 'communication') {
        try {
          const { data: commLogs } = await (supabase as unknown as {
            from: (table: string) => {
              select: (cols: string) => {
                eq: (col: string, val: string) => {
                  eq: (col: string, val: string) => {
                    order: (col: string, opts: { ascending: boolean }) => {
                      limit: (n: number) => Promise<{ data: Array<{
                        id: string;
                        type: string;
                        subject: string | null;
                        status: string;
                        created_at: string;
                      }> | null }>
                    }
                  }
                }
              }
            }
          }).from('communication_logs')
            .select('id, type, subject, status, created_at')
            .eq('tenant_id', tenantId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (commLogs) {
            for (const comm of commLogs) {
              activities.push({
                id: `comm-${comm.id}`,
                type: 'communication',
                action: `${comm.type || 'Message'} sent`,
                description: comm.subject || `${comm.type} communication (${comm.status})`,
                metadata: {
                  commId: comm.id,
                  type: comm.type,
                  status: comm.status,
                },
                reference_id: comm.id,
                reference_type: 'communication',
                created_at: comm.created_at,
              });
            }
          }
        } catch {
          // Table might not exist
          logger.debug('[CustomerActivityFeed] communication_logs table not available');
        }
      }

      // Fetch notes
      if (filterType === 'all' || filterType === 'note') {
        try {
          const { data: notes } = await (supabase as unknown as {
            from: (table: string) => {
              select: (cols: string) => {
                eq: (col: string, val: string) => {
                  eq: (col: string, val: string) => {
                    order: (col: string, opts: { ascending: boolean }) => {
                      limit: (n: number) => Promise<{ data: Array<{
                        id: string;
                        content: string;
                        created_by_email: string | null;
                        created_at: string;
                      }> | null }>
                    }
                  }
                }
              }
            }
          }).from('customer_notes')
            .select('id, content, created_by_email, created_at')
            .eq('tenant_id', tenantId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (notes) {
            for (const note of notes) {
              activities.push({
                id: `note-${note.id}`,
                type: 'note',
                action: 'Note added',
                description: note.content?.length > 100
                  ? `${note.content.slice(0, 100)}...`
                  : note.content,
                metadata: {
                  noteId: note.id,
                  createdBy: note.created_by_email,
                },
                reference_id: note.id,
                reference_type: 'note',
                created_at: note.created_at,
              });
            }
          }
        } catch {
          // Table might not exist
          logger.debug('[CustomerActivityFeed] customer_notes table not available');
        }
      }

      // Fetch credit changes
      if (filterType === 'all' || filterType === 'credit') {
        try {
          const { data: credits } = await (supabase as unknown as {
            from: (table: string) => {
              select: (cols: string) => {
                eq: (col: string, val: string) => {
                  eq: (col: string, val: string) => {
                    order: (col: string, opts: { ascending: boolean }) => {
                      limit: (n: number) => Promise<{ data: Array<{
                        id: string;
                        amount: number;
                        type: string;
                        description: string | null;
                        balance_after: number;
                        created_at: string;
                      }> | null }>
                    }
                  }
                }
              }
            }
          }).from('customer_credits')
            .select('id, amount, type, description, balance_after, created_at')
            .eq('tenant_id', tenantId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false })
            .limit(50);

          if (credits) {
            for (const credit of credits) {
              const isPositive = credit.amount > 0;
              activities.push({
                id: `credit-${credit.id}`,
                type: 'credit',
                action: isPositive ? 'Credit added' : 'Credit used',
                description: `${isPositive ? '+' : ''}${formatCurrency(credit.amount)} - ${credit.description || credit.type}. Balance: ${formatCurrency(credit.balance_after)}`,
                metadata: {
                  creditId: credit.id,
                  amount: credit.amount,
                  type: credit.type,
                  balanceAfter: credit.balance_after,
                },
                reference_id: credit.id,
                reference_type: 'credit',
                created_at: credit.created_at,
              });
            }
          }
        } catch {
          // Table might not exist
          logger.debug('[CustomerActivityFeed] customer_credits table not available');
        }
      }

      // Sort by date descending
      activities.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      logger.info('[CustomerActivityFeed] Activities loaded', {
        total: activities.length,
        filterType,
      });

      return activities;
    },
    enabled: !!tenantId && !!customerId,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Activity entry component
 */
function ActivityEntryItem({
  entry,
  compact,
  onNavigate,
}: {
  entry: ActivityEntry;
  compact?: boolean;
  onNavigate: (type: string, id: string) => void;
}) {
  const config = ACTIVITY_TYPE_CONFIG[entry.type];
  const Icon = config.icon;

  const renderLink = (): ReactNode => {
    if (!entry.reference_id) return null;

    if (entry.reference_type === 'order') {
      return (
        <OrderLink
          orderId={entry.reference_id}
          orderNumber={`View order`}
          className="text-xs"
        />
      );
    }

    if (entry.reference_type === 'invoice') {
      return (
        <InvoiceLink
          invoiceId={entry.reference_id}
          invoiceNumber="View invoice"
          className="text-xs"
        />
      );
    }

    // Generic view link
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={() => onNavigate(entry.reference_type || '', entry.reference_id || '')}
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        View
      </Button>
    );
  };

  return (
    <div className={cn(
      'relative group',
      compact ? 'py-2' : 'py-3',
    )}>
      {/* Timeline dot */}
      <div className={cn(
        'absolute -left-[29px] mt-1 p-1.5 rounded-full border-2 border-muted transition-colors',
        'group-hover:border-primary bg-background',
        config.bgColor,
      )}>
        <Icon className={cn('h-3 w-3', config.color)} />
      </div>

      {/* Entry content */}
      <div className="px-3 rounded-md hover:bg-muted/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'font-medium',
                compact ? 'text-xs' : 'text-sm',
              )}>
                {entry.action}
              </span>
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                {config.label}
              </Badge>
            </div>

            {entry.description && (
              <p className={cn(
                'text-muted-foreground mt-0.5 line-clamp-2',
                compact ? 'text-xs' : 'text-sm',
              )}>
                {entry.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1">
              {renderLink()}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatRelativeTime(entry.created_at)}
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {formatSmartDate(entry.created_at, { includeTime: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerActivityFeed({
  customerId,
  maxHeight = '500px',
  pageSize = 10,
  showCard = true,
  compact = false,
}: CustomerActivityFeedProps) {
  const { tenant } = useTenantAdminAuth();
  const { navigateToAdmin } = useTenantNavigation();
  const tenantId = tenant?.id;

  const [filterType, setFilterType] = useState<ActivityType | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: activities,
    isLoading,
    isError,
    error,
  } = useCustomerActivities(customerId, tenantId, filterType);

  // Paginate activities
  const paginatedActivities = useMemo(() => {
    if (!activities) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return activities.slice(startIndex, startIndex + pageSize);
  }, [activities, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (!activities) return 1;
    return Math.ceil(activities.length / pageSize);
  }, [activities, pageSize]);

  // Reset page when filter changes
  const handleFilterChange = useCallback((value: string) => {
    setFilterType(value as ActivityType | 'all');
    setCurrentPage(1);
  }, []);

  const handleNavigate = useCallback((type: string, id: string) => {
    switch (type) {
      case 'order':
        navigateToAdmin(`orders/${id}`);
        break;
      case 'delivery':
        navigateToAdmin(`deliveries/${id}`);
        break;
      case 'invoice':
        navigateToAdmin(`invoices/${id}`);
        break;
      default:
        logger.debug('[CustomerActivityFeed] Unknown reference type for navigation', { type, id });
    }
  }, [navigateToAdmin]);

  const clearFilter = useCallback(() => {
    setFilterType('all');
    setCurrentPage(1);
  }, []);

  const content = (
    <div className="space-y-4">
      {/* Filter controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filter:</span>
        </div>
        <Select value={filterType} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="All Activities" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterType !== 'all' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilter}
            className="h-8 text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
        {activities && (
          <span className="text-sm text-muted-foreground ml-auto">
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </span>
        )}
      </div>

      {/* Activity Timeline */}
      {isLoading ? (
        <div className="space-y-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Unable to load activity feed.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Please try again later.'}
          </p>
        </div>
      ) : !activities || activities.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium">No activity found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Activity will appear here as the customer interacts with your store.
          </p>
        </div>
      ) : (
        <>
          <ScrollArea style={{ maxHeight }}>
            <div className="relative border-l-2 border-muted ml-4 space-y-1 pb-4">
              {paginatedActivities.map((entry) => (
                <ActivityEntryItem
                  key={entry.id}
                  entry={entry}
                  compact={compact}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))] flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export default CustomerActivityFeed;
