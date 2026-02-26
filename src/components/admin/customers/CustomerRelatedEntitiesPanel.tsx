/**
 * CustomerRelatedEntitiesPanel Component
 *
 * Displays all related entities for a customer in a unified panel with lazy-loading:
 * - Recent orders (links to order detail)
 * - Active deliveries (links to delivery tracking)
 * - Outstanding payments (links to payment management)
 * - Applicable special pricing (links to pricing rules)
 * - Loyalty tier and points
 * - Communication preferences
 * - Associated organization
 * - Saved menus (customer's favorite disposable menus)
 *
 * Uses accordion pattern with lazy-loading for efficient data fetching.
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ShoppingBag,
  Truck,
  CreditCard,
  DollarSign,
  Award,
  Bell,
  Building2,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Star,
  Crown,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/utils/formatDate';
import {
  TIER_DISPLAY_INFO,
  type LoyaltyTier,
} from '@/hooks/useCustomerLoyalty';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface CustomerRelatedEntitiesPanelProps {
  customerId: string;
  className?: string;
}

interface RelatedEntityItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  meta?: string;
}

interface LazyQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  enabled: boolean;
  enable: () => void;
}

// ============================================================================
// Lazy Query Hook
// ============================================================================

function useLazyQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  deps: { tenantId: string | undefined; customerId: string | undefined }
): LazyQueryResult<T> {
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn,
    enabled: enabled && !!deps.tenantId && !!deps.customerId,
    staleTime: 30_000,
  });

  const enable = useCallback(() => {
    setEnabled(true);
  }, []);

  return {
    data,
    isLoading,
    error: error as Error | null,
    enabled,
    enable,
  };
}

// ============================================================================
// Related Entity Hooks
// ============================================================================

function useRelatedOrders(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'orders'],
    async (): Promise<RelatedEntityItem[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, created_at')
        .eq('customer_id', customerId!)
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch customer orders', error, { customerId, tenantId });
        throw error;
      }

      return (data ?? []).map((order) => ({
        id: order.id,
        title: order.order_number ? `Order #${order.order_number}` : `Order #${order.id.slice(0, 8)}`,
        subtitle: formatSmartDate(order.created_at),
        status: order.status,
        statusVariant: getOrderStatusVariant(order.status),
        meta: formatCurrency(order.total_amount ?? 0),
      }));
    },
    { tenantId, customerId }
  );
}

function useRelatedDeliveries(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'deliveries'],
    async (): Promise<RelatedEntityItem[]> => {
      // Get orders for this customer first, then get deliveries
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_id', customerId!)
        .eq('tenant_id', tenantId!);

      if (ordersError) {
        logger.error('Failed to fetch customer orders for deliveries', ordersError, { customerId, tenantId });
        throw ordersError;
      }

      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map((o) => o.id);

      const { data, error } = await supabase
        .from('wholesale_deliveries')
        .select('id, status, scheduled_at, delivered_at, order_id')
        .in('order_id', orderIds)
        .eq('tenant_id', tenantId!)
        .in('status', ['pending', 'assigned', 'in_transit'])
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch customer deliveries', error, { customerId, tenantId });
        throw error;
      }

      return (data ?? []).map((delivery) => ({
        id: delivery.id,
        title: `Delivery for Order #${delivery.order_id?.slice(0, 8) || 'N/A'}`,
        subtitle: delivery.scheduled_at
          ? `Scheduled: ${formatSmartDate(delivery.scheduled_at)}`
          : 'Not scheduled',
        status: delivery.status,
        statusVariant: getDeliveryStatusVariant(delivery.status),
      }));
    },
    { tenantId, customerId }
  );
}

function useRelatedPayments(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'payments'],
    async (): Promise<RelatedEntityItem[]> => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, amount, payment_method, payment_status, created_at')
        .eq('customer_id', customerId!)
        .neq('payment_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Failed to fetch customer outstanding payments', error, { customerId, tenantId });
        throw error;
      }

      return (data ?? []).map((payment) => ({
        id: payment.id,
        title: formatCurrency(payment.amount ?? 0),
        subtitle: `${payment.payment_method || 'Unknown'} - ${formatSmartDate(payment.created_at)}`,
        status: payment.payment_status,
        statusVariant: getPaymentStatusVariant(payment.payment_status),
      }));
    },
    { tenantId, customerId }
  );
}

function useRelatedSpecialPricing(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'special-pricing'],
    async (): Promise<RelatedEntityItem[]> => {
      const { data, error } = await supabase
        .from('customer_pricing')
        .select(`
          id,
          discount_type,
          discount_value,
          is_active,
          start_date,
          end_date,
          product:products(name)
        `)
        .eq('customer_id', customerId!)
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .limit(10);

      if (error) {
        logger.error('Failed to fetch customer special pricing', error, { customerId, tenantId });
        throw error;
      }

      const now = new Date();
      return (data ?? [])
        .filter((rule) => {
          // Filter by date range if set
          if (rule.start_date && new Date(rule.start_date) > now) return false;
          if (rule.end_date && new Date(rule.end_date) < now) return false;
          return true;
        })
        .map((rule) => {
          const productName = (rule.product as { name?: string } | null)?.name || 'Unknown Product';
          const discount =
            rule.discount_type === 'percentage'
              ? `${rule.discount_value}% off`
              : formatCurrency(rule.discount_value);

          return {
            id: rule.id,
            title: productName,
            subtitle: discount,
            status: 'Active',
            statusVariant: 'default' as const,
            meta: rule.end_date ? `Until ${format(new Date(rule.end_date), 'MMM d')}` : undefined,
          };
        });
    },
    { tenantId, customerId }
  );
}

interface LoyaltyInfo {
  tier: LoyaltyTier;
  currentPoints: number;
  lifetimePoints: number;
  pointsToNextTier: number | null;
  nextTier: LoyaltyTier | null;
}

function useRelatedLoyalty(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery<LoyaltyInfo | null>(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'loyalty'],
    async (): Promise<LoyaltyInfo | null> => {
      // Get loyalty points
      const { data: pointsData, error: pointsError } = await supabase
        .from('loyalty_points')
        .select('points, type')
        .eq('customer_id', customerId!)
        .eq('tenant_id', tenantId!);

      if (pointsError) {
        logger.error('Failed to fetch customer loyalty points', pointsError, { customerId, tenantId });
        throw pointsError;
      }

      // Get loyalty config for tier thresholds
      const { data: config, error: configError } = await supabase
        .from('loyalty_config')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();

      if (configError) {
        logger.error('Failed to fetch loyalty config', configError, { tenantId });
        throw configError;
      }

      const configRecord = config as Record<string, unknown> | null;

      if (!pointsData || pointsData.length === 0) {
        return {
          tier: 'bronze',
          currentPoints: 0,
          lifetimePoints: 0,
          pointsToNextTier: (configRecord?.silver_threshold as number) || 500,
          nextTier: 'silver',
        };
      }

      let currentPoints = 0;
      let lifetimePoints = 0;

      for (const tx of pointsData as Array<{ points: number; type: string }>) {
        currentPoints += tx.points;
        if (tx.type === 'earned' || tx.type === 'bonus') {
          lifetimePoints += tx.points;
        }
      }

      currentPoints = Math.max(0, currentPoints);
      lifetimePoints = Math.max(0, lifetimePoints);

      // Calculate tier
      const silverThreshold = (configRecord?.silver_threshold as number) || 500;
      const goldThreshold = (configRecord?.gold_threshold as number) || 2000;
      const platinumThreshold = (configRecord?.platinum_threshold as number) || 5000;

      let tier: LoyaltyTier = 'bronze';
      let nextTier: LoyaltyTier | null = 'silver';
      let pointsToNextTier: number | null = silverThreshold - lifetimePoints;

      if (lifetimePoints >= platinumThreshold) {
        tier = 'platinum';
        nextTier = null;
        pointsToNextTier = null;
      } else if (lifetimePoints >= goldThreshold) {
        tier = 'gold';
        nextTier = 'platinum';
        pointsToNextTier = platinumThreshold - lifetimePoints;
      } else if (lifetimePoints >= silverThreshold) {
        tier = 'silver';
        nextTier = 'gold';
        pointsToNextTier = goldThreshold - lifetimePoints;
      }

      return {
        tier,
        currentPoints,
        lifetimePoints,
        pointsToNextTier,
        nextTier,
      };
    },
    { tenantId, customerId }
  );
}

interface CommunicationPrefs {
  email_marketing: boolean;
  sms_marketing: boolean;
  push_notifications: boolean;
  order_updates: boolean;
}

function useRelatedCommunicationPrefs(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery<CommunicationPrefs | null>(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'comm-prefs'],
    async (): Promise<CommunicationPrefs | null> => {
      try {
        const { data, error } = await supabase
          .from('customer_communication_preferences')
          .select('email_marketing, sms_marketing, push_notifications, order_updates')
          .eq('customer_id', customerId!)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (error) {
          // Table might not exist - return defaults instead of throwing
          logger.debug('Communication preferences not available', { customerId, tenantId });
          return null;
        }

        return data as unknown as CommunicationPrefs | null;
      } catch {
        // Gracefully handle missing table
        logger.debug('Communication preferences table not available', { customerId, tenantId });
        return null;
      }
    },
    { tenantId, customerId }
  );
}

interface OrganizationInfo {
  id: string;
  name: string;
  type: string | null;
}

function useRelatedOrganization(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery<OrganizationInfo | null>(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'organization'],
    async (): Promise<OrganizationInfo | null> => {
      try {
        // Get customer's organization_id (column might not exist)
        const { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('organization_id')
          .eq('id', customerId!)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (customerError) {
          // Column might not exist - return null gracefully
          logger.debug('Organization relationship not available', { customerId, tenantId });
          return null;
        }

        const orgId = (customer as { organization_id?: string } | null)?.organization_id;
        if (!orgId) return null;

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, type')
          .eq('id', orgId)
          .eq('tenant_id', tenantId!)
          .maybeSingle();

        if (orgError) {
          logger.debug('Failed to fetch organization', { organizationId: orgId });
          return null;
        }

        return org as unknown as OrganizationInfo | null;
      } catch {
        // Gracefully handle missing table/column
        logger.debug('Organization data not available', { customerId, tenantId });
        return null;
      }
    },
    { tenantId, customerId }
  );
}

function useRelatedMenus(customerId: string | undefined, tenantId: string | undefined) {
  return useLazyQuery(
    [...queryKeys.customers.related(tenantId ?? '', customerId ?? ''), 'saved-menus'],
    async (): Promise<RelatedEntityItem[]> => {
      // Get menus that the customer has ordered from
      const { data: orders, error: ordersError } = await supabase
        .from('menu_orders')
        .select(`
          menu_id,
          disposable_menus:menu_id(id, name, is_active)
        `)
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (ordersError) {
        logger.error('Failed to fetch customer menu orders', ordersError, { customerId, tenantId });
        throw ordersError;
      }

      // Deduplicate by menu_id and filter to active menus
      const uniqueMenus = new Map<string, { id: string; name: string }>();

      for (const order of orders ?? []) {
        const menu = (order as unknown as Record<string, unknown>).disposable_menus as { id: string; name: string; is_active: boolean } | null;
        if (menu && menu.is_active && !uniqueMenus.has(menu.id)) {
          uniqueMenus.set(menu.id, { id: menu.id, name: menu.name });
        }
      }

      return Array.from(uniqueMenus.values())
        .slice(0, 5)
        .map((menu) => ({
          id: menu.id,
          title: menu.name,
          status: 'Active',
          statusVariant: 'default' as const,
        }));
    },
    { tenantId, customerId }
  );
}

// ============================================================================
// Status Variant Helpers
// ============================================================================

function getOrderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
    case 'delivered':
      return 'default';
    case 'cancelled':
    case 'refunded':
      return 'destructive';
    case 'processing':
    case 'confirmed':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getDeliveryStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'delivered':
      return 'default';
    case 'failed':
    case 'cancelled':
      return 'destructive';
    case 'in_transit':
    case 'assigned':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getPaymentStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
    case 'paid':
      return 'default';
    case 'failed':
    case 'refunded':
      return 'destructive';
    case 'pending':
    case 'processing':
      return 'secondary';
    default:
      return 'outline';
  }
}

// ============================================================================
// UI Components
// ============================================================================

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EntityRow({
  item,
  onNavigate,
}: {
  item: RelatedEntityItem;
  onNavigate?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 border rounded-lg',
        onNavigate && 'hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
      onClick={() => onNavigate?.(item.id)}
      role={onNavigate ? 'button' : undefined}
      tabIndex={onNavigate ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate?.(item.id)}
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">{item.title}</div>
        {item.subtitle && (
          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3 shrink-0">
        {item.status && (
          <Badge variant={item.statusVariant || 'secondary'} className="text-xs capitalize">
            {item.status.replace('_', ' ')}
          </Badge>
        )}
        {item.meta && (
          <span className="text-xs text-muted-foreground font-medium">{item.meta}</span>
        )}
        {onNavigate && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
      </div>
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-4">{message}</div>
  );
}

function ErrorSection({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive p-3 border border-destructive/20 rounded-lg">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ============================================================================
// Loyalty Section Component
// ============================================================================

function LoyaltySection({
  data,
  isLoading,
  error,
}: {
  data: LoyaltyInfo | null | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <SectionSkeleton />;
  if (error) return <ErrorSection message="Failed to load loyalty information" />;
  if (!data) return <EmptySection message="No loyalty data available" />;

  const tierInfo = TIER_DISPLAY_INFO[data.tier];

  return (
    <div className="space-y-3">
      {/* Tier Display */}
      <div className={cn('p-4 rounded-lg border', tierInfo.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.tier === 'platinum' ? (
              <Crown className={cn('h-5 w-5', tierInfo.color)} />
            ) : (
              <Star className={cn('h-5 w-5', tierInfo.color)} />
            )}
            <span className={cn('font-semibold', tierInfo.color)}>{tierInfo.label} Tier</span>
          </div>
          <Badge variant="secondary">{data.currentPoints} pts</Badge>
        </div>

        {data.nextTier && data.pointsToNextTier !== null && (
          <div className="mt-2 text-xs text-muted-foreground">
            {data.pointsToNextTier} points to {TIER_DISPLAY_INFO[data.nextTier].label}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 border rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Current Balance</div>
          <div className="text-lg font-bold">{data.currentPoints}</div>
        </div>
        <div className="p-3 border rounded-lg text-center">
          <div className="text-xs text-muted-foreground">Lifetime Earned</div>
          <div className="text-lg font-bold">{data.lifetimePoints}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Communication Preferences Section
// ============================================================================

function CommPrefsSection({
  data,
  isLoading,
  error,
}: {
  data: CommunicationPrefs | null | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <SectionSkeleton />;
  if (error) return <ErrorSection message="Failed to load communication preferences" />;

  const prefs = data || {
    email_marketing: true,
    sms_marketing: true,
    push_notifications: true,
    order_updates: true,
  };

  const prefItems = [
    { key: 'email_marketing', label: 'Email Marketing', value: prefs.email_marketing },
    { key: 'sms_marketing', label: 'SMS Marketing', value: prefs.sms_marketing },
    { key: 'push_notifications', label: 'Push Notifications', value: prefs.push_notifications },
    { key: 'order_updates', label: 'Order Updates', value: prefs.order_updates },
  ];

  return (
    <div className="space-y-2">
      {prefItems.map((pref) => (
        <div key={pref.key} className="flex items-center justify-between p-2 border rounded-lg">
          <span className="text-sm">{pref.label}</span>
          {pref.value ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Enabled
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" />
              Disabled
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Organization Section
// ============================================================================

function OrganizationSection({
  data,
  isLoading,
  error,
  onNavigate,
}: {
  data: OrganizationInfo | null | undefined;
  isLoading: boolean;
  error: Error | null;
  onNavigate: (id: string) => void;
}) {
  if (isLoading) return <SectionSkeleton />;
  if (error) return <ErrorSection message="Failed to load organization" />;
  if (!data) return <EmptySection message="Not associated with any organization" />;

  return (
    <div
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onNavigate(data.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(data.id)}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium text-sm">{data.name}</div>
          {data.type && (
            <div className="text-xs text-muted-foreground capitalize">{data.type}</div>
          )}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomerRelatedEntitiesPanel({
  customerId,
  className,
}: CustomerRelatedEntitiesPanelProps) {
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { navigateToAdmin } = useTenantNavigation();

  // Lazy-loading hooks for each section
  const orders = useRelatedOrders(customerId, tenantId);
  const deliveries = useRelatedDeliveries(customerId, tenantId);
  const payments = useRelatedPayments(customerId, tenantId);
  const pricing = useRelatedSpecialPricing(customerId, tenantId);
  const loyalty = useRelatedLoyalty(customerId, tenantId);
  const commPrefs = useRelatedCommunicationPrefs(customerId, tenantId);
  const organization = useRelatedOrganization(customerId, tenantId);
  const menus = useRelatedMenus(customerId, tenantId);

  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const handleValueChange = useCallback(
    (value: string[]) => {
      // Enable data fetching for newly expanded sections
      const newlyExpanded = value.filter((v) => !expandedSections.includes(v));

      newlyExpanded.forEach((section) => {
        switch (section) {
          case 'orders':
            orders.enable();
            break;
          case 'deliveries':
            deliveries.enable();
            break;
          case 'payments':
            payments.enable();
            break;
          case 'pricing':
            pricing.enable();
            break;
          case 'loyalty':
            loyalty.enable();
            break;
          case 'comm-prefs':
            commPrefs.enable();
            break;
          case 'organization':
            organization.enable();
            break;
          case 'menus':
            menus.enable();
            break;
        }
      });

      setExpandedSections(value);
    },
    [expandedSections, orders, deliveries, payments, pricing, loyalty, commPrefs, organization, menus]
  );

  // Navigation handlers
  const handleNavigateToOrder = (orderId: string) => navigateToAdmin(`orders/${orderId}`);
  const handleNavigateToDelivery = (deliveryId: string) => navigateToAdmin(`deliveries/${deliveryId}`);
  const handleNavigateToPayment = (paymentId: string) => navigateToAdmin(`payments/${paymentId}`);
  const handleNavigateToPricing = () => navigateToAdmin(`customers/${customerId}/pricing`);
  const handleNavigateToOrganization = (orgId: string) => navigateToAdmin(`organizations/${orgId}`);
  const handleNavigateToMenu = (menuId: string) => navigateToAdmin(`menus/${menuId}`);

  const sections = [
    {
      key: 'orders',
      label: 'Recent Orders',
      icon: ShoppingBag,
      query: orders,
      onNavigate: handleNavigateToOrder,
      emptyMessage: 'No orders found',
    },
    {
      key: 'deliveries',
      label: 'Active Deliveries',
      icon: Truck,
      query: deliveries,
      onNavigate: handleNavigateToDelivery,
      emptyMessage: 'No active deliveries',
    },
    {
      key: 'payments',
      label: 'Outstanding Payments',
      icon: CreditCard,
      query: payments,
      onNavigate: handleNavigateToPayment,
      emptyMessage: 'No outstanding payments',
    },
    {
      key: 'pricing',
      label: 'Special Pricing',
      icon: DollarSign,
      query: pricing,
      onNavigate: handleNavigateToPricing,
      emptyMessage: 'No special pricing rules',
    },
    {
      key: 'menus',
      label: 'Saved Menus',
      icon: FileText,
      query: menus,
      onNavigate: handleNavigateToMenu,
      emptyMessage: 'No saved menus',
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Related Entities
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion
          type="multiple"
          value={expandedSections}
          onValueChange={handleValueChange}
        >
          {/* Standard entity sections */}
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const itemCount = section.query.data?.length;

            return (
              <AccordionItem key={section.key} value={section.key}>
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <SectionIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{section.label}</span>
                    {section.query.enabled && itemCount !== undefined && (
                      <Badge variant="secondary" className="text-xs ml-1 h-5 px-1.5">
                        {itemCount}
                      </Badge>
                    )}
                    {section.query.isLoading && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {section.query.isLoading && <SectionSkeleton />}
                  {section.query.error && (
                    <ErrorSection message={`Failed to load ${section.label.toLowerCase()}`} />
                  )}
                  {!section.query.isLoading && !section.query.error && section.query.data?.length === 0 && (
                    <EmptySection message={section.emptyMessage} />
                  )}
                  {!section.query.isLoading &&
                    !section.query.error &&
                    section.query.data &&
                    section.query.data.length > 0 && (
                      <div className="space-y-2">
                        {section.query.data.map((item) => (
                          <EntityRow
                            key={item.id}
                            item={item}
                            onNavigate={section.onNavigate}
                          />
                        ))}
                      </div>
                    )}
                </AccordionContent>
              </AccordionItem>
            );
          })}

          {/* Loyalty Section */}
          <AccordionItem value="loyalty">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm">
                <Award className="h-4 w-4 text-muted-foreground" />
                <span>Loyalty Tier</span>
                {loyalty.isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <LoyaltySection
                data={loyalty.data}
                isLoading={loyalty.isLoading}
                error={loyalty.error}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Communication Preferences Section */}
          <AccordionItem value="comm-prefs">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span>Communication Preferences</span>
                {commPrefs.isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <CommPrefsSection
                data={commPrefs.data}
                isLoading={commPrefs.isLoading}
                error={commPrefs.error}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Organization Section */}
          <AccordionItem value="organization">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Associated Organization</span>
                {organization.isLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <OrganizationSection
                data={organization.data}
                isLoading={organization.isLoading}
                error={organization.error}
                onNavigate={handleNavigateToOrganization}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
