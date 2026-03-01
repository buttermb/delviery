import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  DollarSign,
  Plus,
  Loader2,
  Calendar,
  AlertTriangle,
  CreditCard,
  FileText,
  CheckCircle2,
  Clock,
  Banknote,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/integrations/supabase/client';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { humanizeError } from '@/lib/humanizeError';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatSmartDate } from '@/lib/formatters';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { StandardPagination } from '@/components/shared/StandardPagination';
import { usePagination } from '@/hooks/usePagination';

interface VendorPaymentTrackingProps {
  vendorId: string;
  vendorName: string;
}

interface VendorPayment {
  id: string;
  tenant_id: string;
  vendor_id: string;
  purchase_order_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  purchase_orders?: {
    po_number: string;
    total: number;
  } | null;
}

interface PurchaseOrderOption {
  id: string;
  po_number: string;
  total: number;
  payment_status: string | null;
  paid_amount: number | null;
}

const paymentFormSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.string().min(1, 'Payment method is required'),
  purchase_order_id: z.string().optional(),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'ach', label: 'ACH' },
  { value: 'wire', label: 'Wire Transfer' },
  { value: 'other', label: 'Other' },
];

export function VendorPaymentTracking({ vendorId, vendorName }: VendorPaymentTrackingProps) {
  const { tenant, admin } = useTenantAdminAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: 0,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: '',
      purchase_order_id: '',
      reference_number: '',
      notes: '',
    },
  });

  // Fetch vendor payments
  const { data: payments, isLoading: paymentsLoading, error: paymentsError } = useQuery({
    queryKey: queryKeys.vendors.payments(tenant?.id ?? '', vendorId),
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('vendor_payments')
        .select(`
          *,
          purchase_orders (
            po_number,
            total
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('vendor_id', vendorId)
        .order('payment_date', { ascending: false });

      if (error) {
        logger.error('Failed to fetch vendor payments', error, { component: 'VendorPaymentTracking' });
        throw error;
      }

      return (data ?? []) as VendorPayment[];
    },
    enabled: !!tenant?.id && !!vendorId,
  });

  // Fetch unpaid/partially paid purchase orders for dropdown
  const { data: purchaseOrders } = useQuery({
    queryKey: [...queryKeys.vendors.orders(tenant?.id ?? '', vendorId), 'unpaid'],
    queryFn: async () => {
      if (!tenant?.id) return [];

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number, total, payment_status, paid_amount')
        .eq('account_id', tenant.id)
        .eq('vendor_id', vendorId)
        .in('payment_status', ['unpaid', 'partial'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch purchase orders', error, { component: 'VendorPaymentTracking' });
        return [];
      }

      return (data ?? []) as PurchaseOrderOption[];
    },
    enabled: !!tenant?.id && !!vendorId,
  });

  // Calculate vendor summary stats
  const stats = useMemo(() => {
    if (!payments) return { totalPaid: 0, paymentsCount: 0, thisMonthPaid: 0 };

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPaid = 0;
    let thisMonthPaid = 0;

    payments.forEach((payment) => {
      totalPaid += payment.amount;

      const paymentDate = new Date(payment.payment_date);
      if (paymentDate >= firstOfMonth) {
        thisMonthPaid += payment.amount;
      }
    });

    return {
      totalPaid,
      paymentsCount: payments.length,
      thisMonthPaid,
    };
  }, [payments]);

  // Calculate outstanding balance (sum of unpaid PO amounts)
  const outstandingBalance = useMemo(() => {
    if (!purchaseOrders) return 0;

    return purchaseOrders.reduce((total, po) => {
      const remaining = po.total - (po.paid_amount ?? 0);
      return total + remaining;
    }, 0);
  }, [purchaseOrders]);

  // Pagination
  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedData,
    goToPage,
    previousPage: _prevPage,
    nextPage: _nextPage,
    changePageSize,
  } = usePagination(payments ?? [], {
    defaultPageSize: 10,
  });

  // Create payment mutation
  const createPayment = useMutation({
    mutationFn: async (values: PaymentFormValues) => {
      if (!tenant?.id) throw new Error('No tenant ID');

      const { data, error } = await supabase
        .from('vendor_payments')
        .insert({
          tenant_id: tenant.id,
          vendor_id: vendorId,
          amount: values.amount,
          payment_date: values.payment_date,
          payment_method: values.payment_method,
          purchase_order_id: values.purchase_order_id || null,
          reference_number: values.reference_number || null,
          notes: values.notes || null,
          created_by: admin?.id,
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.payments(tenant?.id ?? '', vendorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.orders(tenant?.id ?? '', vendorId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
      toast.success('Payment recorded successfully');
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      logger.error('Failed to create payment', error, { component: 'VendorPaymentTracking' });
      toast.error('Failed to record payment', { description: humanizeError(error) });
    },
  });

  const onSubmit = (values: PaymentFormValues) => {
    createPayment.mutate(values);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return formatSmartDate(dateString);
  };

  const getPaymentMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find(m => m.value === method)?.label || method;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="h-4 w-4" />;
      case 'check':
        return <FileText className="h-4 w-4" />;
      case 'credit_card':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  // Handle PO selection to auto-fill remaining balance
  const handlePOSelect = (poId: string) => {
    form.setValue('purchase_order_id', poId);
    if (poId) {
      const po = purchaseOrders?.find(p => p.id === poId);
      if (po) {
        const remaining = po.total - (po.paid_amount ?? 0);
        form.setValue('amount', remaining);
      }
    }
  };

  if (paymentsError) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-destructive">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load payment history. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(outstandingBalance)}</div>
            <p className="text-xs text-muted-foreground">Unpaid PO amounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid (All Time)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{stats.paymentsCount} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthPaid)}</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid POs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseOrders?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>
                All payments made to {vendorName}
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Record Vendor Payment</DialogTitle>
                  <DialogDescription>
                    Record a payment made to {vendorName}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="purchase_order_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purchase Order (Optional)</FormLabel>
                          <Select
                            onValueChange={(v) => handlePOSelect(v === '__none__' ? '' : v)}
                            value={field.value || '__none__'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select PO to pay" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">No specific PO</SelectItem>
                              {purchaseOrders?.map((po) => (
                                <SelectItem key={po.id} value={po.id}>
                                  {po.po_number} - {formatCurrency(po.total - (po.paid_amount ?? 0))} remaining
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Amount</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Payment Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payment_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel required>Payment Method</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PAYMENT_METHODS.map((method) => (
                                <SelectItem key={method.value} value={method.value}>
                                  {method.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reference_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Check #, Wire ref, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPayment.isPending}>
                        {createPayment.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Record Payment
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <EnhancedEmptyState
              icon={DollarSign}
              title="No Payments Recorded"
              description={`No payments have been recorded for ${vendorName} yet.`}
              primaryAction={{
                label: 'Record Payment',
                onClick: () => setIsDialogOpen(true),
                icon: Plus,
              }}
            />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Purchase Order</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(payment.payment_date)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(payment.payment_method)}
                            <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.purchase_orders ? (
                            <Badge variant="outline">
                              {payment.purchase_orders.po_number}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.reference_number || '-'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {payment.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <StandardPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                    onPageSizeChange={changePageSize}
                    totalItems={payments.length}
                    pageSize={10}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
