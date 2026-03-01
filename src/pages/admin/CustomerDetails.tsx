import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useEncryption } from '@/lib/hooks/useEncryption';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { humanizeError } from '@/lib/humanizeError';
import {
  ArrowLeft, User, Mail, Phone, Calendar,
  DollarSign, Star, ShoppingBag, CreditCard, MessageSquare, Store, MessageCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SEOHead } from '@/components/SEOHead';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbContext';
import { ActivityTimeline } from '@/components/crm/ActivityTimeline';
import { CommunicationHistory } from '@/components/crm/CommunicationHistory';
import { ContactCard } from '@/components/crm/ContactCard';
import { SwipeBackWrapper } from '@/components/mobile/SwipeBackWrapper';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { CustomerInvoicesTab } from '@/components/admin/customers/CustomerInvoicesTab';
import { CustomerOrderHistoryTab } from '@/components/admin/customers/CustomerOrderHistoryTab';
import { CustomerPaymentHistoryTab } from '@/components/admin/customers/CustomerPaymentHistoryTab';
import { CustomerDeliveryAddressesTab } from '@/components/admin/customers/CustomerDeliveryAddressesTab';
import { CustomerDeliveryMap } from '@/components/admin/customers/CustomerDeliveryMap';
import { CustomerPreferredProducts } from '@/components/admin/customers/CustomerPreferredProducts';
import { CustomerRelatedEntitiesPanel } from '@/components/admin/customers/CustomerRelatedEntitiesPanel';
import { CustomerComplianceVerification } from '@/components/admin/customers/CustomerComplianceVerification';
import { DisabledTooltip } from '@/components/shared/DisabledTooltip';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { isValidUUID } from '@/lib/utils/uuidValidation';
import { displayName, displayValue, formatSmartDate } from '@/lib/formatters';

interface Customer {
  id: string;
  account_id: string;
  tenant_id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  customer_type: string;
  date_of_birth: string;
  address: string;
  city?: string;
  state?: string;
  medical_card_number?: string;
  medical_card_expiration?: string;
  total_spent: number;
  total_orders?: number;
  loyalty_points: number;
  last_purchase_at: string;
  created_at: string;
  preferred_contact?: string;
  referral_source?: string;
  source?: string;
  type?: string;
  admin_notes?: string;
}

