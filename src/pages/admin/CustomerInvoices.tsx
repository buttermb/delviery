import { logger } from '@/lib/logger';
// Customer Invoices page with pagination support
import { useState, useEffect } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceLink } from '@/components/admin/cross-links';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput, IntegerInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Plus, Mail, DollarSign, Calendar, User, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { callAdminFunction } from '@/utils/adminFunctionHelper';
import { PageHeader } from '@/components/shared/PageHeader';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';
import { displayName, displayValue } from '@/lib/formatters';

const PAGE_SIZE = 25;

interface _LineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  status: string;
  total: number;
  due_date?: string;
  created_at: string;
}

export default function CustomerInvoices() {
  const { tenant, loading: accountLoading } = useTenantAdminAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]); // Store all invoices when using client-side pagination
  const [lineItems, setLineItems] = useState([
    { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }
  ]);
  const [formData, setFormData] = useState({
    customer_id: '',
    due_date: '',
    payment_terms: 'net_30',
    notes: '',
    reference_number: '',
    tax_rate: '8.875',
  });

  useEffect(() => {
    if (tenant && !accountLoading) {
      loadInvoices();
      loadCustomers();
    } else if (!accountLoading && !tenant) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, accountLoading]);

  const loadInvoices = async (page: number = 1, append: boolean = false) => {
    if (!tenant) return;

    try {
      if (append) {
        setIsLoadingMore(true);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Try direct query with pagination first (most reliable for pagination)
      const { data, error, count } = await supabase
        .from('customer_invoices' as 'tenants')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        logger.warn('customer_invoices direct query failed, trying RPC fallback', {
          component: 'CustomerInvoices',
          error,
        });
      }

      if (!error && data) {
        const newData = data ?? [];

        // Clear client-side cache when using direct query (server-side pagination)
        if (!append) {
          setAllInvoices([]);
        }

        if (append) {
          setInvoices(prev => {
            const updated = [...prev, ...newData];
            // Check if there are more invoices to load
            const totalCount = count ?? 0;
            setHasMore(updated.length < totalCount);
            return updated;
          });
        } else {
          setInvoices(newData);
          // Check if there are more invoices to load
          const totalCount = count ?? 0;
          setHasMore(newData.length < totalCount);
        }

        setCurrentPage(page);

        if (!append) {
          setLoading(false);
        }
        setIsLoadingMore(false);
        return;
      }

      // Fallback: Try RPC (may not support pagination, so load all and paginate client-side)
      if (page === 1) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_tenant_invoices' as 'get_secret', {
            tenant_id: tenant.id,
          } as Record<string, unknown>);
          if (rpcError) {
            logger.warn('get_tenant_invoices RPC failed, trying edge function', {
              component: 'CustomerInvoices',
              error: rpcError,
            });
          }
          if (!rpcError && Array.isArray(rpcData)) {
            // Store all invoices for client-side pagination
            setAllInvoices(rpcData);
            const paginatedData = rpcData.slice(0, PAGE_SIZE);
            setInvoices(paginatedData);
            setHasMore(rpcData.length > PAGE_SIZE);
            setCurrentPage(1);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to edge function
        }

        // Fallback: Try Edge Function
        const { data: edgeData, error: edgeError } = await callAdminFunction({
          functionName: 'invoice-management',
          body: { action: 'list', tenant_id: tenant.id },
          errorMessage: 'Failed to load invoices',
          showToast: false,
        });

        const edgeRecord = edgeData as Record<string, unknown> | null;
        if (!edgeError && edgeRecord && typeof edgeRecord === 'object' && 'invoices' in edgeRecord && Array.isArray(edgeRecord.invoices)) {
          const invoicesData = edgeRecord.invoices as Invoice[];
          // Store all invoices for client-side pagination
          setAllInvoices(invoicesData);
          const paginatedData = invoicesData.slice(0, PAGE_SIZE);
          setInvoices(paginatedData);
          setHasMore(invoicesData.length > PAGE_SIZE);
          setCurrentPage(1);
          setLoading(false);
          return;
        }
      }

      // If we have all invoices stored (from RPC/Edge Function fallback), use client-side pagination
      if (allInvoices.length > 0 && page > 1) {
        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE;
        const paginatedData = allInvoices.slice(from, to);

        if (append) {
          setInvoices(prev => [...prev, ...paginatedData]);
        } else {
          setInvoices(paginatedData);
        }

        setHasMore(to < allInvoices.length);
        setCurrentPage(page);
        setIsLoadingMore(false);
        if (!append) {
          setLoading(false);
        }
        return;
      }

      if (error) throw error;
    } catch (error) {
      logger.error('Error loading invoices', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerInvoices' });
      if (!append) {
        setLoading(false);
      }
      setIsLoadingMore(false);
    }
  };

  const loadMoreInvoices = async () => {
    if (isLoadingMore || !hasMore) return;
    await loadInvoices(currentPage + 1, true);
  };

  const loadCustomers = async () => {
    if (!tenant) return;

    try {
      // Get customers from the customers table
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenant.id);

      if (error) throw error;
      setCustomers(data ?? []);
    } catch (error) {
      logger.error('Error loading customers', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerInvoices' });
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    let safeValue = value;
    if (field === 'quantity') safeValue = Math.max(1, Number(value));
    if (field === 'rate') safeValue = Math.max(0, Number(value));
    updated[index] = { ...updated[index], [field]: safeValue };

    // Calculate amount
    if (field === 'quantity' || field === 'rate') {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }

    setLineItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = parseFloat(formData.tax_rate) / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    const { subtotal, tax, total } = calculateTotals();

    if (total < 0 || subtotal < 0) {
      toast.error("Invoice total cannot be negative");
      return;
    }

    try {
      setIsSubmitting(true);

      // Prefer generating a unique invoice number via RPC (guaranteed unique per tenant/year)
      let invoiceNumber = `INV-${Date.now()}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: genNum, error: genErr } = await supabase.rpc('generate_invoice_number' as 'get_secret', {
          tenant_id: tenant.id,
        } as Record<string, unknown>);
        if (genErr) {
          logger.warn('generate_invoice_number RPC failed, using timestamp fallback', {
            component: 'CustomerInvoices',
            error: genErr,
          });
        }
        if (!genErr && typeof genNum === 'string' && genNum.trim()) {
          invoiceNumber = genNum;
        }
      } catch {
        // Fallback to timestamp-based number
      }

      // Map line items to edge function expected format (unit_price, total instead of rate, amount)
      const mappedLineItems = lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.rate,  // Edge function expects unit_price
        total: item.amount,     // Edge function expects total
      }));

      const invoiceData = {
        tenant_id: tenant.id,
        customer_id: formData.customer_id,
        invoice_number: invoiceNumber,
        subtotal,
        tax,
        total,
        amount_paid: 0,
        amount_due: total,
        status: 'draft',
        line_items: mappedLineItems,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: formData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      // Try using Edge Function first
      const { error: edgeError } = await callAdminFunction({
        functionName: 'invoice-management',
        body: { action: 'create', tenant_id: tenant.id, invoice_data: invoiceData },
        errorMessage: 'Failed to create invoice',
        showToast: false,
      });

      if (edgeError) {
        // Fallback to direct insert
        const { error } = await supabase
          .from('customer_invoices' as 'tenants')
          .insert({
            tenant_id: tenant.id,
            customer_id: formData.customer_id,
            invoice_number: invoiceNumber,
            subtotal,
            tax,
            total,
            status: 'unpaid',
            due_date: formData.due_date || null,
            notes: formData.notes || null,
          } as Record<string, unknown>);

        if (error) throw error;
      }

      toast.success("Invoice created successfully");

      setIsDialogOpen(false);
      setFormData({
        customer_id: '',
        due_date: '',
        payment_terms: 'net_30',
        notes: '',
        reference_number: '',
        tax_rate: '8.875'
      });
      setLineItems([{ id: crypto.randomUUID(), description: '', quantity: 1, rate: 0, amount: 0 }]);
      // Reset pagination and reload from page 1
      setCurrentPage(1);
      setAllInvoices([]); // Clear stored invoices
      loadInvoices(1, false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to create invoice: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
      case 'partially_paid':
      case 'partial':
      case 'unpaid': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
      case 'cancelled':
      case 'void': return 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100/10 dark:text-gray-300 dark:border-gray-600';
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700';
      default: return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-700';
    }
  };

  if (accountLoading || loading) {
    return <EnhancedLoadingState variant="spinner" message="Loading invoices..." />;
  }

  return (
    <div className="space-y-4">
      <SEOHead
        title="Customer Invoices"
        description="Manage customer invoices and payments"
      />

      <div className="flex items-center justify-between">
        <PageHeader
          title="Customer Invoices"
          description="Create and track customer invoices"
          actions={
            <Button onClick={() => setIsDialogOpen(true)} data-component="CustomerInvoices" data-action="open-create-invoice">
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          }
          className="w-full"
        />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer & Invoice Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <Select value={formData.customer_id} onValueChange={(v) => setFormData({ ...formData, customer_id: v })}>
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer: Customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {displayName(customer.first_name, customer.last_name)} ({displayValue(customer.email, 'No email')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reference">Reference Number</Label>
                  <Input
                    id="reference"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="PO-12345"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                      <SelectItem value="net_15">Net 15</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
                      <SelectItem value="net_60">Net 60</SelectItem>
                      <SelectItem value="net_90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" size="sm" onClick={addLineItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="border rounded-lg p-4 space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <Input
                          placeholder="Description / Service"
                          aria-label="Line item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <IntegerInput
                          placeholder="Qty"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <CurrencyInput
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.amount.toFixed(2)}
                          disabled
                          aria-label="Line item amount"
                          className="bg-muted"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        {lineItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="space-y-2 max-w-sm ml-auto">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-semibold">${calculateTotals().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm gap-4">
                    <span>Sales Tax:</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.001"
                        min={0}
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: String(Math.max(0, parseFloat(e.target.value) || 0)) })}
                        aria-label="Sales tax percentage"
                        className="w-20 h-8 text-right"
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span className="font-semibold">${calculateTotals().tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-base font-bold">
                    <span>Total:</span>
                    <span className="text-primary">${calculateTotals().total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Notes / Memo</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes or payment instructions..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} aria-live="polite">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Invoice'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      <InvoiceLink
                        invoiceId={invoice.id}
                        invoiceNumber={`Invoice #${invoice.invoice_number}`}
                      />
                    </h3>
                    <Badge className={getStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Customer #{invoice.customer_id?.substring(0, 8)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    ${invoice.total.toFixed(2)}
                  </div>
                  {invoice.due_date && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invoice
                </Button>
                <Button size="sm" variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  View PDF
                </Button>
                {invoice.status === 'unpaid' && (
                  <Button size="sm">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Record Payment
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center my-6">
          <Button onClick={loadMoreInvoices} disabled={isLoadingMore} aria-busy={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}

      {invoices.length === 0 && (
        <EnhancedEmptyState
          icon={FileText}
          title="No Invoices Yet"
          description="Create your first invoice to get started."
          primaryAction={{
            label: "Create Invoice",
            onClick: () => setIsDialogOpen(true),
            icon: Plus
          }}
        />
      )}
    </div>
  );
}
