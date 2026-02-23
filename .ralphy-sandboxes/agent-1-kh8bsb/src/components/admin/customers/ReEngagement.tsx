/**
 * ReEngagement Component
 *
 * View at-risk and churned customers with suggested re-engagement actions.
 * Features:
 * - One-click to create promotional offer, send message, or add note
 * - Shows days since last order, previous order frequency, and what they used to buy
 * - Helps proactively manage customer relationships
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import {
  AlertTriangle,
  Clock,
  Gift,
  MessageSquare,
  StickyNote,
  TrendingDown,
  UserX,
  Loader2,
  ChevronDown,
  ChevronRight,
  Package,
  DollarSign,
  RefreshCw,
  Filter,
  ExternalLink,
} from 'lucide-react';

import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

type CustomerRiskLevel = 'at_risk' | 'churned';

interface AtRiskCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number;
  orderFrequencyDays: number | null;
  totalOrders: number;
  totalSpent: number;
  riskLevel: CustomerRiskLevel;
  topProducts: Array<{ name: string; quantity: number }>;
  averageOrderValue: number;
}

interface ReEngagementProps {
  /** Filter to show specific risk level */
  riskFilter?: CustomerRiskLevel | 'all';
  /** Maximum height for scrollable area */
  maxHeight?: string;
  /** Show compact view */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

interface ActionDialogState {
  isOpen: boolean;
  type: 'offer' | 'message' | 'note' | null;
  customer: AtRiskCustomer | null;
}

// ============================================================================
// Risk Level Configuration
// ============================================================================

const RISK_LEVEL_CONFIG: Record<
  CustomerRiskLevel,
  {
    label: string;
    description: string;
    icon: typeof AlertTriangle;
    color: string;
    bgColor: string;
    thresholdDays: number;
  }
> = {
  at_risk: {
    label: 'At Risk',
    description: 'Customer ordering frequency has dropped significantly',
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    thresholdDays: 30, // Configurable: days without order to be "at risk"
  },
  churned: {
    label: 'Churned',
    description: 'Customer has not ordered in a long time',
    icon: UserX,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    thresholdDays: 60, // Configurable: days without order to be "churned"
  },
};

// ============================================================================
// Hook: Fetch At-Risk Customers
// ============================================================================

