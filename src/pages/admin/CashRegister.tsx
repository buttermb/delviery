import { logger } from '@/lib/logger';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart, DollarSign, CreditCard, Search, Plus, Minus, Trash2, WifiOff, Loader2,
  User, Percent, Receipt, Printer, X, Keyboard, Tag, Wallet, RotateCcw
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
import { POSRefundDialog } from '@/components/admin/pos/POSRefundDialog';
import type { RefundCompletionData } from '@/components/admin/pos/POSRefundDialog';

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

interface Category {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

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
  const { tenant } = useTenantAdminAuth();
  const tenantId = tenant?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
        .select('*')
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Customer credit balance (for showing available store credit)
  const { balance: customerCreditBalance } = useCustomerCredit(selectedCustomer?.id);

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
      return (data || []) as Product[];
    },
    enabled: !!tenantId,
  });

  // Load categories
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .order('name', { ascending: true });

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return (data || []) as Category[];
      } catch (error: unknown) {
        if (error instanceof Error && 'code' in error && (error as { code: string }).code === '42P01') return [];
        throw error;
      }
    },
    enabled: !!tenantId,
  });

  // Load customers for selection
  const { data: customers = [] } = useQuery({
    queryKey: queryKeys.customers.list(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id, first_name, last_name, email, phone')
          .eq('tenant_id', tenantId)
          .order('first_name', { ascending: true })
          .limit(100);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        // Map first_name/last_name to name for Customer interface
        return ((data || []) as Array<{ id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null }>).map(c => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'Unknown',
          email: c.email,
          phone: c.phone,
        })) as Customer[];
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
        // pos_transactions table may not be in generated types yet
        const client = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };
        const { data, error } = await client
          .from('pos_transactions')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error && error.code === '42P01') return [];
        if (error) throw error;
        return data || [];
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
  const filteredProducts = products.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchLower));

    const matchesCategory = selectedCategory === 'all' ||
      p.category_id === selectedCategory ||
      (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Filter customers by search
  const filteredCustomers = customers.filter(c => {
    const searchLower = customerSearchQuery.toLowerCase();
    return customerSearchQuery === '' ||
      c.name.toLowerCase().includes(searchLower) ||
      (c.email && c.email.toLowerCase().includes(searchLower)) ||
      (c.phone && c.phone.includes(customerSearchQuery));
  });

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

    toast({
      title: 'Transaction queued',
      description: 'Will be processed when connection is restored.'
    });
    // Reset transaction state inline to avoid circular dependency
    setCart([]);
    setPaymentMethod('cash');
    setDiscountValue(0);
    setDiscountType('percentage');
    setSelectedCustomer(null);
  }, [tenantId, paymentMethod, selectedCustomer, toast]);

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
        customerName: selectedCustomer?.name ?? null,
      });

      toast({
        title: 'Payment processed successfully!',
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
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
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
          toast({ title: 'Not enough stock', variant: 'destructive' });
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
          toast({ title: 'Product out of stock', variant: 'destructive' });
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
  }, [cart, triggerError, triggerLight, toast]);

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
    toast({ title: 'Cart cleared' });
  };

  // Apply discount
  const handleApplyDiscount = (type: 'percentage' | 'fixed', value: number) => {
    // Validate discount
    if (type === 'percentage' && value > 100) {
      toast({ title: 'Percentage cannot exceed 100%', variant: 'destructive' });
      return;
    }
    if (type === 'fixed' && value > subtotal) {
      toast({ title: 'Discount cannot exceed subtotal', variant: 'destructive' });
      return;
    }
    setDiscountType(type);
    setDiscountValue(value);
    setDiscountDialogOpen(false);
    toast({ title: `Discount applied: ${type === 'percentage' ? `${value}%` : `$${value.toFixed(2)}`}` });
  };

  // Print receipt
  const handlePrintReceipt = useCallback(async () => {
    if (!lastTransaction && !lastRefundData) return;

    setIsPrinting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const businessName = tenant?.business_name || 'Store';
        const isRefund = !!lastRefundData;
        const now = new Date();
        const txDate = lastTransaction ? new Date(lastTransaction.created_at || '') : now;
        const dateStr = txDate.toLocaleDateString();
        const timeStr = txDate.toLocaleTimeString();
        const receipt = lastReceiptData;

        // Build item rows from receipt data or refund data
        let itemRows: string;
        if (isRefund && lastRefundData.items.length > 0) {
          itemRows = lastRefundData.items.map(item =>
            `<tr>
              <td class="item-name" colspan="3">${item.name}</td>
            </tr>
            <tr>
              <td class="item-detail">${item.quantity} x $${item.price.toFixed(2)}</td>
              <td></td>
              <td class="item-amount">$${item.subtotal.toFixed(2)}</td>
            </tr>`
          ).join('');
        } else if (receipt?.items) {
          itemRows = receipt.items.map(item =>
            `<tr>
              <td class="item-name" colspan="3">${item.name}</td>
            </tr>
            <tr>
              <td class="item-detail">${item.quantity} x $${item.price.toFixed(2)}</td>
              <td></td>
              <td class="item-amount">$${item.subtotal.toFixed(2)}</td>
            </tr>`
          ).join('');
        } else {
          itemRows = `<tr><td colspan="3">${lastTransaction?.items_count || 0} item(s)</td></tr>`;
        }

        const discountRow = !isRefund && receipt && receipt.discountAmount > 0
          ? `<tr>
              <td colspan="2">Discount${receipt.discountType === 'percentage' ? ` (${receipt.discountValue}%)` : ''}</td>
              <td class="item-amount">-$${receipt.discountAmount.toFixed(2)}</td>
            </tr>`
          : '';

        const taxRow = !isRefund && receipt && receipt.taxAmount > 0
          ? `<tr>
              <td colspan="2">Tax (${(receipt.taxRate * 100).toFixed(2)}%)</td>
              <td class="item-amount">$${receipt.taxAmount.toFixed(2)}</td>
            </tr>`
          : '';

        const customerRow = receipt?.customerName
          ? `<p class="customer">Customer: ${receipt.customerName}</p>`
          : '';

        // Refund-specific fields
        const refundOriginalRef = isRefund
          ? `<div class="info-row"><span>Original Order:</span><span>${lastRefundData.originalOrderNumber}</span></div>`
          : '';

        const refundMethodRow = isRefund
          ? `<div class="info-row"><span>Refund Method:</span><span style="text-transform:capitalize">${lastRefundData.refundMethod}</span></div>`
          : '';

        const receiptLabel = isRefund ? 'REFUND' : 'RECEIPT';
        const totalAmount = isRefund ? lastRefundData.refundAmount : (lastTransaction?.total || 0);
        const totalLabel = isRefund ? 'REFUND TOTAL' : 'TOTAL';
        const footerText = isRefund ? 'Refund processed.' : 'Thank you for your purchase!';
        const receiptNumber = lastTransaction?.transaction_number || '';
        const titlePrefix = isRefund ? 'Refund' : 'Receipt';

        const receiptHtml = `<!DOCTYPE html>
<html>
<head>
  <title>${titlePrefix} - ${receiptNumber || lastRefundData?.originalOrderNumber || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      max-width: 300px;
      margin: 0 auto;
      padding: 10px;
      color: #000;
    }
    .header { text-align: center; margin-bottom: 8px; }
    .header h2 { font-size: 16px; margin-bottom: 4px; text-transform: uppercase; }
    .header p { font-size: 11px; line-height: 1.4; }
    .sep { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .receipt-label { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 2px; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .item-name { font-weight: bold; font-size: 11px; padding-top: 4px; }
    .item-detail { font-size: 11px; color: #333; padding-left: 8px; }
    .item-amount { text-align: right; white-space: nowrap; }
    .totals td { padding: 2px 0; }
    .total-row td { font-weight: bold; font-size: 14px; padding-top: 4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .info-row span:last-child { text-align: right; }
    .customer { font-size: 11px; margin: 4px 0; }
    .footer { text-align: center; margin-top: 12px; font-size: 11px; }
    .footer p { margin: 2px 0; }
    .receipt-no { font-size: 10px; text-align: center; margin-top: 8px; color: #666; }
    @media print {
      body { padding: 0; margin: 0; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>${businessName}</h2>
  </div>
  <hr class="sep" />
  <div class="receipt-label">${receiptLabel}</div>
  <hr class="sep" />
  <div class="info-row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="info-row"><span>Time:</span><span>${timeStr}</span></div>
  ${receiptNumber ? `<div class="info-row"><span>Receipt #:</span><span>${receiptNumber}</span></div>` : ''}
  ${refundOriginalRef}
  ${customerRow}
  <hr class="sep" />
  <table>${itemRows}</table>
  <hr class="sep" />
  <table class="totals">
    ${!isRefund ? `<tr>
      <td colspan="2">Subtotal</td>
      <td class="item-amount">$${(receipt?.subtotal ?? lastTransaction?.total ?? 0).toFixed(2)}</td>
    </tr>` : ''}
    ${discountRow}
    ${taxRow}
    <tr class="total-row">
      <td colspan="2">${totalLabel}</td>
      <td class="item-amount">$${totalAmount.toFixed(2)}</td>
    </tr>
  </table>
  <hr class="sep" />
  ${isRefund ? refundMethodRow : `<div class="info-row"><span>Payment:</span><span style="text-transform:capitalize">${lastTransaction?.payment_method || ''}</span></div>`}
  <div class="footer">
    <p>${footerText}</p>
  </div>
  <p class="receipt-no">${lastTransaction?.transaction_id || ''}</p>
</body>
</html>`;
        printWindow.document.write(receiptHtml);
        printWindow.document.close();
        printWindow.print();
      }
    } catch (error) {
      logger.error('Print failed', error, { component: 'CashRegister' });
      toast({ title: 'Print failed', variant: 'destructive' });
    } finally {
      setIsPrinting(false);
    }
  }, [lastTransaction, lastReceiptData, lastRefundData, tenant, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      // F2 - Focus search
      if (e.key === 'F2') {
        e.preventDefault();
        setProductDialogOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }

      // F4 - Clear cart
      if (e.key === 'F4' && cart.length > 0) {
        e.preventDefault();
        handleClearCart();
      }

      // F8 - Add discount
      if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        setDiscountDialogOpen(true);
      }

      // F10 - Select customer
      if (e.key === 'F10') {
        e.preventDefault();
        setCustomerDialogOpen(true);
      }

      // F12 - Complete transaction
      if (e.key === 'F12' && cart.length > 0 && !processPayment.isPending) {
        e.preventDefault();
        executeCreditAction('pos_process_sale', async () => {
          await processPayment.mutateAsync();
        });
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        setProductDialogOpen(false);
        setCustomerDialogOpen(false);
        setDiscountDialogOpen(false);
        setReceiptDialogOpen(false);
        setKeyboardHelpOpen(false);
      }

      // ? - Show keyboard help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setKeyboardHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- processPayment.mutateAsync is stable
  }, [cart, processPayment.isPending, executeCreditAction]);

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
          toast({ title: `Added: ${product.name}` });
        } else {
          triggerError();
          toast({
            title: 'Product not found',
            description: `No product with barcode: ${barcode}`,
            variant: 'destructive'
          });
        }
        barcodeBufferRef.current = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleBarcodeInput);
    return () => window.removeEventListener('keydown', handleBarcodeInput);
  }, [products, addToCart, triggerError, toast]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
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
    <div className="p-6 space-y-6">
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary" />
            Cash Register
            {!isOnline && <WifiOff className="h-5 w-5 text-destructive" />}
          </h1>
          <p className="text-muted-foreground">Point of sale transaction management</p>
        </div>
        <div className="flex items-center gap-2">
          {activeShift && (
            <Badge variant="secondary" className="flex items-center gap-1.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Shift: ${((activeShift.opening_cash || 0) + (activeShift.cash_sales || 0)).toFixed(2)}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefundDialogOpen(true)}
            disabled={processPayment.isPending}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Refund/Return
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKeyboardHelpOpen(true)}
            className="text-xs"
          >
            <Keyboard className="h-4 w-4 mr-1" />
            Shortcuts
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            Press <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">?</kbd> for help
          </span>
        </div>
      </div>

      {/* Quick Add Section */}
      {products.length > 0 && (
        <Card className="bg-gradient-to-r from-primary/5 to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Quick Add
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {products.slice(0, 8).map((product) => (
                <Button
                  key={product.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addToCart(product)}
                  disabled={(product.stock_quantity ?? 0) <= 0 || isAddingToCart === product.id}
                  className="h-auto py-2 px-3 flex flex-col items-start gap-0.5 min-w-[100px] hover:border-primary hover:bg-primary/5"
                >
                  {isAddingToCart === product.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className="font-medium text-xs truncate max-w-[80px]">{product.name}</span>
                      <span className="text-xs text-muted-foreground">${product.price}</span>
                    </>
                  )}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProductDialogOpen(true)}
                className="h-auto py-2 px-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                More...
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Transaction
              </span>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCart}
                  disabled={processPayment.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Selection */}
            <div className="flex items-center justify-between p-2 border rounded bg-muted/30">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                {selectedCustomer ? (
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-medium text-sm">{selectedCustomer.name}</span>
                      {selectedCustomer.phone && (
                        <span className="text-xs text-muted-foreground ml-2">{selectedCustomer.phone}</span>
                      )}
                    </div>
                    {customerCreditBalance > 0 && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                        <Wallet className="h-3 w-3 mr-1" />
                        ${customerCreditBalance.toFixed(2)} credit
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Walk-in Customer</span>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCustomerDialogOpen(true)}
                >
                  {selectedCustomer ? 'Change' : 'Select'}
                </Button>
                {selectedCustomer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Cart Items */}
            {cart.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-auto">
                <div className="text-sm font-medium">Items ({cart.reduce((sum, item) => sum + item.quantity, 0)})</div>
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        ${item.price.toFixed(2)} × {item.quantity}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock_quantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <span className="font-bold text-sm w-16 text-right">${item.subtotal.toFixed(2)}</span>
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
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})
                    </span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxEnabled && taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({(taxRate * 100).toFixed(2)}%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Discount Button */}
            {cart.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDiscountDialogOpen(true)}
                disabled={processPayment.isPending}
                className="w-full"
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="debit">Debit Card</SelectItem>
                  <SelectItem value="credit">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setProductDialogOpen(true)}
                disabled={processPayment.isPending}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button
                className="flex-1"
                variant="default"
                onClick={async () => {
                  await executeCreditAction('pos_process_sale', async () => {
                    await processPayment.mutateAsync();
                  });
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
                    {!isOnline ? 'Queue Payment' : 'Process Payment'}
                  </>
                )}
              </Button>
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
              <div className="space-y-4">
                {(transactions as POSTransaction[]).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">Transaction #{transaction.id.slice(0, 8)}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-bold">${transaction.total_amount.toFixed(2)}</div>
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
            openingCash={activeShift.opening_cash || 0}
            expectedCash={(activeShift.opening_cash || 0) + (activeShift.cash_sales || 0)}
          />
        </div>
      )}

      {/* No Active Shift Alert */}
      {!activeShift && (
        <Alert className="mt-4">
          <Wallet className="h-4 w-4" />
          <AlertTitle>No Active Shift</AlertTitle>
          <AlertDescription>
            Start a shift from the POS page to track cash drawer activity and generate Z-reports.
          </AlertDescription>
        </Alert>
      )}

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
            <DialogDescription>Search by name, SKU, or barcode</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
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
                  <SelectTrigger className="w-40">
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
            <div className="grid grid-cols-2 gap-3">
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
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart className="w-8 h-8 text-muted-foreground" />
                        )}
                        {product.stock_quantity <= 0 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Badge variant="destructive">Out of Stock</Badge>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                      {product.sku && (
                        <p className="text-xs text-muted-foreground mb-1">SKU: {product.sku}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold">${product.price.toFixed(2)}</span>
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

      {/* Customer Selection Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
            <DialogDescription>Search for an existing customer or proceed with walk-in</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search by name, email, or phone"
                placeholder="Search by name, email, or phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-60 overflow-auto space-y-2">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No customers found
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerDialogOpen(false);
                      setCustomerSearchQuery('');
                    }}
                  >
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {customer.email || customer.phone || 'No contact info'}
                      </div>
                    </div>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setSelectedCustomer(null);
              setCustomerDialogOpen(false);
            }}>
              Walk-in Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label>
                {discountType === 'percentage' ? 'Discount Percentage' : 'Discount Amount'}
              </Label>
              <div className="relative mt-1">
                {discountType === 'fixed' && (
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
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
                Discount: ${(discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue).toFixed(2)}
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
                  -${lastRefundData.refundAmount.toFixed(2)}
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
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : lastTransaction ? (
            <div className="space-y-4">
              <div className="text-center py-4 border-b">
                <div className="text-2xl font-bold text-green-600">
                  ${(lastTransaction.total || 0).toFixed(2)}
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
                  <span>{new Date(lastTransaction.created_at || '').toLocaleString()}</span>
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
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F2</kbd>
                <span>Search Products</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F4</kbd>
                <span>Clear Cart</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F8</kbd>
                <span>Add Discount</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F10</kbd>
                <span>Select Customer</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F12</kbd>
                <span>Process Payment</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
                <span>Close Dialogs</span>
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