export default function CustomerDetails() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = rawId && isValidUUID(rawId) ? rawId : undefined;
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  useEncryption();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<unknown[]>([]);
  const [storefrontOrderCount, setStorefrontOrderCount] = useState(0);
  const [storefrontOrderTotal, setStorefrontOrderTotal] = useState(0);
  const [storefrontFirstOrder, setStorefrontFirstOrder] = useState<string | null>(null);
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; created_at: string; payment_method: string; payment_status: string }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; created_at: string; note: string; profiles?: { full_name: string } }>>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [firstOrderDate, setFirstOrderDate] = useState<string | null>(null);
  const [storeCreditDialogOpen, setStoreCreditDialogOpen] = useState(false);
  const [storeCreditAmount, setStoreCreditAmount] = useState('');

  // Get tenant_id from tenant context or customer data
  const tenantId = tenant?.id || customer?.tenant_id;

  // Set breadcrumb label to show customer name
  useBreadcrumbLabel(
    customer ? displayName(customer.first_name, customer.last_name) : null
  );

  // Use the customer credit hook for credit balance management
  const {
    balance: storeCredit,
    addCredit,
    isAddingCredit,
    refetch: refetchCredit,
  } = useCustomerCredit(id);

  useEffect(() => {
    if (id) {
      loadCustomerData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadCustomerData is defined below, only run when id changes
  }, [id]);

  const loadCustomerData = async () => {
    try {
      // Load customer
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId) // Ensure customer belongs to current tenant
        .maybeSingle();

      if (customerError) throw customerError;

      // Customer data is NOT encrypted - use plaintext fields directly
      setCustomer(customerData as Customer);

      // Load orders (filter by tenant_id)
      const ordersQuery = supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(name, price)
          )
        `)
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (tenantId) {
        ordersQuery.eq('tenant_id', tenantId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;
      setOrders(ordersData ?? []);

      // Compute first order date (orders are sorted desc, so last element is earliest)
      if (ordersData && ordersData.length > 0) {
        const earliest = ordersData[ordersData.length - 1];
        setFirstOrderDate((earliest as Record<string, unknown>).created_at as string ?? null);
      } else {
        setFirstOrderDate(null);
      }

      // Load storefront orders from marketplace_orders if customer has an email
      if (customerData?.email && tenantId) {
        const { data: sfOrders, error: sfError } = await supabase
          .from('marketplace_orders')
          .select('id, total_amount, created_at')
          .eq('seller_tenant_id', tenantId)
          .eq('customer_email', customerData.email)
          .not('store_id', 'is', null)
          .order('created_at', { ascending: true });

        if (!sfError && sfOrders && sfOrders.length > 0) {
          setStorefrontOrderCount(sfOrders.length);
          setStorefrontOrderTotal(sfOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0));
          setStorefrontFirstOrder(sfOrders[0].created_at);
        } else {
          setStorefrontOrderCount(0);
          setStorefrontOrderTotal(0);
          setStorefrontFirstOrder(null);
        }
      }

      // Load payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData ?? []);

      // Load notes (customer_notes not in generated types)
      const notesResult = await (supabase
        .from('customer_notes')
        .select('id, created_at, note, note_type')
        .eq('customer_id', id as string)
        .order('created_at', { ascending: false })) as {
          data: Array<{ id: string; created_at: string; note: string; note_type: string }> | null;
          error: unknown;
        };

      if (notesResult.error) throw notesResult.error;
      setNotes((notesResult.data ?? []).map((n) => ({
        id: n.id,
        created_at: n.created_at,
        note: n.note,
      })));

      // Calculate outstanding balance (total orders - total payments)
      const ordersTotal = (ordersData ?? []).reduce((sum, order) => sum + (order.total_amount ?? 0), 0);
      const paymentsTotal = (paymentsData ?? []).reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
      setOutstandingBalance(Math.max(0, ordersTotal - paymentsTotal));
    } catch (error) {
      logger.error('Error loading customer data', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerDetails' });
      toast.error('Failed to load customer data', { description: humanizeError(error) });
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { error } = await supabase.from('customer_notes').insert({
        account_id: customer?.account_id ?? '',
        customer_id: id ?? '',
        note: newNote,
        note_type: 'general'
      });

      if (error) throw error;

      toast.success('Note added successfully');
      setNewNote('');
      loadCustomerData();
    } catch (error) {
      logger.error('Error adding note', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerDetails' });
      toast.error('Failed to add note', { description: humanizeError(error) });
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 dark:bg-zinc-900 p-4 sm:p-4">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-4">
          {/* Header skeleton */}
          <div className="mb-4 sm:mb-8">
            <Skeleton className="h-9 w-24 sm:w-40 mb-4" />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <Skeleton className="w-14 h-14 sm:w-20 sm:h-20 rounded-full shrink-0" />
                <div className="space-y-3 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Skeleton className="h-6 sm:h-8 w-36 sm:w-48" />
                    <Skeleton className="h-5 sm:h-6 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48 sm:w-56" />
                  <Skeleton className="h-4 w-32 sm:w-40" />
                  <Skeleton className="h-4 w-40 sm:w-52" />
                </div>
              </div>
              <Skeleton className="h-11 w-full sm:w-28" />
            </div>
          </div>

          {/* Stats cards skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-3 sm:pt-6 sm:px-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2 min-w-0">
                      <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
                      <Skeleton className="h-6 sm:h-8 w-20 sm:w-32" />
                    </div>
                    <Skeleton className="h-8 w-8 sm:h-12 sm:w-12 rounded-lg shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs skeleton */}
          <div className="space-y-4 sm:space-y-4">
            <div className="flex gap-1 sm:gap-2 flex-wrap overflow-x-auto">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 sm:h-9 w-20 sm:w-24 rounded-md shrink-0" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card className="shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2 shadow-sm">
                <CardContent className="pt-6 space-y-4">
                  <Skeleton className="h-5 w-40" />
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p>Customer not found</p>
      </div>
    );
  }

  const totalPayments = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  // Customer Lifetime Value: combine wholesale + storefront orders
  const wholesaleOrdersCount = orders.length;
  const wholesaleSpent: number = orders.reduce<number>((sum, o) => sum + (Number((o as Record<string, unknown>).total_amount) ?? 0), 0);
  const totalOrdersCount = wholesaleOrdersCount + storefrontOrderCount;
  const totalSpentCombined = wholesaleSpent + storefrontOrderTotal;
  const computedTotalSpent: number = totalSpentCombined > 0 ? totalSpentCombined : Number(customer?.total_spent ?? 0);
  const averageOrderValue: number = totalOrdersCount > 0 ? computedTotalSpent / totalOrdersCount : 0;

  // Earliest order across both sources
  const combinedFirstOrder = (() => {
    const dates = [firstOrderDate, storefrontFirstOrder].filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.reduce((earliest, d) => new Date(d) < new Date(earliest) ? d : earliest);
  })();

  return (
    <SwipeBackWrapper onBack={() => navigateToAdmin('customer-management')}>
      <div className="min-h-dvh bg-gray-50 dark:bg-zinc-900 p-4 sm:p-4">
        <SEOHead title={`${displayName(customer.first_name, customer.last_name)} | Customer Details`} />

        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-4">
          {/* Header */}
          <div className="mb-4 sm:mb-8">
            <Button variant="ghost" onClick={() => navigateToAdmin('customer-management')} className="mb-4 min-h-[44px]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Back to Customers</span>
              <span className="sm:hidden">Back</span>
            </Button>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 sm:w-10 sm:h-10 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                      {displayName(customer.first_name, customer.last_name)}
                    </h1>
                    <Badge
                      className={customer.customer_type === 'medical'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/30'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-800'
                      }
                    >
                      {customer.customer_type === 'medical' ? 'Medical' : 'Recreational'}
                    </Badge>
                    {(customer.source === 'storefront' || customer.referral_source === 'storefront') && (
                      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/30">
                        <Store className="w-3 h-3 mr-1" />
                        Storefront
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-4 h-4 shrink-0" />
                      <span className="truncate" title={customer.email || undefined}>{displayValue(customer.email)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 shrink-0" />
                      {displayValue(customer.phone)}
                    </div>
                    {customer.preferred_contact && (
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        Prefers {customer.preferred_contact}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0" />
                      Member since {formatSmartDate(customer.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => navigateToAdmin(`customer-management/${id}/edit`)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white min-h-[44px] w-full sm:w-auto"
              >
                Edit Profile
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:pt-6 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Total Spent</p>
                    <p className="text-lg sm:text-2xl md:text-3xl font-bold font-mono text-[hsl(var(--tenant-text))] truncate">
                      ${computedTotalSpent.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:pt-6 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Total Orders</p>
                    <p className="text-lg sm:text-2xl md:text-3xl font-bold font-mono text-[hsl(var(--tenant-text))]">{totalOrdersCount}</p>
                  </div>
                  <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
                    <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:pt-6 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">First Order</p>
                    <p className="text-base sm:text-xl md:text-2xl font-bold font-mono text-[hsl(var(--tenant-text))] truncate">
                      {combinedFirstOrder ? formatSmartDate(combinedFirstOrder) : 'No orders'}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg shrink-0">
                    <Calendar className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:pt-6 sm:px-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[hsl(var(--tenant-text-light))] mb-1">Average Order</p>
                    <p className="text-lg sm:text-2xl md:text-3xl font-bold font-mono text-[hsl(var(--tenant-text))] truncate">
                      ${averageOrderValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg shrink-0">
                    <Star className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
            <TabsList className="bg-[hsl(var(--tenant-bg))] border border-[hsl(var(--tenant-border))] flex-wrap h-auto gap-1 p-1 overflow-x-auto max-w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="addresses">Addresses</TabsTrigger>
              <TabsTrigger value="orders">Purchase History</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
              <TabsTrigger value="payments">Payment History</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="communications">Communications</TabsTrigger>
              <TabsTrigger value="financial">Financial Tracking</TabsTrigger>
              <TabsTrigger value="medical">Medical Info</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Contact Card, Activity Timeline, and Related Entities */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Contact Card + Related Entities */}
                <div className="space-y-6">
                  {tenantId && customer && (
                    <ContactCard
                      customer={customer}
                      customerId={customer.id}
                      tenantId={tenantId}
                      onCall={() => {
                        if (customer.phone) {
                          window.location.href = `tel:${customer.phone}`;
                        }
                      }}
                      onEmail={() => {
                        if (customer.email) {
                          window.location.href = `mailto:${customer.email}`;
                        }
                      }}
                      onMessage={() => {
                        // Scroll to communication history or open dialog
                        const commTab = document.querySelector('[value="communications"]');
                        if (commTab) {
                          (commTab as HTMLElement).click();
                        }
                      }}
                    />
                  )}
                  {/* Related Entities Panel */}
                  {customer && (
                    <CustomerRelatedEntitiesPanel customerId={customer.id} />
                  )}
                  {/* Compliance Verification */}
                  {customer && (
                    <CustomerComplianceVerification
                      customerId={customer.id}
                      customerName={displayName(customer.first_name, customer.last_name)}
                      compact
                      showBlockWarning
                    />
                  )}
                </div>
                {/* Right column: Activity Timeline */}
                {tenantId && customer && (
                  <div className="lg:col-span-2">
                    <ActivityTimeline clientId={customer.id} />
                  </div>
                )}
              </div>

              {/* Communication History */}
              {tenantId && customer && (
                <CommunicationHistory
                  customerId={customer.id}
                  tenantId={tenantId}
                  customerEmail={customer.email}
                  customerPhone={customer.phone}
                />
              )}

              {/* Preferred Products (compact view) */}
              {customer && (
                <CustomerPreferredProducts
                  customerId={customer.id}
                  compact
                  limit={5}
                />
              )}

              {/* Legacy Account Info (keep for backward compatibility) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
                      <p>{customer.date_of_birth ? formatSmartDate(customer.date_of_birth) : 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Address</label>
                      <p>{customer.address || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer Type</label>
                      <Badge variant="outline">{customer.customer_type}</Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Preferred Contact</label>
                      <p>{customer.preferred_contact || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Source</label>
                      <p>{customer.source === 'storefront' ? 'Storefront' : customer.source || customer.referral_source || 'Direct'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Account Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Purchase</label>
                      <p>{customer.last_purchase_at ? formatSmartDate(customer.last_purchase_at) : 'Never'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Orders</label>
                      <p>{totalOrdersCount} orders</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Average Order Value</label>
                      <p>${averageOrderValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Loyalty Status</label>
                      <Badge className={
                        (customer.loyalty_points ?? 0) >= 1000 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' :
                          (customer.loyalty_points ?? 0) >= 500 ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            (customer.loyalty_points ?? 0) >= 100 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }>
                        {(customer.loyalty_points ?? 0) >= 1000 ? 'VIP' :
                          (customer.loyalty_points ?? 0) >= 500 ? 'Gold' :
                            (customer.loyalty_points ?? 0) >= 100 ? 'Silver' :
                              'Bronze'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Compliance Tab */}
            {customer && (
              <TabsContent value="compliance" className="space-y-6">
                <CustomerComplianceVerification
                  customerId={customer.id}
                  customerName={displayName(customer.first_name, customer.last_name)}
                  showBlockWarning
                />
              </TabsContent>
            )}

            {/* Addresses Tab */}
            {customer && (
              <TabsContent value="addresses" className="space-y-6">
                <CustomerDeliveryMap
                  customerId={customer.id}
                  customerName={displayName(customer.first_name, customer.last_name)}
                />
                <CustomerDeliveryAddressesTab customerId={customer.id} />
              </TabsContent>
            )}

            {/* Orders Tab */}
            {customer && (
              <TabsContent value="orders">
                <CustomerOrderHistoryTab
                  customerId={customer.id}
                  customerEmail={customer.email}
                  referralSource={customer.referral_source}
                />
              </TabsContent>
            )}

            {/* Favorites/Preferred Products Tab */}
            {customer && (
              <TabsContent value="favorites">
                <CustomerPreferredProducts customerId={customer.id} />
              </TabsContent>
            )}

            {/* Invoices Tab */}
            {customer && (
              <TabsContent value="invoices">
                <CustomerInvoicesTab
                  customerId={customer.id}
                  onCreateInvoice={() => navigateToAdmin(`customers/${id}/invoices`)}
                />
              </TabsContent>
            )}

            {/* Payments Tab */}
            {customer && (
              <TabsContent value="payments">
                <CustomerPaymentHistoryTab customerId={customer.id} />
              </TabsContent>
            )}

            {/* Communications Tab */}
            {tenantId && customer && (
              <TabsContent value="communications" className="space-y-6">
                <CommunicationHistory
                  customerId={customer.id}
                  tenantId={tenantId}
                  customerEmail={customer.email}
                  customerPhone={customer.phone}
                />
              </TabsContent>
            )}

            {/* Financial Tab */}
            <TabsContent value="financial">
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                      <div className="border rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Lifetime Payments</p>
                        <p className="text-lg sm:text-2xl font-bold truncate">${totalPayments.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">Store Credit</p>
                        <p className="text-lg sm:text-2xl font-bold text-green-600 truncate">${storeCredit.toFixed(2)}</p>
                      </div>
                      <div className="border rounded-lg p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground">Outstanding Balance</p>
                        <p className={`text-lg sm:text-2xl font-bold truncate ${outstandingBalance > 0 ? 'text-red-600' : ''}`}>
                          ${outstandingBalance.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {payments.length === 0 ? (
                        <EnhancedEmptyState
                          icon={CreditCard}
                          title="No Payments Recorded"
                          description="No payment history for this customer."
                          compact
                        />
                      ) : (
                        payments.map(payment => (
                          <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">${payment.amount?.toFixed(2)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatSmartDate(payment.created_at)} · {payment.payment_method}
                                </p>
                              </div>
                            </div>
                            <Badge variant={payment.payment_status === 'completed' ? 'default' : 'secondary'}>
                              {payment.payment_status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4">
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => navigateToAdmin(`inventory/fronted/record-payment?customer=${id}`)}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Record Payment
                      </Button>
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => setStoreCreditDialogOpen(true)}
                      >
                        Add Store Credit
                      </Button>
                      <Button
                        variant="outline"
                        className="min-h-[44px]"
                        onClick={() => navigateToAdmin(`customers/${id}/invoices`)}
                      >
                        Create Invoice
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Medical Tab */}
            <TabsContent value="medical">
              <Card>
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {customer.customer_type === 'medical' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Medical Card Number</label>
                        <p className="text-lg">{customer.medical_card_number || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Card Expiration</label>
                        <p className="text-lg">
                          {customer.medical_card_expiration
                            ? formatSmartDate(customer.medical_card_expiration)
                            : 'N/A'
                          }
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">Qualifying Conditions</p>
                        <p className="text-muted-foreground">Not specified</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">Physician Information</p>
                        <p className="text-muted-foreground">Not specified</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      This is a recreational customer
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Add Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Add a note about this customer..."
                      aria-label="Customer note"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={addNote}>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notes History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {notes.length === 0 ? (
                      <EnhancedEmptyState
                        icon={MessageSquare}
                        title="No Notes Yet"
                        description="Add the first note about this customer."
                        compact
                      />
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-sm font-medium">
                              {note.profiles?.full_name || 'Staff Member'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatSmartDate(note.created_at, { includeTime: true })}
                            </p>
                          </div>
                          <p className="text-sm">{note.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Store Credit Dialog */}
      <Dialog open={storeCreditDialogOpen} onOpenChange={setStoreCreditDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Store Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                placeholder="Enter credit amount"
                value={storeCreditAmount}
                onChange={(e) => setStoreCreditAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setStoreCreditDialogOpen(false);
                setStoreCreditAmount('');
              }}>
                Cancel
              </Button>
              <DisabledTooltip
                disabled={!isAddingCredit && (!storeCreditAmount || isNaN(parseFloat(storeCreditAmount)))}
                reason="Enter a valid credit amount"
              >
                <Button
                  onClick={async () => {
                    if (storeCreditAmount && !isNaN(parseFloat(storeCreditAmount)) && id) {
                      const result = await addCredit({
                        customerId: id,
                        amount: parseFloat(storeCreditAmount),
                        reason: 'Manual credit issued by admin',
                        transactionType: 'issued',
                      });
                      if (result) {
                        toast.success(`$${storeCreditAmount} store credit added`);
                        setStoreCreditDialogOpen(false);
                        setStoreCreditAmount('');
                        refetchCredit();
                      } else {
                        toast.error('Failed to add store credit');
                      }
                    }
                  }}
                  disabled={!storeCreditAmount || isNaN(parseFloat(storeCreditAmount)) || isAddingCredit}
                >
                  {isAddingCredit ? 'Adding...' : 'Add Credit'}
                </Button>
              </DisabledTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SwipeBackWrapper>
  );
}
