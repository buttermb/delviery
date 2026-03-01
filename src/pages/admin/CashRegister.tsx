import { logger } from '@/lib/logger';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ShoppingCart, DollarSign, CreditCard, Search, Plus, Minus, Trash2, WifiOff, Loader2,
  Percent, Receipt, Printer, Keyboard, Tag, Wallet, RotateCcw, TrendingUp, Award, Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateOnEvent } from '@/lib/invalidation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useCreditGatedAction } from '@/hooks/useCredits';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { queueAction } from '@/lib/offlineQueue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CashDrawerPanel } from '@/components/pos/CashDrawerPanel';
import { useRealtimeShifts, useRealtimeCashDrawer } from '@/hooks/useRealtimePOS';
import { useCustomerCredit } from '@/hooks/useCustomerCredit';
import { DisabledTooltip } from '@/components/shared/DisabledTooltip';
import { POSRefundDialog } from '@/components/admin/pos/POSRefundDialog';
import { EmptyState } from '@/components/ui/empty-state';
import type { RefundCompletionData } from '@/components/admin/pos/POSRefundDialog';
import { useCustomerLoyaltyStatus, useLoyaltyConfig, calculatePointsToEarn, TIER_DISPLAY_INFO } from '@/hooks/useCustomerLoyalty';
import { POSCustomerSelector } from '@/components/pos/POSCustomerSelector';
import type { POSCustomer } from '@/components/pos/POSCustomerSelector';
import { useCategories } from '@/hooks/useCategories';
import { POS_PAYMENT_METHODS } from '@/lib/constants/paymentMethods';
import { formatCurrency, formatSmartDate, displayName } from '@/lib/formatters';
import { humanizeError } from '@/lib/humanizeError';

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number | null;
  image_url: string | null;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  category_id: string | null;
}

// Customer type is POSCustomer from POSCustomerSelector

interface POSTransaction {
  id: string;
  created_at: string;
  total_amount: number;
  payment_status: string | null;
  payment_method: string | null;
}

interface CartItem extends Product {
  quantity: number;
  subtotal: number;
}

interface InsufficientStockItem {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
}

interface POSTransactionResult {
  success: boolean;
  transaction_id?: string;
  transaction_number?: string;
  total?: number;
  items_count?: number;
  payment_method?: string;
  created_at?: string;
  error?: string;
  error_code?: 'NEGATIVE_TOTAL' | 'EMPTY_CART' | 'INVALID_QUANTITY' | 'PRODUCT_NOT_FOUND' | 'INSUFFICIENT_STOCK' | 'TRANSACTION_FAILED';
  insufficient_items?: InsufficientStockItem[];
}

interface ReceiptData {
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  subtotal: number;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  taxAmount: number;
  taxRate: number;
  customerName: string | null;
}

// Default tax rate (can be configured per tenant)
const DEFAULT_TAX_RATE = 0.0825; // 8.25%

