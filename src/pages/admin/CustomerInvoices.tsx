import { logger } from '@/lib/logger';
// Customer Invoices page with pagination support
import { useState, useEffect } from 'react';
import { useTenantAdminAuth } from '@/contexts/TenantAdminAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FileText, Plus, Mail, DollarSign, Calendar, User, Trash2, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SEOHead } from '@/components/SEOHead';
import { format } from 'date-fns';
import { callAdminFunction } from '@/utils/adminFunctionHelper';
import { PageHeader } from '@/components/shared/PageHeader';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { EnhancedLoadingState } from '@/components/EnhancedLoadingState';

const PAGE_SIZE = 25;

interface LineItem {
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
  const { toast } = useToast();
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
    { description: '', quantity: 1, rate: 0, amount: 0 }
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
      const { data, error, count } = await (supabase as any)
        .from('customer_invoices')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        const newData = data || [];

        // Clear client-side cache when using direct query (server-side pagination)
        if (!append) {
          setAllInvoices([]);
        }

        if (append) {
          setInvoices(prev => {
            const updated = [...prev, ...newData];
            // Check if there are more invoices to load
            const totalCount = count || 0;
            setHasMore(updated.length < totalCount);
            return updated;
          });
        } else {
          setInvoices(newData);
          // Check if there are more invoices to load
          const totalCount = count || 0;
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
          const { data: rpcData, error: rpcError } = await (supabase as any).rpc('get_tenant_invoices', {
            tenant_id: tenant.id,
          });
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
        } catch (e) {
          // Fall through to edge function
        }

        // Fallback: Try Edge Function
        const { data: edgeData, error: edgeError } = await callAdminFunction({
          functionName: 'invoice-management',
          body: { action: 'list', tenant_id: tenant.id },
          errorMessage: 'Failed to load invoices',
          showToast: false,
        });

        if (!edgeError && edgeData && typeof edgeData === 'object' && 'invoices' in edgeData && Array.isArray((edgeData as any).invoices)) {
          const invoicesData = (edgeData as any).invoices;
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
      setCustomers(data || []);
    } catch (error) {
      logger.error('Error loading customers', error instanceof Error ? error : new Error(String(error)), { component: 'CustomerInvoices' });
    }
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, rate: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

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

    try {
      setIsSubmitting(true);

      // Prefer generating a unique invoice number via RPC (guaranteed unique per tenant/year)
      let invoiceNumber = `INV-${Date.now()}`;
      try {
        const { data: genNum, error: genErr } = await (supabase as any).rpc('generate_invoice_number', {
          tenant_id: tenant.id,
        });
        if (!genErr && typeof genNum === 'string' && genNum.trim()) {
          invoiceNumber = genNum;
        }
      } catch (_e) {
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
      const { data: edgeData, error: edgeError } = await callAdminFunction({
        functionName: 'invoice-management',
        body: { action: 'create', tenant_id: tenant.id, invoice_data: invoiceData },
        errorMessage: 'Failed to create invoice',
        showToast: false,
      });

      if (edgeError) {
        // Fallback to direct insert
        const { error } = await supabase
          .from('customer_invoices')
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
          } as any);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Invoice created successfully'
      });

      setIsDialogOpen(false);
      setFormData({
        customer_id: '',
        due_date: '',
        payment_terms: 'net_30',
        notes: '',
        reference_number: '',
        tax_rate: '8.875'
      });
      setLineItems([{ description: '', quantity: 1, rate: 0, amount: 0 }]);
      // Reset pagination and reload from page 1
      setCurrentPage(1);
      setAllInvoices([]); // Clear stored invoices
      loadInvoices(1, false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-primary/10 text-primary border-primary/20';
      case 'unpaid': return 'bg-orange-500/10 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-700';
      case 'overdue': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  if (accountLoading || loading) {
    return <EnhancedLoadingState variant="spinner" message="Loading invoices..." />;
  }

  return (
    <div className="space-y-6">
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer & Invoice Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer">Customer *</Label>
                  <select
                    id="customer"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={formData.customer_id}
                    onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                    required
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer: Customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name} ({customer.email})
                      </option>
                    ))}
                  </select>
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
                      <SelectValue />
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
                    <div key={index} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <Input
                          placeholder="Description / Service"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
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
                    <span>Tax Rate:</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.001"
                        value={formData.tax_rate}
                        onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
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
                      Invoice #{invoice.invoice_number}
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
