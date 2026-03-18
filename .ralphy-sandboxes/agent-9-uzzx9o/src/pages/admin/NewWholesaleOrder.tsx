import { logger } from '@/lib/logger';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IntegerInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Package,
  DollarSign,
  Truck,
  Plus,
  Minus,
  Search,
  Users,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/utils/toastHelpers';
import { useWholesaleCouriers, useProductsForWholesale } from '@/hooks/useWholesaleData';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { useCreditGatedAction } from "@/hooks/useCredits";
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { SmartClientPicker } from '@/components/wholesale/SmartClientPicker';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { queryKeys } from '@/lib/queryKeys';

type OrderStep = 'client' | 'products' | 'payment' | 'delivery' | 'review';

interface WholesaleClient {
  id: string;
  business_name: string;
  contact_name: string;
  credit_limit: number;
  outstanding_balance: number;
  status: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface OrderProduct {
  id: string;
  name: string;
  qty: number;
  price: number;
  basePrice: number;
}

interface OrderData {
  client: WholesaleClient | null;
  products: OrderProduct[];
  paymentTerms: 'cash' | 'credit';
  runnerId: string;
  deliveryAddress: string;
  scheduledTime: string;
  collectOutstanding: boolean;
  notes: string;
  tierId: string;
}

interface PricingTier {
  id: string;
  name: string;
  discount_percentage: number;
}

interface WholesaleProductItem {
  id: string;
  product_name: string;
  base_price: number;
  retail_price: number;
  cost_per_unit: number;
  quantity_available: number;
  category: string | null;
  image_url: string | null;
  source: 'products';
  strain_type?: string;
}

interface CourierItem {
  id: string;
  full_name: string;
  phone: string | null;
  vehicle_type: string | null;
  is_online: boolean;
  is_active: boolean;
  status?: string;
}

const QUICK_QTY_PRESETS = [1, 5, 10, 25];

export default function NewWholesaleOrder() {
  const { navigateToAdmin } = useTenantNavigation();
  const { tenant } = useTenantAdminAuth();
  const queryClient = useQueryClient();

  // Fetch pricing tiers
  const { data: pricingTiers = [] } = useQuery({
    queryKey: queryKeys.wholesalePricingTiers.byTenant(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data } = await supabase
        .from('account_settings')
        .select('integration_settings')
        .eq('account_id', tenant.id)
        .maybeSingle();
      const settings = (data?.integration_settings as Record<string, unknown>) || {};
      const pricingConfig = settings?.wholesale_pricing_tiers as { tiers?: PricingTier[] } | undefined;
      return pricingConfig?.tiers ?? [];
    },
    enabled: !!tenant?.id,
  });

  // Products catalog for wholesale orders
  const { data: inventory = [], isLoading: isInventoryLoading, isError: isInventoryError, refetch: refetchInventory } = useProductsForWholesale();
  const { data: couriers = [], isLoading: couriersLoading } = useWholesaleCouriers();

  const [currentStep, setCurrentStep] = useState<OrderStep>('client');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [orderData, setOrderData] = useState<OrderData>({
    client: null,
    products: [],
    paymentTerms: 'credit',
    runnerId: '',
    deliveryAddress: '',
    scheduledTime: '',
    collectOutstanding: false,
    notes: '',
    tierId: '',
  });