function CashRegisterContent() {
  const { tenant, tenantSlug } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { triggerSuccess, triggerLight, triggerError } = useHapticFeedback();
  const { execute: executeCreditAction } = useCreditGatedAction();
  const { isOnline, pendingCount } = useOfflineQueue();

  // Query active shift for cash drawer tracking
  const { data: activeShift } = useQuery({
    queryKey: queryKeys.pos.shifts.active(tenantId),
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from('pos_shifts')
        .select('id, tenant_id, status, started_at, opening_cash, cash_sales')
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Enable realtime updates for shifts and cash drawer
  useRealtimeShifts(tenantId);
  useRealtimeCashDrawer(activeShift?.id);

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Ref for keyboard shortcut handler to avoid stale closures
  const keyboardStateRef = useRef({
    cartLength: 0,
    isPaymentPending: false,
    productDialogOpen: false,
    customerDialogOpen: false,
    discountDialogOpen: false,
    receiptDialogOpen: false,
    keyboardHelpOpen: false,
    refundDialogOpen: false,
  });

  // Core cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isAddingToCart, setIsAddingToCart] = useState<string | null>(null);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Discount state
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);

  // Tax state
  const [taxRate, _setTaxRate] = useState<number>(DEFAULT_TAX_RATE);
  const [taxEnabled, _setTaxEnabled] = useState<boolean>(true);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  // Customer credit balance (for showing available store credit)
  const { balance: customerCreditBalance } = useCustomerCredit(selectedCustomer?.id);

  // Customer loyalty status (tier, points)
  const { isActive: loyaltyActive, effectiveConfig: loyaltyEffectiveConfig } = useLoyaltyConfig();
  const { status: loyaltyStatus } = useCustomerLoyaltyStatus({
    customerId: selectedCustomer?.id,
    enabled: !!selectedCustomer,
  });

  // Clear cart confirmation
  const [clearCartDialogOpen, setClearCartDialogOpen] = useState(false);

  // Receipt state
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<POSTransactionResult | null>(null);
  const [lastReceiptData, setLastReceiptData] = useState<ReceiptData | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Keyboard shortcuts help
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);

  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [lastRefundData, setLastRefundData] = useState<RefundCompletionData | null>(null);

  // Load products with expanded fields
  const { data: products = [] } = useQuery({
    queryKey: queryKeys.pos.products(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, stock_quantity, image_url, sku, barcode, category, category_id')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!tenantId,
  });

  // Load categories (uses useCategories hook — tenant_id filtered, graceful 42P01 handling)
  const { data: categories = [] } = useCategories();

  // Load customers for selection (POSCustomer format for POSCustomerSelector)
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: queryKeys.customers.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, first_name, last_name, email, phone, customer_type, loyalty_points')
          .eq('tenant_id', tenantId)
          .order('first_name', { ascending: true })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return ((data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; customer_type: string | null; loyalty_points: number | null }>).map(c => ({
          id: c.id,
          first_name: c.first_name ?? '',
          last_name: c.last_name ?? '',
          email: c.email,
          phone: c.phone,
          customer_type: c.customer_type || 'recreational',
          loyalty_points: c.loyalty_points ?? 0,
        })) as POSCustomer[];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Load recent transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: queryKeys.pos.transactions(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      try {
        const { data, error } = await supabase
          .from('pos_transactions')
          .select('id, created_at, total_amount, payment_status, payment_method, items, tenant_id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data ?? [];
      } catch (error: unknown) {
        if (error !== null && typeof error === 'object' && 'code' in error && (error as Record<string, unknown>).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Calculate totals with discount and tax
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = discountType === 'percentage'
    ? subtotal * (discountValue / 100)
    : Math.min(discountValue, subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxEnabled ? taxableAmount * taxRate : 0;
  const total = taxableAmount + taxAmount;

  // Filter products by search and category
  const filteredProducts = useMemo(() => products.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchLower));

    const matchesCategory = selectedCategory === 'all' ||
      p.category_id === selectedCategory ||
      (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  }), [products, searchQuery, selectedCategory]);

  // Compute top-selling products from recent POS transactions for quick-add grid
  const topProducts = useMemo(() => {
    const frequencyMap = new Map<string, number>();

    if (transactions && Array.isArray(transactions)) {
      for (const tx of transactions) {
        const items = (tx as Record<string, unknown>).items;
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item && typeof item === 'object' && 'product_id' in (item as Record<string, unknown>)) {
              const parsed = item as Record<string, unknown>;
              const productId = String(parsed.product_id);
              const qty = typeof parsed.quantity === 'number' ? parsed.quantity : 1;
              frequencyMap.set(productId, (frequencyMap.get(productId) ?? 0) + qty);
            }
          }
        }
      }
    }

    // Sort products: frequent sellers first, then remaining products
    const sorted = [...products].sort((a, b) => {
      const freqA = frequencyMap.get(a.id) ?? 0;
      const freqB = frequencyMap.get(b.id) ?? 0;
      return freqB - freqA;
    });

    return sorted.slice(0, 12);
  }, [transactions, products]);

  // Queue transaction for offline processing
  const queueOfflineTransaction = useCallback(async (items: CartItem[], finalTotal: number, discAmt: number, taxAmt: number) => {
    if (!tenantId) return;

    const payload = {
      p_tenant_id: tenantId,
      p_items: items.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        price_at_order_time: item.price,
        total_price: item.subtotal,
        stock_quantity: item.stock_quantity
      })),
      p_payment_method: paymentMethod,
      p_subtotal: finalTotal,
      p_tax_amount: taxAmt,
      p_discount_amount: discAmt,
      p_customer_id: selectedCustomer?.id ?? null,
      p_shift_id: null
    };

    // Use full Supabase functions URL for offline queue
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    await queueAction(
      'generic',
      `${supabaseUrl}/functions/v1/api/pos/transaction`,
      'POST',
      payload,
      3
    );

    toast.info('Transaction queued', {
      description: 'Will be processed when connection is restored.'
    });
    // Reset transaction state inline to avoid circular dependency
    setCart([]);
    setPaymentMethod('cash');
    setDiscountValue(0);
    setDiscountType('percentage');
    setSelectedCustomer(null);
  }, [tenantId, paymentMethod, selectedCustomer]);

  // Reset transaction state
  const resetTransaction = useCallback(() => {
    setCart([]);
    setPaymentMethod('cash');
    setDiscountValue(0);
    setDiscountType('percentage');
    setSelectedCustomer(null);
  }, []);

  // Process payment mutation - uses atomic RPC only
  const processPayment = useMutation({
    mutationFn: async (): Promise<POSTransactionResult> => {
      if (!tenantId || cart.length === 0) {
        throw new Error('Invalid transaction: No items in cart');
      }

      // Check online status - queue if offline
      if (!isOnline) {
        await queueOfflineTransaction(cart, total, discountAmount, taxAmount);
        return { success: true, transaction_number: 'QUEUED' };
      }

      // Prepare items for RPC with price snapshot
      const items = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        price_at_order_time: item.price,
        total_price: item.subtotal,
        stock_quantity: item.stock_quantity ?? 0
      }));

      // Use atomic RPC - prevents race conditions on inventory
      const rpcClient = supabase as unknown as { rpc: (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc> };
      const { data: rpcResult, error: rpcError } = await rpcClient.rpc('create_pos_transaction_atomic', {
        p_tenant_id: tenantId,
        p_items: items,
        p_payment_method: paymentMethod,
        p_subtotal: subtotal,
        p_tax_amount: taxAmount,
        p_discount_amount: discountAmount,
        p_customer_id: selectedCustomer?.id ?? null,
        p_shift_id: null
      });

      if (rpcError) {
        logger.error('POS transaction RPC failed', rpcError, { component: 'CashRegister' });

        // Check for specific error types
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('does not exist')) {
          throw new Error('POS system not configured. Please contact support.');
        }

        // Extract meaningful error message
        const errorMessage = rpcError.message?.includes('Insufficient stock')
          ? rpcError.message
          : rpcError.message || 'Transaction failed. Please try again.';

        throw new Error(errorMessage);
      }

      const result = rpcResult as unknown as POSTransactionResult;

      if (!result.success) {
        // Handle specific error codes with user-friendly messages
        if (result.error_code === 'INSUFFICIENT_STOCK' && result.insufficient_items) {
          const stockDetails = result.insufficient_items.map((item: InsufficientStockItem) =>
            `${item.product_name}: need ${item.requested}, have ${item.available}`
          ).join('\n');
          throw new Error(`Insufficient stock:\n${stockDetails}`);
        }
        throw new Error(result.error || 'Transaction failed');
      }

      return result;
    },
    onSuccess: (result) => {
      triggerSuccess();

      if (result.transaction_number === 'QUEUED') {
        // Already handled in queueOfflineTransaction
        return;
      }

      // Store transaction and cart details for receipt (clear any refund data)
      setLastRefundData(null);
      setLastTransaction({
        ...result,
        total,
        items_count: cart.length,
      });
      setLastReceiptData({
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
        })),
        subtotal,
        discountAmount,
        discountType,
        discountValue,
        taxAmount,
        taxRate,
        customerName: selectedCustomer ? displayName(selectedCustomer.first_name, selectedCustomer.last_name) : null,
      });

      toast.success('Payment processed successfully!', {
        description: `Transaction ${result.transaction_number}`
      });

      // Show receipt dialog
      setReceiptDialogOpen(true);

      resetTransaction();

      // Cross-panel invalidation - POS sale affects inventory, finance, dashboard, analytics
      if (tenantId) {
        invalidateOnEvent(queryClient, 'POS_SALE_COMPLETED', tenantId, {
          customerId: selectedCustomer?.id || undefined,
          shiftId: activeShift?.id || undefined,
        });
      }

      // Invalidate stock alerts and activity feed after sale
      queryClient.invalidateQueries({ queryKey: queryKeys.stockAlerts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.activityFeed.all });

      // Also invalidate POS-specific queries
      queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
    },
    onError: (error: unknown) => {
      triggerError();
      logger.error('Payment processing failed', error, { component: 'CashRegister' });
      toast.error('Payment failed', { description: humanizeError(error) });
    }
  });

  const addToCart = useCallback((product: Product) => {
    setIsAddingToCart(product.id);
    const stock = product.stock_quantity ?? 0;

    try {
      const existingItem = cart.find(item => item.id === product.id);

      if (existingItem) {
        if (existingItem.quantity >= stock) {
          triggerError();
          toast.error('Not enough stock');
          return;
        }
        triggerLight();
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        ));
      } else {
        if (stock <= 0) {
          triggerError();
          toast.error('Product out of stock');
          return;
        }
        triggerLight();
        setCart([...cart, { ...product, quantity: 1, subtotal: product.price }]);
      }
      setProductDialogOpen(false);
    } finally {
      // Small delay for visual feedback
      setTimeout(() => setIsAddingToCart(null), 150);
    }
  }, [cart, triggerError, triggerLight]);

  const updateQuantity = (productId: string, change: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const stock = item.stock_quantity ?? 0;
        const newQuantity = Math.max(1, Math.min(stock, item.quantity + change));
        return { ...item, quantity: newQuantity, subtotal: newQuantity * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  // Clear cart with confirmation
  const handleClearCart = () => {
    if (cart.length > 0) {
      setClearCartDialogOpen(true);
    }
  };

  const confirmClearCart = () => {
    resetTransaction();
    setClearCartDialogOpen(false);
    toast.success('Cart cleared');
  };

  // Apply discount
  const handleApplyDiscount = (type: 'percentage' | 'fixed', value: number) => {
    // Validate discount
    if (type === 'percentage' && value > 100) {
      toast.error('Percentage cannot exceed 100%');
      return;
    }
    if (type === 'fixed' && value > subtotal) {
      toast.error('Discount cannot exceed subtotal');
      return;
    }
    setDiscountType(type);
    setDiscountValue(value);
    setDiscountDialogOpen(false);
    toast.success(`Discount applied: ${type === 'percentage' ? `${value}%` : formatCurrency(value)}`);
  };

  // Print receipt
  const handlePrintReceipt = useCallback(async () => {
    if (!lastTransaction && !lastRefundData) return;

    setIsPrinting(true);
    try {
      const printWindow = window.open('', '_blank', 'noopener,noreferrer');
      if (printWindow) {
        const businessName = tenant?.business_name || 'Store';
        const isRefund = !!lastRefundData;
        const now = new Date();
        const txDate = lastTransaction ? lastTransaction.created_at || now : now;
        const dateStr = formatSmartDate(txDate, { includeTime: false });
        const timeStr = formatSmartDate(txDate, { includeTime: true });
        const receipt = lastReceiptData;

        // Build item rows from receipt data or refund data
        let itemRows: string;
        let itemCount = 0;
        if (isRefund && lastRefundData.items.length > 0) {
          itemCount = lastRefundData.items.reduce((sum, i) => sum + i.quantity, 0);
          itemRows = lastRefundData.items.map(item =>
            `<tr>
              <td class="item-name" colspan="3">${item.name}</td>
            </tr>
            <tr>
              <td class="item-detail">${item.quantity} x ${formatCurrency(item.price)}</td>
              <td></td>
              <td class="item-amount">-${formatCurrency(item.subtotal)}</td>
            </tr>`
          ).join('');
        } else if (receipt?.items) {
          itemCount = receipt.items.reduce((sum, i) => sum + i.quantity, 0);
          itemRows = receipt.items.map(item =>
            `<tr>
              <td class="item-name" colspan="3">${item.name}</td>
            </tr>
            <tr>
              <td class="item-detail">${item.quantity} x ${formatCurrency(item.price)}</td>
              <td></td>
              <td class="item-amount">${formatCurrency(item.subtotal)}</td>
            </tr>`
          ).join('');
        } else {
          itemCount = lastTransaction?.items_count ?? 0;
          itemRows = `<tr><td colspan="3">${itemCount} item(s)</td></tr>`;
        }

        const discountRow = !isRefund && receipt && receipt.discountAmount > 0
          ? `<tr>
              <td colspan="2">Discount${receipt.discountType === 'percentage' ? ` (${receipt.discountValue}%)` : ''}</td>
              <td class="item-amount">-${formatCurrency(receipt.discountAmount)}</td>
            </tr>`
          : '';

        const taxRow = !isRefund && receipt && receipt.taxAmount > 0
          ? `<tr>
              <td colspan="2">Tax (${(receipt.taxRate * 100).toFixed(2)}%)</td>
              <td class="item-amount">${formatCurrency(receipt.taxAmount)}</td>
            </tr>`
          : '';

        const customerRow = receipt?.customerName
          ? `<div class="info-row"><span>Customer:</span><span>${receipt.customerName}</span></div>`
          : '';

        // Refund-specific fields
        const refundOriginalRef = isRefund
          ? `<div class="info-row"><span>Original Order:</span><span>${lastRefundData.originalOrderNumber}</span></div>`
          : '';

        const refundMethodRow = isRefund
          ? `<div class="info-row"><span>Refund Method:</span><span style="text-transform:capitalize">${lastRefundData.refundMethod}</span></div>`
          : '';

        const refundNotesRow = isRefund && lastRefundData.notes
          ? `<div class="info-row"><span>Reason:</span><span>${lastRefundData.notes}</span></div>`
          : '';

        const receiptLabel = isRefund ? '*** REFUND ***' : 'RECEIPT';
        const totalAmount = isRefund ? lastRefundData.refundAmount : (lastTransaction?.total ?? 0);
        const totalLabel = isRefund ? 'REFUND TOTAL' : 'TOTAL';
        const totalFormatted = isRefund ? `-${formatCurrency(totalAmount)}` : formatCurrency(totalAmount);
        const footerText = isRefund ? 'Refund processed.' : 'Thank you for your purchase!';
        const receiptNumber = lastTransaction?.transaction_number ?? '';
        const titlePrefix = isRefund ? 'Refund' : 'Receipt';

        const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${titlePrefix} - ${receiptNumber ?? lastRefundData?.originalOrderNumber ?? ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 302px;
      margin: 0 auto;
      padding: 10px;
      color: #000;
    }
    .header { text-align: center; margin-bottom: 8px; }
    .header h2 { font-size: 16px; margin-bottom: 2px; text-transform: uppercase; }
    .header p { font-size: 11px; line-height: 1.4; }
    .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .sep-double { border: none; border-top: 2px solid #000; margin: 6px 0; }
    .receipt-label {
      text-align: center;
      font-size: 16px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 6px 0;
      padding: 4px 0;
    }
    .receipt-label.refund {
      border: 2px solid #000;
      padding: 6px 0;
    }
    .col-header { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; border-bottom: 1px solid #000; padding-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .item-name { font-weight: bold; font-size: 11px; padding-top: 4px; }
    .item-detail { font-size: 11px; color: #333; padding-left: 8px; }
    .item-amount { text-align: right; white-space: nowrap; }
    .item-count { font-size: 10px; text-align: right; margin-top: 4px; }
    .totals td { padding: 2px 0; }
    .total-row td { font-weight: bold; font-size: 14px; padding-top: 4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .info-row span:last-child { text-align: right; max-width: 55%; word-break: break-word; }
    .footer { text-align: center; margin-top: 12px; font-size: 11px; }
    .footer p { margin: 2px 0; }
    .receipt-id { font-size: 9px; text-align: center; margin-top: 8px; color: #666; word-break: break-all; }
    @media print {
      body { padding: 0; margin: 0; width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${businessName}</h2>
  </div>
  <hr class="sep-double" />
  <div class="receipt-label${isRefund ? ' refund' : ''}">${receiptLabel}</div>
  <hr class="sep-double" />
  <div class="info-row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="info-row"><span>Time:</span><span>${timeStr}</span></div>
  ${receiptNumber ? `<div class="info-row"><span>Receipt #:</span><span>${receiptNumber}</span></div>` : ''}
  ${refundOriginalRef}
  ${customerRow}
  <hr class="sep" />
  <div class="col-header"><span>Item</span><span>Amount</span></div>
  <table>${itemRows}</table>
  <div class="item-count">${itemCount} item(s)</div>
  <hr class="sep-double" />
  <table class="totals">
    ${!isRefund ? `<tr>
      <td colspan="2">Subtotal</td>
      <td class="item-amount">${formatCurrency(receipt?.subtotal ?? lastTransaction?.total ?? 0)}</td>
    </tr>` : ''}
    ${discountRow}
    ${taxRow}
    <tr class="total-row">
      <td colspan="2">${totalLabel}</td>
      <td class="item-amount">${totalFormatted}</td>
    </tr>
  </table>
  <hr class="sep" />
  ${isRefund ? refundMethodRow : `<div class="info-row"><span>Payment:</span><span style="text-transform:capitalize">${lastTransaction?.payment_method ?? ''}</span></div>`}
  ${refundNotesRow}
  <div class="footer">
    <p>${footerText}</p>
  </div>
  <p class="receipt-id">${lastTransaction?.transaction_id ?? ''}</p>
</body>
</html>`;
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      logger.error('Print failed', error, { component: 'CashRegister' });
      toast.error('Print failed');
    } finally {
      setIsPrinting(false);
    }
  }, [lastTransaction, lastReceiptData, lastRefundData, tenant]);

  // Keep keyboard state ref in sync to avoid stale closures in the keydown handler
  keyboardStateRef.current = {
    cartLength: cart.length,
    isPaymentPending: processPayment.isPending,
    productDialogOpen,
    customerDialogOpen,
    discountDialogOpen,
    receiptDialogOpen,
    keyboardHelpOpen,
    refundDialogOpen,
  };

  // Keyboard shortcuts — uses refs so the listener is only registered once
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = keyboardStateRef.current;

      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Escape to close modals even when typing
        if (e.key === 'Escape') {
          setProductDialogOpen(false);
          setCustomerDialogOpen(false);
          setDiscountDialogOpen(false);
          setReceiptDialogOpen(false);
          setKeyboardHelpOpen(false);
        }
        return;
      }

      // F2 - New Sale (reset transaction)
      if (e.key === 'F2') {
        e.preventDefault();
        resetTransaction();
        toast.success('New sale started');
      }

      // F3 - Search Product
      if (e.key === 'F3') {
        e.preventDefault();
        setProductDialogOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }

      // F4 - Refund
      if (e.key === 'F4') {
        e.preventDefault();
        setRefundDialogOpen(true);
      }

      // F8 - Pay Cash
      if (e.key === 'F8' && state.cartLength > 0 && !state.isPaymentPending) {
        e.preventDefault();
        setPaymentMethod('cash');
        executeCreditAction('pos_process_sale', async () => {
          try {
            await processPayment.mutateAsync();
          } catch (error: unknown) {
            // Error already handled by mutation's onError callback
            logger.error('F8 cash payment failed', error, { component: 'CashRegister' });
          }
        });
      }

      // F9 - Pay Card
      if (e.key === 'F9' && state.cartLength > 0 && !state.isPaymentPending) {
        e.preventDefault();
        setPaymentMethod('credit');
        executeCreditAction('pos_process_sale', async () => {
          try {
            await processPayment.mutateAsync();
          } catch (error: unknown) {
            // Error already handled by mutation's onError callback
            logger.error('F9 card payment failed', error, { component: 'CashRegister' });
          }
        });
      }

      // Escape - Clear cart or close dialogs
      if (e.key === 'Escape') {
        const anyDialogOpen = state.productDialogOpen || state.customerDialogOpen || state.discountDialogOpen || state.receiptDialogOpen || state.keyboardHelpOpen || state.refundDialogOpen;
        if (anyDialogOpen) {
          setProductDialogOpen(false);
          setCustomerDialogOpen(false);
          setDiscountDialogOpen(false);
          setReceiptDialogOpen(false);
          setKeyboardHelpOpen(false);
          setRefundDialogOpen(false);
        } else if (state.cartLength > 0) {
          setClearCartDialogOpen(true);
        }
      }

      // ? - Show keyboard help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setKeyboardHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // State values are read via keyboardStateRef (always current), so only stable
    // function references are needed here. processPayment.mutateAsync is stable per
    // TanStack Query. State setters are stable per React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executeCreditAction, resetTransaction]);

  // Barcode scanner support
  useEffect(() => {
    const handleBarcodeInput = (e: KeyboardEvent) => {
      // Don't capture if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const currentTime = Date.now();

      // Barcode scanners input very fast (< 50ms between keys)
      // If too much time passed, reset buffer
      if (currentTime - lastKeyTimeRef.current > 100) {
        barcodeBufferRef.current = '';
      }
      lastKeyTimeRef.current = currentTime;

      if (e.key === 'Enter' && barcodeBufferRef.current.length > 3) {
        // Look up product by barcode, fall back to SKU
        const barcode = barcodeBufferRef.current;
        const product = products.find(p => p.barcode === barcode)
          || products.find(p => p.sku === barcode);

        if (product) {
          addToCart(product);
          toast.success(`Added: ${product.name}`);
        } else {
          triggerError();
          toast.error('Product not found', {
            description: `No product with barcode: ${barcode}`
          });
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleBarcodeInput);
    return () => window.removeEventListener('keydown', handleBarcodeInput);
  }, [products, addToCart, triggerError]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-4 space-y-4 sm:space-y-4">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 sm:h-8 w-40 sm:w-48" />
            <Skeleton className="h-4 w-52 sm:w-64" />
          </div>
        </div>
        {/* Quick Add skeleton */}
        <Card className="bg-gradient-to-r from-primary/5 to-background">
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-24 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Main content skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 flex-1" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-4 space-y-4 sm:space-y-4">
      {/* Offline Alert */}
      {!isOnline && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>You are offline</AlertTitle>
          <AlertDescription>
            Transactions will be queued and processed when connection is restored.
            {pendingCount > 0 && ` (${pendingCount} pending)`}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Cash Register
            {!isOnline && <WifiOff className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">Point of sale transaction management</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {activeShift && (
            <Badge variant="secondary" className="flex items-center gap-1.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Shift: {formatCurrency((activeShift.opening_cash ?? 0) + (activeShift.cash_sales ?? 0))}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefundDialogOpen(true)}
            disabled={processPayment.isPending}
            className="min-h-[44px] px-3 sm:px-4"
          >
            <RotateCcw className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Refund/Return</span>
            <kbd className="ml-1.5 px-1 py-0.5 bg-muted rounded text-[10px] font-mono hidden md:inline">F4</kbd>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKeyboardHelpOpen(true)}
            className="text-xs min-h-[44px] px-3 sm:px-4"
          >
            <Keyboard className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Shortcuts</span>
          </Button>
          <span className="text-sm text-muted-foreground hidden md:inline">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd> for help
          </span>
        </div>
      </div>

      {/* Quick Add Product Grid — Top sellers by frequency */}
      {topProducts.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Products
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProductDialogOpen(true)}
                className="text-xs h-7"
              >
                <Search className="h-3 w-3 mr-1" />
                Browse All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6 gap-1.5 sm:gap-2">
              {topProducts.map((product) => {
                const outOfStock = (product.stock_quantity ?? 0) <= 0;
                return (
                  <DisabledTooltip key={product.id} disabled={outOfStock} reason="Out of stock">
                    <Button
                      variant="outline"
                      onClick={() => addToCart(product)}
                      disabled={outOfStock || isAddingToCart === product.id}
                      className="h-auto py-2 px-1.5 sm:py-3 sm:px-2 flex flex-col items-center gap-1 hover:border-primary hover:bg-primary/5 relative min-h-[44px] md:min-h-[56px] md:py-4 md:px-3"
                    >
                      {isAddingToCart === product.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-10 w-10 object-cover rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium text-xs truncate w-full text-center">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{formatCurrency(product.price)}</span>
                          {outOfStock && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 absolute top-1 right-1">
                              Out
                            </Badge>
                          )}
                        </>
                      )}
                    </Button>
                  </DisabledTooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center justify-between text-base sm:text-lg">
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 sm:h-5 sm:w-5" />
                Current Transaction
              </span>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCart}
                  disabled={processPayment.isPending}
                  className="text-destructive hover:text-destructive min-h-[44px]"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                  <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px] font-mono hidden sm:inline">Esc</kbd>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6 pt-0 sm:pt-0">
            {/* Customer Selection */}
            <div className="space-y-2">
              <POSCustomerSelector
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                onCustomerCreated={(customer) => {
                  queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
                  setSelectedCustomer(customer);
                }}
                isLoading={customersLoading}
                tenantId={tenantId}
              />
              {selectedCustomer && (
                <div className="flex items-center gap-2 px-2">
                  {customerCreditBalance > 0 && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                      <Wallet className="h-3 w-3 mr-1" />
                      {formatCurrency(customerCreditBalance)} credit
                    </Badge>
                  )}
                  {loyaltyActive && loyaltyStatus && (
                    <Badge variant="secondary" className={`${TIER_DISPLAY_INFO[loyaltyStatus.tier].bgColor} ${TIER_DISPLAY_INFO[loyaltyStatus.tier].color} text-xs`}>
                      <Award className="h-3 w-3 mr-1" />
                      {TIER_DISPLAY_INFO[loyaltyStatus.tier].label} &middot; {loyaltyStatus.current_points} pts
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items */}
            {cart.length > 0 ? (
              <div className="space-y-2 max-h-48 md:max-h-64 lg:max-h-80 overflow-auto">
                <div className="text-sm font-medium">Items ({cart.reduce((sum, item) => sum + item.quantity, 0)})</div>
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 sm:gap-2 p-2 border rounded">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate" title={item.name}>{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(item.price)} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                      <DisabledTooltip disabled={item.quantity <= 1} reason="Minimum quantity is 1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                          onClick={() => updateQuantity(item.id, -1)}
                          disabled={item.quantity <= 1}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </DisabledTooltip>
                      <span className="w-6 sm:w-8 text-center text-sm md:text-base">{item.quantity}</span>
                      <DisabledTooltip disabled={item.quantity >= item.stock_quantity} reason="Maximum stock reached">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                          onClick={() => updateQuantity(item.id, 1)}
                          disabled={item.quantity >= item.stock_quantity}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3 md:h-4 md:w-4" />
                        </Button>
                      </DisabledTooltip>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
                        onClick={() => removeFromCart(item.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-destructive" />
                      </Button>
                    </div>
                    <span className="font-bold text-xs sm:text-sm w-14 sm:w-16 text-right shrink-0">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg border-muted-foreground/25">
                <ShoppingCart className="w-12 h-12 mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">Your cart is empty</p>
                <p className="text-xs text-muted-foreground mt-1">Scan a barcode or add items manually</p>
              </div>
            )}

            {/* Totals Breakdown */}
            {cart.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})
                    </span>
                    <span>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {taxEnabled && taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
                    <span>{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {loyaltyActive && selectedCustomer && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      Points to earn
                    </span>
                    <span>+{calculatePointsToEarn(total, loyaltyEffectiveConfig.points_per_dollar, loyaltyStatus?.tier_multiplier ?? 1)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Discount Button */}
            {cart.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDiscountDialogOpen(true)}
                disabled={processPayment.isPending}
                className="w-full min-h-[44px]"
              >
                <Percent className="h-4 w-4 mr-2" />
                {discountAmount > 0 ? 'Edit Discount' : 'Add Discount'}
              </Button>
            )}

            {/* Payment Method */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {POS_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1 min-h-[44px]"
                variant="outline"
                onClick={() => setProductDialogOpen(true)}
                disabled={processPayment.isPending}
              >
                <ShoppingCart className="h-4 w-4 mr-1 sm:mr-2" />
                Add Item
                <kbd className="ml-1.5 px-1 py-0.5 bg-muted rounded text-[10px] font-mono hidden md:inline">F3</kbd>
              </Button>
              <DisabledTooltip disabled={cart.length === 0 && !processPayment.isPending} reason="Add items to cart before processing payment">
                <Button
                  className="flex-1 min-h-[44px]"
                  variant="default"
                  onClick={async () => {
                    try {
                      await executeCreditAction('pos_process_sale', async () => {
                        await processPayment.mutateAsync();
                      });
                    } catch (error: unknown) {
                      // Error already handled by mutation's onError callback
                      logger.error('Pay button payment failed', error, { component: 'CashRegister' });
                    }
                  }}
                  disabled={cart.length === 0 || processPayment.isPending}
                >
                  {processPayment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4 mr-2" />
                      {!isOnline ? 'Queue Payment' : 'Pay'}
                      <span className="ml-1.5 hidden md:inline text-[10px] font-mono opacity-75">F8 Cash · F9 Card</span>
                    </>
                  )}
                </Button>
              </DisabledTooltip>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest POS transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {(transactions as POSTransaction[]).map((transaction) => (
                  <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 sm:p-4 lg:p-5 border rounded-lg">
                    <div className="min-w-0">
                      <div className="font-medium text-sm sm:text-base truncate">Transaction #{transaction.id.slice(0, 8)}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {formatSmartDate(transaction.created_at, { includeTime: true })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                      <div className="text-base sm:text-lg font-bold">{formatCurrency(transaction.total_amount)}</div>
                      <Badge variant={transaction.payment_status === 'completed' ? 'default' : 'secondary'}>
                        {transaction.payment_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Drawer Panel - Full Width */}
      {activeShift && (
        <div className="mt-4">
          <CashDrawerPanel
            shiftId={activeShift.id}
            openingCash={activeShift.opening_cash ?? 0}
            expectedCash={(activeShift.opening_cash ?? 0) + (activeShift.cash_sales ?? 0)}
          />
        </div>
      )}

      {/* No Active Shift Empty State */}
      {!activeShift && (
        <EmptyState
          icon={Clock}
          title="No active shift"
          description="Start a shift to begin processing sales and track cash drawer activity."
          action={{
            label: 'Start Shift',
            onClick: () => navigate(`/${tenantSlug}/admin/pos-system?tab=shifts`),
            icon: Clock,
          }}
          variant="card"
          className="mt-4"
        />
      )}

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
            <DialogDescription>Search by name, SKU, or barcode</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  aria-label="Search by name, SKU, or barcode"
                  placeholder="Search by name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              {categories.length > 0 && (
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full sm:w-40">
                    <Tag className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-2 text-center py-8">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground font-medium mb-2">
                    {products.length === 0
                      ? "No products available"
                      : searchQuery || selectedCategory !== 'all'
                        ? "No products match your filters"
                        : "No products with stock"}
                  </p>
                  {products.length === 0 && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Add products with stock to start selling
                    </p>
                  )}
                </div>
              ) : (
                filteredProducts.map(product => (
                  <Card
                    key={product.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${product.stock_quantity <= 0 ? 'opacity-50' : ''}`}
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-3">
                      <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center overflow-hidden relative">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                        )}
                        {product.stock_quantity <= 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center" role="presentation">
                            <Badge variant="destructive">Out of Stock</Badge>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      {product.sku && (
                        <p className="text-xs text-muted-foreground mb-1">SKU: {product.sku}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">{formatCurrency(product.price)}</span>
                        <span className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer selection is now inline via POSCustomerSelector */}

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply Discount</DialogTitle>
            <DialogDescription>Add a percentage or fixed amount discount</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={discountType === 'percentage' ? 'default' : 'outline'}
                onClick={() => setDiscountType('percentage')}
                className="flex-1"
              >
                <Percent className="h-4 w-4 mr-2" />
                Percentage
              </Button>
              <Button
                variant={discountType === 'fixed' ? 'default' : 'outline'}
                onClick={() => setDiscountType('fixed')}
                className="flex-1"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Fixed Amount
              </Button>
            </div>
            <div>
              <Label htmlFor="discount-input">
                {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}
              </Label>
              <div className="relative mt-1">
                {discountType === 'fixed' && (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  id="discount-input"
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : subtotal}
                  step={discountType === 'percentage' ? 1 : 0.01}
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className={discountType === 'fixed' ? 'pl-10' : ''}
                  placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter amount'}
                />
                {discountType === 'percentage' && (
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
            {discountValue > 0 && (
              <div className="text-sm text-muted-foreground">
                Discount: {formatCurrency(discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDiscountValue(0);
              setDiscountDialogOpen(false);
            }}>
              Remove Discount
            </Button>
            <Button onClick={() => handleApplyDiscount(discountType, discountValue)}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Cart Confirmation Dialog */}
      <AlertDialog open={clearCartDialogOpen} onOpenChange={setClearCartDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {cart.length} item{cart.length !== 1 ? 's' : ''} from the cart. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearCart} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear Cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={(open) => {
        setReceiptDialogOpen(open);
        if (!open) setLastRefundData(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {lastRefundData ? 'Refund Processed' : 'Transaction Complete'}
            </DialogTitle>
          </DialogHeader>
          {lastRefundData ? (
            <div className="space-y-4">
              <div className="text-center py-4 border-b">
                <div className="text-2xl font-bold text-red-600">
                  -{formatCurrency(lastRefundData.refundAmount)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Refund for {lastRefundData.originalOrderNumber}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Items Refunded</span>
                  <span>{lastRefundData.items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Method</span>
                  <span className="capitalize">{lastRefundData.refundMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{formatSmartDate(new Date(), { includeTime: true })}</span>
                </div>
              </div>
            </div>
          ) : lastTransaction ? (
            <div className="space-y-4">
              <div className="text-center py-4 border-b">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(lastTransaction.total ?? 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {lastTransaction.transaction_number}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Items</span>
                  <span>{lastTransaction.items_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method</span>
                  <span className="capitalize">{lastTransaction.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date</span>
                  <span>{formatSmartDate(lastTransaction.created_at, { includeTime: true })}</span>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setReceiptDialogOpen(false); setLastRefundData(null); }} className="flex-1">
              Close
            </Button>
            <Button onClick={handlePrintReceipt} disabled={isPrinting} className="flex-1">
              {isPrinting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POS Refund Dialog */}
      <POSRefundDialog
        open={refundDialogOpen}
        onOpenChange={setRefundDialogOpen}
        shiftId={activeShift?.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.pos.transactions(tenantId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
          queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        }}
        onRefundComplete={(data) => {
          setLastRefundData(data);
          setLastTransaction(null);
          setLastReceiptData(null);
          setReceiptDialogOpen(true);
        }}
      />

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={keyboardHelpOpen} onOpenChange={setKeyboardHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F2</kbd>
                <span>New Sale</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F3</kbd>
                <span>Search Product</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F4</kbd>
                <span>Refund</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F8</kbd>
                <span>Pay Cash</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F9</kbd>
                <span>Pay Card</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
                <span>Clear / Close</span>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Barcode Scanner</p>
              <p>Simply scan a product barcode and it will be automatically added to the cart.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export with error boundary wrapper for crash recovery
export function CashRegister() {
  return (
    <AdminErrorBoundary>
      <CashRegisterContent />
    </AdminErrorBoundary>
  );
}