function useAtRiskCustomers(tenantId: string | undefined, riskFilter: CustomerRiskLevel | 'all') {
  return useQuery({
    queryKey: [...queryKeys.customers.byTenant(tenantId || ''), 'at-risk', riskFilter],
    queryFn: async (): Promise<AtRiskCustomer[]> => {
      if (!tenantId) return [];

      logger.debug('[ReEngagement] Fetching at-risk customers', { tenantId, riskFilter });

      // Fetch customers with their order history
      const { data: customers, error: customersError } = await (supabase as any)
        .from('customers')
        .select(`
          id,
          name,
          email,
          phone,
          created_at
        `)
        .eq('tenant_id', tenantId);

      if (customersError) {
        logger.error('[ReEngagement] Failed to fetch customers', customersError, { tenantId });
        throw customersError;
      }

      if (!customers || customers.length === 0) {
        return [];
      }

      // Fetch order data for all customers
      const customerIds = customers.map((c) => c.id);
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, customer_id, total_amount, created_at, status')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIds)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false });

      if (ordersError) {
        logger.error('[ReEngagement] Failed to fetch orders', ordersError, { tenantId });
        throw ordersError;
      }

      // Fetch order items for top products
      const orderIds = orders?.map((o) => o.id) || [];
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          product:products(name)
        `)
        .in('order_id', orderIds);

      if (itemsError) {
        logger.debug('[ReEngagement] Could not fetch order items', { error: itemsError });
      }

      // Process customers
      const now = new Date();
      const atRiskThreshold = RISK_LEVEL_CONFIG.at_risk.thresholdDays;
      const churnedThreshold = RISK_LEVEL_CONFIG.churned.thresholdDays;

      const atRiskCustomers: AtRiskCustomer[] = [];

      for (const customer of customers) {
        const customerOrders = orders?.filter((o) => o.customer_id === customer.id) || [];

        if (customerOrders.length === 0) {
          // New customer with no orders - skip
          continue;
        }

        const lastOrder = customerOrders[0];
        const lastOrderDate = lastOrder?.created_at || null;
        const daysSinceLastOrder = lastOrderDate
          ? differenceInDays(now, new Date(lastOrderDate))
          : 999;

        // Calculate order frequency (average days between orders)
        let orderFrequencyDays: number | null = null;
        if (customerOrders.length >= 2) {
          const orderDates = customerOrders
            .map((o) => new Date(o.created_at))
            .sort((a, b) => a.getTime() - b.getTime());

          let totalDaysBetween = 0;
          for (let i = 1; i < orderDates.length; i++) {
            totalDaysBetween += differenceInDays(orderDates[i], orderDates[i - 1]);
          }
          orderFrequencyDays = Math.round(totalDaysBetween / (orderDates.length - 1));
        }

        // Determine risk level
        let riskLevel: CustomerRiskLevel | null = null;
        if (daysSinceLastOrder >= churnedThreshold) {
          riskLevel = 'churned';
        } else if (daysSinceLastOrder >= atRiskThreshold) {
          riskLevel = 'at_risk';
        } else if (orderFrequencyDays && daysSinceLastOrder > orderFrequencyDays * 2) {
          // Customer is ordering less frequently than usual
          riskLevel = 'at_risk';
        }

        if (!riskLevel) continue;

        // Apply filter
        if (riskFilter !== 'all' && riskLevel !== riskFilter) continue;

        // Calculate stats
        const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const averageOrderValue = totalSpent / customerOrders.length;

        // Get top products
        const productCounts = new Map<string, number>();
        const customerOrderIds = customerOrders.map((o) => o.id);
        const customerItems = orderItems?.filter((item) => customerOrderIds.includes(item.order_id)) || [];

        for (const item of customerItems) {
          const productName = (item.product as { name?: string } | null)?.name || 'Unknown';
          const current = productCounts.get(productName) || 0;
          productCounts.set(productName, current + (item.quantity || 1));
        }

        const topProducts = Array.from(productCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, quantity]) => ({ name, quantity }));

        atRiskCustomers.push({
          id: customer.id,
          name: customer.name || 'Unknown Customer',
          email: customer.email,
          phone: customer.phone,
          lastOrderDate,
          daysSinceLastOrder,
          orderFrequencyDays,
          totalOrders: customerOrders.length,
          totalSpent,
          riskLevel,
          topProducts,
          averageOrderValue,
        });
      }

      // Sort by days since last order (most critical first)
      atRiskCustomers.sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);

      logger.info('[ReEngagement] At-risk customers loaded', {
        total: atRiskCustomers.length,
        atRisk: atRiskCustomers.filter((c) => c.riskLevel === 'at_risk').length,
        churned: atRiskCustomers.filter((c) => c.riskLevel === 'churned').length,
      });

      return atRiskCustomers;
    },
    enabled: !!tenantId,
    staleTime: 60_000, // 1 minute
  });
}

// ============================================================================
// Hook: Add Customer Note
// ============================================================================

function useAddCustomerNote(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ customerId, content }: { customerId: string; content: string }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const { error } = await (supabase as any).from('customer_notes').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        content,
        note_type: 're-engagement',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Note added',
        description: 'Re-engagement note has been saved to the customer profile.',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerNotes.all });
    },
    onError: (error) => {
      logger.error('[ReEngagement] Failed to add note', error);
      toast({
        title: 'Error',
        description: 'Failed to save note. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Hook: Create Promotional Offer
// ============================================================================

function useCreatePromoOffer(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      customerId,
      discountPercent,
      code,
      expiresInDays,
    }: {
      customerId: string;
      discountPercent: number;
      code: string;
      expiresInDays: number;
    }) => {
      if (!tenantId) throw new Error('No tenant ID');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create a customer-specific coupon
      const { error } = await (supabase as any).from('coupons').insert({
        tenant_id: tenantId,
        code: code.toUpperCase(),
        discount_type: 'percentage',
        discount_value: discountPercent,
        usage_limit: 1,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        customer_id: customerId,
        description: `Re-engagement offer for customer`,
      });

      if (error) throw error;

      // Also add a note about the offer
      await (supabase as any).from('customer_notes').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        content: `Re-engagement promotional offer created: ${discountPercent}% off with code ${code.toUpperCase()} (expires in ${expiresInDays} days)`,
        note_type: 're-engagement',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Offer created',
        description: 'Promotional offer has been created for the customer.',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.coupons.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerNotes.all });
    },
    onError: (error) => {
      logger.error('[ReEngagement] Failed to create offer', error);
      toast({
        title: 'Error',
        description: 'Failed to create promotional offer. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Hook: Send Re-engagement Message
// ============================================================================

function useSendMessage(tenantId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      customerId,
      message,
      channel,
    }: {
      customerId: string;
      message: string;
      channel: 'sms' | 'email';
    }) => {
      if (!tenantId) throw new Error('No tenant ID');

      // Log the communication attempt
      const { error } = await (supabase as any).from('communication_logs').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        type: channel,
        subject: 'Re-engagement outreach',
        content: message,
        status: 'queued',
        direction: 'outbound',
      });

      if (error) throw error;

      // Add note about the message
      await (supabase as any).from('customer_notes').insert({
        tenant_id: tenantId,
        customer_id: customerId,
        content: `Re-engagement ${channel.toUpperCase()} sent: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
        note_type: 're-engagement',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Message queued',
        description: 'Re-engagement message has been queued for delivery.',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerNotes.all });
    },
    onError: (error) => {
      logger.error('[ReEngagement] Failed to send message', error);
      toast({
        title: 'Error',
        description: 'Failed to queue message. Please try again.',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Customer Card Component
// ============================================================================

function CustomerCard({
  customer,
  onCreateOffer,
  onSendMessage,
  onAddNote,
  onNavigate,
  compact,
}: {
  customer: AtRiskCustomer;
  onCreateOffer: (customer: AtRiskCustomer) => void;
  onSendMessage: (customer: AtRiskCustomer) => void;
  onAddNote: (customer: AtRiskCustomer) => void;
  onNavigate: (customerId: string) => void;
  compact?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = RISK_LEVEL_CONFIG[customer.riskLevel];
  const RiskIcon = config.icon;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          'border rounded-lg transition-colors',
          isExpanded && 'ring-1 ring-primary/20',
          config.bgColor.replace('dark:', '').includes('amber') && 'border-amber-200 dark:border-amber-800/50',
          config.bgColor.replace('dark:', '').includes('red') && 'border-red-200 dark:border-red-800/50'
        )}
      >
        <CollapsibleTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors',
              compact ? 'p-2' : 'p-3'
            )}
          >
            {/* Risk indicator */}
            <div className={cn('p-2 rounded-full', config.bgColor)}>
              <RiskIcon className={cn('h-4 w-4', config.color)} />
            </div>

            {/* Customer info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{customer.name}</span>
                <Badge variant="outline" className={cn('text-xs', config.color)}>
                  {config.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {customer.daysSinceLastOrder} days since last order
                </span>
                {customer.orderFrequencyDays && (
                  <span className="flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Usually orders every {customer.orderFrequencyDays} days
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="text-center">
                <div className="font-medium">{customer.totalOrders}</div>
                <div className="text-xs text-muted-foreground">Orders</div>
              </div>
              <div className="text-center">
                <div className="font-medium">{formatCurrency(customer.totalSpent)}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Expand button */}
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Total Orders</div>
                  <div className="font-medium">{customer.totalOrders}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Total Spent</div>
                  <div className="font-medium">{formatCurrency(customer.totalSpent)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Avg. Order</div>
                  <div className="font-medium">{formatCurrency(customer.averageOrderValue)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Last Order</div>
                  <div className="font-medium">
                    {customer.lastOrderDate
                      ? formatDistanceToNow(new Date(customer.lastOrderDate), { addSuffix: true })
                      : 'Never'}
                  </div>
                </div>
              </div>
            </div>

            {/* Top products */}
            {customer.topProducts.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Previously Purchased
                </div>
                <div className="flex flex-wrap gap-2">
                  {customer.topProducts.map((product, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {product.name} ({product.quantity}x)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => onCreateOffer(customer)}
                      className="gap-1"
                    >
                      <Gift className="h-4 w-4" />
                      Create Offer
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a personalized promotional offer</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSendMessage(customer)}
                      className="gap-1"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Send Message
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send a re-engagement message</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddNote(customer)}
                      className="gap-1"
                    >
                      <StickyNote className="h-4 w-4" />
                      Add Note
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Add a note about this customer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1" />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onNavigate(customer.id)}
                className="gap-1 text-muted-foreground"
              >
                View Profile
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// Action Dialogs
// ============================================================================

function CreateOfferDialog({
  customer,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  customer: AtRiskCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { discountPercent: number; code: string; expiresInDays: number }) => void;
  isLoading: boolean;
}) {
  const [discountPercent, setDiscountPercent] = useState(15);
  const [code, setCode] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);

  // Generate code when customer changes
  const customerId = customer?.id;
  useEffect(() => {
    if (customerId) {
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      setCode(`COMEBACK${randomPart}`);
    }
  }, [customerId]);

  const handleSubmit = () => {
    if (customer) {
      onSubmit({ discountPercent, code, expiresInDays });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Promotional Offer</DialogTitle>
          <DialogDescription>
            Create a personalized discount for {customer?.name} to encourage them to return.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="discount">Discount Percentage</Label>
            <div className="flex items-center gap-2">
              <Input
                id="discount"
                type="number"
                min={5}
                max={50}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Suggested: {customer && customer.daysSinceLastOrder > 60 ? '20%' : '15%'} based on
              inactivity period
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Coupon Code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="COMEBACK123"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expires In (Days)</Label>
            <Select
              value={expiresInDays.toString()}
              onValueChange={(v) => setExpiresInDays(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !code}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Offer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendMessageDialog({
  customer,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  customer: AtRiskCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { message: string; channel: 'sms' | 'email' }) => void;
  isLoading: boolean;
}) {
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');

  // Set default message when customer changes
  const customerIdForMessage = customer?.id;
  const customerName = customer?.name;
  useEffect(() => {
    if (customerIdForMessage && customerName) {
      setMessage(
        `Hi ${customerName.split(' ')[0]}! We miss you at our store. Come back and enjoy great products. We have new items you might love!`
      );
    }
  }, [customerIdForMessage, customerName]);

  const handleSubmit = () => {
    if (customer && message.trim()) {
      onSubmit({ message, channel });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Re-engagement Message</DialogTitle>
          <DialogDescription>
            Reach out to {customer?.name} to encourage them to return.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as 'sms' | 'email')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms" disabled={!customer?.phone}>
                  SMS {!customer?.phone && '(no phone)'}
                </SelectItem>
                <SelectItem value="email" disabled={!customer?.email}>
                  Email {!customer?.email && '(no email)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Enter your message..."
            />
            <p className="text-xs text-muted-foreground">{message.length} characters</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !message.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Message'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddNoteDialog({
  customer,
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  customer: AtRiskCustomer | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (content: string) => void;
  isLoading: boolean;
}) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Re-engagement Note</DialogTitle>
          <DialogDescription>
            Add a note about re-engagement efforts for {customer?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="e.g., Reached out via phone, customer said they'll order next week..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !content.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Note'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReEngagement({
  riskFilter: initialRiskFilter = 'all',
  maxHeight = '600px',
  compact = false,
  className,
}: ReEngagementProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { navigateToAdmin } = useTenantNavigation();

  const [riskFilter, setRiskFilter] = useState<CustomerRiskLevel | 'all'>(initialRiskFilter);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    isOpen: false,
    type: null,
    customer: null,
  });

  // Data fetching
  const { data: customers, isLoading, isError, error, refetch } = useAtRiskCustomers(tenantId, riskFilter);

  // Mutations
  const addNoteMutation = useAddCustomerNote(tenantId);
  const createOfferMutation = useCreatePromoOffer(tenantId);
  const sendMessageMutation = useSendMessage(tenantId);

  // Counts for badges
  const atRiskCount = useMemo(
    () => customers?.filter((c) => c.riskLevel === 'at_risk').length || 0,
    [customers]
  );
  const churnedCount = useMemo(
    () => customers?.filter((c) => c.riskLevel === 'churned').length || 0,
    [customers]
  );

  // Handlers
  const handleCreateOffer = useCallback((customer: AtRiskCustomer) => {
    setActionDialog({ isOpen: true, type: 'offer', customer });
  }, []);

  const handleSendMessage = useCallback((customer: AtRiskCustomer) => {
    setActionDialog({ isOpen: true, type: 'message', customer });
  }, []);

  const handleAddNote = useCallback((customer: AtRiskCustomer) => {
    setActionDialog({ isOpen: true, type: 'note', customer });
  }, []);

  const handleNavigate = useCallback(
    (customerId: string) => {
      navigateToAdmin(`customers/${customerId}`);
    },
    [navigateToAdmin]
  );

  const closeDialog = useCallback(() => {
    setActionDialog({ isOpen: false, type: null, customer: null });
  }, []);

  const handleOfferSubmit = useCallback(
    (data: { discountPercent: number; code: string; expiresInDays: number }) => {
      if (actionDialog.customer) {
        createOfferMutation.mutate(
          { customerId: actionDialog.customer.id, ...data },
          { onSuccess: closeDialog }
        );
      }
    },
    [actionDialog.customer, createOfferMutation, closeDialog]
  );

  const handleMessageSubmit = useCallback(
    (data: { message: string; channel: 'sms' | 'email' }) => {
      if (actionDialog.customer) {
        sendMessageMutation.mutate(
          { customerId: actionDialog.customer.id, ...data },
          { onSuccess: closeDialog }
        );
      }
    },
    [actionDialog.customer, sendMessageMutation, closeDialog]
  );

  const handleNoteSubmit = useCallback(
    (content: string) => {
      if (actionDialog.customer) {
        addNoteMutation.mutate(
          { customerId: actionDialog.customer.id, content },
          { onSuccess: closeDialog }
        );
      }
    },
    [actionDialog.customer, addNoteMutation, closeDialog]
  );

  // Render content
  const renderContent = (): ReactNode => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (isError) {
      return (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
          <p className="text-sm text-muted-foreground">Failed to load at-risk customers.</p>
          <p className="text-xs text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (!customers || customers.length === 0) {
      return (
        <div className="text-center py-8">
          <UserX className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-sm font-medium">No at-risk customers found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Great news! All your customers are actively ordering.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            onCreateOffer={handleCreateOffer}
            onSendMessage={handleSendMessage}
            onAddNote={handleAddNote}
            onNavigate={handleNavigate}
            compact={compact}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className={cn('bg-[hsl(var(--tenant-bg))]', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-muted-foreground" />
              Customer Re-engagement
            </CardTitle>
            <CardDescription>
              Identify and re-engage at-risk and churned customers
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filter controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter:</span>
          </div>
          <Select
            value={riskFilter}
            onValueChange={(v) => setRiskFilter(v as CustomerRiskLevel | 'all')}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All ({(atRiskCount + churnedCount) || 0})
              </SelectItem>
              <SelectItem value="at_risk">
                At Risk ({atRiskCount})
              </SelectItem>
              <SelectItem value="churned">
                Churned ({churnedCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Customer list */}
        <ScrollArea style={{ maxHeight }}>{renderContent()}</ScrollArea>
      </CardContent>

      {/* Action dialogs */}
      <CreateOfferDialog
        customer={actionDialog.type === 'offer' ? actionDialog.customer : null}
        isOpen={actionDialog.type === 'offer' && actionDialog.isOpen}
        onClose={closeDialog}
        onSubmit={handleOfferSubmit}
        isLoading={createOfferMutation.isPending}
      />

      <SendMessageDialog
        customer={actionDialog.type === 'message' ? actionDialog.customer : null}
        isOpen={actionDialog.type === 'message' && actionDialog.isOpen}
        onClose={closeDialog}
        onSubmit={handleMessageSubmit}
        isLoading={sendMessageMutation.isPending}
      />

      <AddNoteDialog
        customer={actionDialog.type === 'note' ? actionDialog.customer : null}
        isOpen={actionDialog.type === 'note' && actionDialog.isOpen}
        onClose={closeDialog}
        onSubmit={handleNoteSubmit}
        isLoading={addNoteMutation.isPending}
      />
    </Card>
  );
}

export default ReEngagement;