  // Steps configuration - memoized to stabilize deps
  const steps = useMemo<{ key: OrderStep; label: string; icon: React.ComponentType<{ className?: string }> }[]>(() => [
    { key: 'client', label: 'Select Client', icon: Users },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'payment', label: 'Payment', icon: DollarSign },
    { key: 'delivery', label: 'Delivery', icon: Truck },
    { key: 'review', label: 'Review', icon: CheckCircle2 },
  ], []);

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const progressPercent = ((currentStepIndex + 1) / steps.length) * 100;

  // Filter inventory by search
  const filteredInventory = useMemo(() => {
    if (!productSearch) return inventory;
    const query = productSearch.toLowerCase();
    return inventory.filter(
      (p: WholesaleProductItem) =>
        p.product_name?.toLowerCase().includes(query) ||
        p.strain_type?.toLowerCase().includes(query)
    );
  }, [inventory, productSearch]);

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = orderData.products.reduce((sum, p) => sum + p.qty * p.price, 0);
    const totalWeight = orderData.products.reduce((sum, p) => sum + p.qty, 0);
    // Estimate profit margin (this would ideally come from inventory cost data)
    const estimatedCost = subtotal * 0.6;
    const estimatedProfit = subtotal - estimatedCost;
    const margin = subtotal > 0 ? (estimatedProfit / subtotal) * 100 : 0;

    return { subtotal, totalWeight, estimatedCost, estimatedProfit, margin };
  }, [orderData.products]);

  // Calculate credit impact
  const creditImpact = useMemo(() => {
    if (!orderData.client) return null;

    const currentBalance = orderData.client.outstanding_balance;
    const creditLimit = orderData.client.credit_limit;
    const orderTotal = totals.subtotal;

    // If paying cash, no credit impact
    if (orderData.paymentTerms === 'cash') {
      return {
        newBalance: currentBalance,
        available: creditLimit - currentBalance,
        overLimit: false,
        overLimitAmount: 0,
      };
    }

    const newBalance = currentBalance + orderTotal;
    const available = creditLimit - newBalance;
    const overLimit = newBalance > creditLimit;
    const overLimitAmount = overLimit ? newBalance - creditLimit : 0;

    return { newBalance, available, overLimit, overLimitAmount };
  }, [orderData.client, orderData.paymentTerms, totals.subtotal]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key);
    }
  }, [currentStep, steps]);

  const handleBack = useCallback(() => {
    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key);
    }
  }, [currentStep, steps]);

  // Client selection handler
  const handleClientSelect = useCallback((client: WholesaleClient) => {
    setOrderData((prev) => ({
      ...prev,
      client,
      deliveryAddress: client.address ?? '',
      collectOutstanding: client.outstanding_balance > 0,
    }));
    // Auto-advance to next step
    setTimeout(() => handleNext(), 300);
  }, [handleNext]);

  // Helper to calculate tiered price
  const calculatePrice = useCallback((basePrice: number, tierId: string) => {
    if (!tierId) return basePrice;
    const tier = pricingTiers.find((t: PricingTier) => t.id === tierId);
    if (!tier || !tier.discount_percentage) return basePrice;
    const discount = tier.discount_percentage / 100;
    return basePrice * (1 - discount);
  }, [pricingTiers]);

  // Product handlers
  const handleAddProduct = useCallback((product: WholesaleProductItem) => {
    setOrderData((prev) => {
      const existing = prev.products.find((p) => p.id === product.id);
      if (existing) {
        return {
          ...prev,
          products: prev.products.map((p) =>
            p.id === product.id ? { ...p, qty: p.qty + 1 } : p
          ),
        };
      }
      const basePrice = product.base_price ?? 0;
      return {
        ...prev,
        products: [
          ...prev.products,
          {
            id: product.id,
            name: product.product_name,
            qty: 1,
            price: calculatePrice(basePrice, prev.tierId),
            basePrice: basePrice,
          },
        ],
      };
    });
  }, [calculatePrice]);

  // Update prices when tier changes
  const handleTierChange = (tierId: string) => {
    setOrderData((prev) => ({
      ...prev,
      tierId,
      products: prev.products.map((p) => ({
        ...p,
        price: calculatePrice(p.basePrice, tierId),
      })),
    }));
  };

  const handleUpdateQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setOrderData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
    } else {
      setOrderData((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === productId ? { ...p, qty } : p
        ),
      }));
    }
  }, []);

  const handleQuickQty = useCallback((productId: string, preset: number) => {
    setOrderData((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, qty: preset } : p
      ),
    }));
  }, []);

  // Submit handler with retry capability
  const [_lastError, setLastError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  const { execute: executeCreditAction } = useCreditGatedAction();
  const attemptIdRef = useRef<string>('');

  const handleSubmit = async (isRetry = false) => {
    if (!orderData.client) {
      showErrorToast('Please select a client first');
      return;
    }

    if (orderData.products.length === 0) {
      showErrorToast('Please add at least one product');
      return;
    }

    // Prevent double submission
    if (isSubmitting && !isRetry) {
      return;
    }

    setIsSubmitting(true);
    setLastError(null);

    // If this is a new attempt (not a retry), generate a new ID
    if (!isRetry) {
      attemptIdRef.current = crypto.randomUUID();
    }

    try {
      await executeCreditAction('wholesale_order_place', async () => {
        const { data, error } = await supabase.functions.invoke('wholesale-order-create', {
          body: {
            client_id: orderData.client!.id, // Non-null assertion safe due to check above
            items: orderData.products.map((p) => ({
              product_name: p.name,
              quantity: Number(p.qty),
              unit_price: Number(p.price),
            })),
            payment_method: orderData.paymentTerms,
            runner_id: orderData.runnerId || null,
            delivery_address: orderData.deliveryAddress || orderData.client!.address || 'No address provided',
            delivery_notes: orderData.notes ?? '',
            collect_outstanding: orderData.collectOutstanding,
            scheduled_time: orderData.scheduledTime || null,
          },
        });

        if (error) throw error;

        if (data && typeof data === 'object' && 'error' in data && data.error) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create order');
        }

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleOrders.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.wholesaleClients.all });

        setRetryCount(0);
        showSuccessToast('Order Created', `Order #${data.order_number} created successfully`);
        navigateToAdmin('wholesale-orders');
      }, {
        referenceId: attemptIdRef.current,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create order';

      // Categorize errors and provide specific guidance
      let userFriendlyMessage = errorMessage;
      let errorTitle = 'Order Failed';
      let canRetry = false;

      if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch') || errorMessage.toLowerCase().includes('timeout')) {
        userFriendlyMessage = 'Network connection issue. Please check your internet and try again.';
        errorTitle = 'Connection Error';
        canRetry = true;
      } else if (errorMessage.toLowerCase().includes('inventory') || errorMessage.toLowerCase().includes('stock') || errorMessage.toLowerCase().includes('quantity')) {
        userFriendlyMessage = 'Insufficient inventory for one or more products. Please adjust quantities.';
        errorTitle = 'Inventory Issue';
      } else if (errorMessage.toLowerCase().includes('credit') || errorMessage.toLowerCase().includes('limit')) {
        userFriendlyMessage = 'This order would exceed the client\'s credit limit. Consider switching to cash payment.';
        errorTitle = 'Credit Limit';
      } else if (errorMessage.toLowerCase().includes('client') || errorMessage.toLowerCase().includes('not found')) {
        userFriendlyMessage = 'Client not found or has been deactivated. Please select a different client.';
        errorTitle = 'Client Error';
      } else if (errorMessage.toLowerCase().includes('duplicate')) {
        userFriendlyMessage = 'A similar order was just created. Please check existing orders.';
        errorTitle = 'Duplicate Order';
      } else {
        // Generic network errors can be retried
        canRetry = retryCount < MAX_RETRIES;
      }

      setLastError(userFriendlyMessage);

      logger.error('Order creation error', error instanceof Error ? error : new Error(errorMessage), {
        component: 'NewWholesaleOrder',
        clientId: orderData.client!.id,
        retryCount,
      });

      // Auto-retry for network errors (up to MAX_RETRIES)
      if (canRetry && !isRetry && retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1);
        showErrorToast(errorTitle, `${userFriendlyMessage} Retrying...`);
        setTimeout(() => handleSubmit(true), 1500);
        return; // Don't set isSubmitting to false, retry will handle it
      }

      showErrorToast(errorTitle, userFriendlyMessage);
    } finally {
      // Always reset submitting state at the end (unless retrying)
      setIsSubmitting(false);
    }
  };

  // Get payment term label
  const getPaymentTermLabel = () => {
    return orderData.paymentTerms === 'cash' ? 'Paid in Full (Cash/Transfer)' : 'Credit (Net 7 days)';
  };

  // Get selected runner
  const selectedRunner = couriers.find((r: CourierItem) => r.id === orderData.runnerId);

  // Minimum order quantity constant (in lbs per product)
  const MINIMUM_ORDER_QUANTITY_LBS = 1;

  // Check if order exceeds credit limit
  const orderExceedsCreditLimit = useMemo(() => {
    if (!orderData.client) return false;
    if (orderData.paymentTerms === 'cash') return false;
    return creditImpact?.overLimit ?? false;
  }, [orderData.client, orderData.paymentTerms, creditImpact]);

  // Get validation errors for review step
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Credit limit check
    if (orderExceedsCreditLimit) {
      errors.push(`Order total (${formatCurrency(totals.subtotal)}) exceeds available credit (${formatCurrency((orderData.client?.credit_limit ?? 0) - (orderData.client?.outstanding_balance ?? 0))})`);
    }

    // Minimum order quantity check per product
    for (const product of orderData.products) {
      if (product.qty < MINIMUM_ORDER_QUANTITY_LBS) {
        errors.push(`"${product.name}" quantity (${product.qty} lbs) is below minimum order of ${MINIMUM_ORDER_QUANTITY_LBS} lb`);
      }
    }

    return errors;
  }, [orderExceedsCreditLimit, orderData.products, orderData.client, totals.subtotal]);

  // Validation for next button
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'client':
        return !!orderData.client;
      case 'products':
        // Require at least one product with valid quantity
        return orderData.products.length > 0 &&
          orderData.products.every(p => p.qty >= MINIMUM_ORDER_QUANTITY_LBS);
      case 'payment':
        // Allow proceeding even with credit issues - they'll be shown on review
        return true;
      case 'delivery':
        return true;
      case 'review':
        // Block submission if there are validation errors
        return validationErrors.length === 0;
      default:
        return false;
    }
  }, [currentStep, orderData, validationErrors]);

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('wholesale-orders')} aria-label="Back to wholesale orders">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-xl font-bold flex items-center gap-2">
              <Package className="h-7 w-7 text-emerald-500" />
              New Wholesale Order
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create bulk order for wholesale client
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const isCompleted = index < currentStepIndex;
              const isClickable = index <= currentStepIndex;

              return (
                <button
                  key={step.key}
                  onClick={() => isClickable && setCurrentStep(step.key)}
                  disabled={!isClickable}
                  className={cn(
                    'flex flex-col items-center gap-1 transition-colors',
                    isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors',
                      isActive && 'bg-emerald-500 text-white',
                      isCompleted && 'bg-emerald-500/20 text-emerald-600',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs hidden sm:block',
                      isActive && 'font-semibold text-foreground',
                      !isActive && 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <Card className="p-4 sm:p-6">
          {/* Step 1: Client Selection */}
          {currentStep === 'client' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Select Client
              </h2>
              <SmartClientPicker
                selectedClient={orderData.client}
                onSelect={handleClientSelect}
                onClear={() => setOrderData((prev) => ({ ...prev, client: null }))}
              />

              {/* Pricing Tier Selection */}
              {orderData.client && pricingTiers.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="mb-2 block">Pricing Tier applied to this order</Label>
                  <Select
                    value={orderData.tierId}
                    onValueChange={handleTierChange}
                  >
                    <SelectTrigger className="w-full sm:w-[280px]">
                      <SelectValue placeholder="Select Pricing Tier (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Tier (Standard Price)</SelectItem>
                      {pricingTiers.map((tier: PricingTier) => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name} ({tier.discount_percentage}% Off)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a pricing tier to automatically apply discounts to products.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Products */}
          {currentStep === 'products' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  Select Products
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Inventory */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Products Catalog
                    </h3>
                    <Badge variant="outline">{inventory.length} items</Badge>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Search products"
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Product List */}
                  {isInventoryLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : isInventoryError ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <AlertTriangle className="h-6 w-6 text-destructive" />
                      <p className="text-sm text-destructive">Failed to load products</p>
                      <Button variant="outline" size="sm" onClick={() => refetchInventory()}>
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                      {filteredInventory.length === 0 ? (
                        <EnhancedEmptyState
                          icon={Search}
                          title={productSearch ? 'No Products Match' : 'No Inventory'}
                          description={productSearch ? 'Try a different search term.' : 'No inventory available for wholesale orders.'}
                          compact
                        />
                      ) : (
                        filteredInventory.map((product: WholesaleProductItem) => {
                          const inCart = orderData.products.find((p) => p.id === product.id);
                          const stockQty = product.quantity_available ?? 0;
                          const isOutOfStock = stockQty <= 0;
                          return (
                            <Card
                              key={product.id}
                              className={cn(
                                'p-3 transition-all',
                                isOutOfStock
                                  ? 'opacity-50 cursor-not-allowed border-destructive/30'
                                  : 'cursor-pointer',
                                !isOutOfStock && inCart
                                  ? 'border-emerald-500 bg-emerald-500/5'
                                  : !isOutOfStock && 'hover:border-muted-foreground/50'
                              )}
                              onClick={() => !isOutOfStock && handleAddProduct(product)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate flex items-center gap-1.5">
                                    {product.product_name}
                                    {isOutOfStock && (
                                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    {isOutOfStock ? (
                                      <span className="text-destructive font-medium">Out of Stock</span>
                                    ) : (
                                      <span>Stock: {stockQty} units</span>
                                    )}
                                    <span>|</span>
                                    <span className="font-mono">{formatCurrency(product.base_price)}/unit</span>
                                  </div>
                                </div>
                                {isOutOfStock ? (
                                  <Badge variant="destructive" className="shrink-0 text-xs">
                                    Unavailable
                                  </Badge>
                                ) : inCart ? (
                                  <Badge className="bg-emerald-500 shrink-0">
                                    {inCart.qty} in cart
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" aria-label="Add to order">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Order Summary */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Order Items ({orderData.products.length})
                  </h3>

                  {orderData.products.length === 0 ? (
                    <EnhancedEmptyState
                      icon={Package}
                      title="No Products Selected"
                      description="Click products on the left to add them to the order."
                      compact
                    />
                  ) : (
                    <>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {orderData.products.map((product) => (
                          <Card key={product.id} className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium truncate" title={product.name}>{product.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(product.price)}/lb
                                </div>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-11 w-11 sm:h-6 sm:w-6 shrink-0"
                                onClick={() => handleUpdateQty(product.id, 0)}
                                aria-label="Remove product"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-11 w-11"
                                  onClick={() => handleUpdateQty(product.id, product.qty - 1)}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <IntegerInput
                                  value={product.qty}
                                  onChange={(e) => handleUpdateQty(product.id, Number(e.target.value))}
                                  className="h-7 w-16 text-center"
                                />
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-11 w-11"
                                  onClick={() => handleUpdateQty(product.id, product.qty + 1)}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <span className="text-xs text-muted-foreground">lbs</span>
                              <div className="flex-1" />
                              <span className="font-mono font-semibold">
                                {formatCurrency(product.qty * product.price)}
                              </span>
                            </div>

                            {/* Quick Quantity Presets */}
                            <div className="flex gap-1 mt-2">
                              {QUICK_QTY_PRESETS.map((preset) => (
                                <Button
                                  key={preset}
                                  size="sm"
                                  variant={product.qty === preset ? 'default' : 'outline'}
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleQuickQty(product.id, preset)}
                                >
                                  {preset}
                                </Button>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Totals */}
                      <Separator />
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Weight:</span>
                          <span className="font-mono font-semibold">{totals.totalWeight} lbs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-mono font-semibold">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                          <span>Est. Profit:</span>
                          <span className="font-mono font-semibold">
                            {formatCurrency(totals.estimatedProfit)} ({totals.margin.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Payment */}
          {currentStep === 'payment' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                Payment Terms
              </h2>

              <div className="space-y-3">
                {[
                  { value: 'cash' as const, label: 'Paid in Full (Cash/Transfer)', icon: '', description: 'Payment collected at time of order' },
                  { value: 'credit' as const, label: 'Credit (Invoice) - Net 7 days', icon: '', description: 'Add to client credit balance' },
                ].map((option) => (
                  <Card
                    key={option.value}
                    className={cn(
                      'p-4 cursor-pointer transition-colors',
                      orderData.paymentTerms === option.value
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'hover:border-muted-foreground/50'
                    )}
                    onClick={() => setOrderData((prev) => ({ ...prev, paymentTerms: option.value }))}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{option.icon}</span>
                      <div>
                        <span className="font-medium">{option.label}</span>
                        <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Credit Impact Warning */}
              {orderData.paymentTerms === 'credit' && creditImpact && (
                <Card className={cn(
                  'p-4',
                  creditImpact.overLimit
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-yellow-500/10 border-yellow-500/30'
                )}>
                  <div className="flex items-start gap-3">
                    <AlertCircle className={cn(
                      'h-5 w-5 mt-0.5 shrink-0',
                      creditImpact.overLimit ? 'text-red-500' : 'text-yellow-500'
                    )} />
                    <div className="flex-1">
                      <div className={cn(
                        'font-semibold',
                        creditImpact.overLimit ? 'text-red-500' : 'text-yellow-600'
                      )}>
                        {creditImpact.overLimit ? 'Over Credit Limit' : 'Credit Balance Update'}
                      </div>

                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Current Balance:</span>
                          <span className="font-mono">{formatCurrency(orderData.client?.outstanding_balance ?? 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order Total:</span>
                          <span className="font-mono">+ {formatCurrency(totals.subtotal)}</span>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-medium">
                          <span>New Balance:</span>
                          <span className={cn('font-mono', creditImpact.overLimit && 'text-red-500')}>
                            {formatCurrency(creditImpact.newBalance)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Credit Limit:</span>
                          <span className="font-mono">{formatCurrency(orderData.client?.credit_limit ?? 0)}</span>
                        </div>
                        {creditImpact.overLimit && (
                          <div className="flex justify-between text-red-500">
                            <span>Over Limit By:</span>
                            <span className="font-mono">{formatCurrency(creditImpact.overLimitAmount)}</span>
                          </div>
                        )}
                      </div>

                      {creditImpact.overLimit && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => showSuccessToast('Request Sent', 'Manager approval requested')}
                          >
                            Request Manager Approval
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setOrderData((prev) => ({ ...prev, paymentTerms: 'cash' }))}
                          >
                            Switch to Cash
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 4: Delivery */}
          {currentStep === 'delivery' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                Delivery Details
              </h2>

              <div className="space-y-4">
                {/* Courier Selection */}
                <div className="space-y-2">
                  <Label>Assign Courier</Label>
                  <Select
                    value={orderData.runnerId}
                    onValueChange={(value) => setOrderData((prev) => ({ ...prev, runnerId: value }))}
                    disabled={couriersLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={couriersLoading ? "Loading couriers..." : "Select a courier..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {couriersLoading ? (
                        <div className="p-2 text-center text-muted-foreground">Loading couriers...</div>
                      ) : couriers.length === 0 ? (
                        <div className="p-2 text-center text-muted-foreground">No couriers available</div>
                      ) : (
                        couriers.map((courier: CourierItem) => (
                          <SelectItem key={courier.id} value={courier.id}>
                            <div className="flex items-center gap-2">
                              <span>{courier.full_name}</span>
                              {courier.vehicle_type && (
                                <Badge variant="outline" className="text-xs">
                                  {courier.vehicle_type}
                                </Badge>
                              )}
                              {courier.status && (
                                <Badge
                                  variant={courier.status === 'available' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {courier.status}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Address */}
                <div className="space-y-2">
                  <Label>Delivery Address</Label>
                  <Input
                    value={orderData.deliveryAddress}
                    onChange={(e) => setOrderData((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                    placeholder="Enter delivery address..."
                  />
                  {orderData.client?.address && orderData.deliveryAddress !== orderData.client.address && (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setOrderData((prev) => ({ ...prev, deliveryAddress: prev.client?.address ?? '' }))}
                    >
                      Use client's default address
                    </Button>
                  )}
                </div>

                {/* Scheduled Time */}
                <div className="space-y-2">
                  <Label>Scheduled Time (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={orderData.scheduledTime}
                    onChange={(e) => setOrderData((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                  />
                </div>

                {/* Collect Outstanding */}
                {orderData.client && orderData.client.outstanding_balance > 0 && (
                  <Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="collect-outstanding"
                        checked={orderData.collectOutstanding}
                        onCheckedChange={(checked) =>
                          setOrderData((prev) => ({ ...prev, collectOutstanding: !!checked }))
                        }
                      />
                      <div>
                        <Label htmlFor="collect-outstanding" className="cursor-pointer">
                          Collect outstanding balance
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Client has {formatCurrency(orderData.client.outstanding_balance)} outstanding
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Delivery Notes (Optional)</Label>
                  <Textarea
                    value={orderData.notes}
                    onChange={(e) => setOrderData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Special instructions for the runner..."
                    rows={3}
                    maxLength={1000}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                Review Order
              </h2>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Client */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Client</h3>
                  <div className="space-y-1">
                    <div className="font-medium">{orderData.client?.business_name}</div>
                    <div className="text-sm text-muted-foreground">{orderData.client?.contact_name}</div>
                    {orderData.client?.phone && (
                      <div className="text-sm text-muted-foreground">{orderData.client.phone}</div>
                    )}
                  </div>
                </Card>

                {/* Payment */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Payment</h3>
                  <div className="font-medium">{getPaymentTermLabel()}</div>
                  {orderData.paymentTerms === 'credit' && creditImpact?.overLimit && (
                    <Badge variant="destructive" className="mt-2">Requires Approval</Badge>
                  )}
                </Card>

                {/* Delivery */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Delivery</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-muted-foreground">Runner: </span>
                      <span className="font-medium">{selectedRunner?.full_name || 'Not assigned'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Address: </span>
                      <span>{orderData.deliveryAddress || 'Not specified'}</span>
                    </div>
                    {orderData.scheduledTime && (
                      <div>
                        <span className="text-muted-foreground">Scheduled: </span>
                        <span>{new Date(orderData.scheduledTime).toLocaleString()}</span>
                      </div>
                    )}
                    {orderData.collectOutstanding && (
                      <Badge variant="outline" className="mt-1 text-yellow-600 border-yellow-500/30">
                        Collect {formatCurrency(orderData.client?.outstanding_balance ?? 0)} outstanding
                      </Badge>
                    )}
                  </div>
                </Card>

                {/* Products Summary */}
                <Card className="p-4 md:col-span-2">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3">Products</h3>
                  <div className="space-y-2">
                    {orderData.products.map((product) => (
                      <div key={product.id} className="flex justify-between text-sm">
                        <span>
                          {product.name} x {product.qty} lbs
                        </span>
                        <span className="font-mono">{formatCurrency(product.qty * product.price)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total ({totals.totalWeight} lbs)</span>
                      <span className="font-mono">{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Estimated Profit</span>
                      <span className="font-mono">
                        {formatCurrency(totals.estimatedProfit)} ({totals.margin.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </Card>

                {/* Notes */}
                {orderData.notes && (
                  <Card className="p-4 md:col-span-2">
                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">Special Instructions</h3>
                    <p className="text-sm">{orderData.notes}</p>
                  </Card>
                )}

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Card className="p-4 md:col-span-2 bg-destructive/10 border-destructive/30">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-destructive mb-2">Cannot Submit Order</h3>
                        <ul className="space-y-1 text-sm text-destructive">
                          {validationErrors.map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                        </ul>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {orderExceedsCreditLimit && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-destructive/50 text-destructive hover:bg-destructive/10"
                              onClick={() => setOrderData((prev) => ({ ...prev, paymentTerms: 'cash' }))}
                            >
                              Switch to Cash Payment
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentStep('products')}
                          >
                            Edit Products
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 'client'}
          >
            ← Back
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => navigateToAdmin('wholesale-orders')}
            >
              Cancel
            </Button>

            {currentStep === 'review' ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={() => handleSubmit()}
                disabled={isSubmitting || validationErrors.length > 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : validationErrors.length > 0 ? (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Fix Errors to Submit
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create Order
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
              >
                Next →
              </Button>
            )}
          </div>
        </div>

        {/* Running Total Footer (Sticky on mobile) */}
        {orderData.products.length > 0 && currentStep !== 'review' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Order Total</div>
                <div className="font-mono font-bold text-lg">{formatCurrency(totals.subtotal)}</div>
              </div>
              <Badge variant="outline">{orderData.products.length} items</Badge>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
