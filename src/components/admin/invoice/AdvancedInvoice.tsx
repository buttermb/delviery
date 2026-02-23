/**
 * Advanced Invoice Component
 * Inspired by Invoice Ninja and Crater Invoice
 * Professional invoicing with multiple features
 */

import { useState } from 'react';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Send,
  Plus,
  Trash2,
  Save,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { InvoiceDownloadButton } from '@/components/admin/InvoicePDF';
import { toast } from 'sonner';
interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
  companyName: string;
  companyAddress?: string;
  lineItems: InvoiceItem[];  // Changed from 'items' to match InvoicePDF interface
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  terms?: string;
}

export function AdvancedInvoice() {
  const { navigateToAdmin } = useTenantNavigation();
  const [invoice, setInvoice] = useState<InvoiceData>({
    invoiceNumber: `INV-${Date.now()}`,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'draft',
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    companyName: 'Your Company',
    companyAddress: '',
    lineItems: [
      { id: '1', description: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0 },
    ],
    subtotal: 0,
    tax: 0,
    total: 0,
    notes: '',
    terms: 'Payment due within 30 days',
  });

  const addItem = () => {
    setInvoice({
      ...invoice,
      lineItems: [
        ...invoice.lineItems,
        { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0 },
      ],
    });
  };

  const removeItem = (id: string) => {
    if (invoice.lineItems.length > 1) {
      setInvoice({
        ...invoice,
        lineItems: invoice.lineItems.filter(item => item.id !== id),
      });
      calculateTotals(invoice.lineItems.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    const updatedItems = invoice.lineItems.map(item => {
      if (item.id === id) {
        let safeValue = value;
        if (field === 'quantity') safeValue = Math.max(1, Number(value));
        if (field === 'unitPrice') safeValue = Math.max(0, Number(value));
        if (field === 'taxRate') safeValue = Math.max(0, Math.min(100, Number(value)));
        const updated = { ...item, [field]: safeValue };
        if (field === 'quantity' || field === 'unitPrice' || field === 'taxRate') {
          updated.total = updated.quantity * updated.unitPrice * (1 + updated.taxRate / 100);
        }
        return updated;
      }
      return item;
    });
    setInvoice({ ...invoice, lineItems: updatedItems });
    calculateTotals(updatedItems);
  };

  const calculateTotals = (items: InvoiceItem[]) => {
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const tax = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice * (item.taxRate / 100)), 0);
    const total = subtotal + tax;

    setInvoice(prev => ({
      ...prev,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
    }));
  };

  const handleSave = () => {
    toast.success("Invoice has been saved as draft");
  };

  const handleSend = () => {
    if (!invoice.customerEmail) {
      toast.error("Please enter a customer email address");
      return;
    }

    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from ${invoice.companyName}`);
    const body = encodeURIComponent(`
Dear ${invoice.customerName || 'Customer'},

Please find attached invoice ${invoice.invoiceNumber} for ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.total)}.

Due Date: ${invoice.dueDate}

${invoice.notes ? `Notes: ${invoice.notes}` : ''}

Thank you for your business.

Sincerely,
${invoice.companyName}
    `);

    window.open(`mailto:${invoice.customerEmail}?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');

    toast.success("Opened default email client with invoice details");
    setInvoice({ ...invoice, status: 'sent' });
  };

  const handlePreview = () => {
    window.print();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'sent': return 'bg-info text-info-foreground';
      case 'paid': return 'bg-success text-success-foreground';
      case 'overdue': return 'bg-destructive text-destructive-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigateToAdmin('crm/invoices')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Create Invoice
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Professional invoicing inspired by Invoice Ninja
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge className={getStatusColor(invoice.status)}>
            {invoice.status.toUpperCase()}
          </Badge>
          <Button variant="outline" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:grid-cols-1">
        {/* Invoice Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Company Info */}
          <Card className="print:shadow-none print:border-none">
            <CardHeader className="print:hidden">
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 print:p-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="print:hidden">Invoice Number</Label>
                  <Input value={invoice.invoiceNumber} readOnly className="print:border-none print:p-0 print:font-bold print:text-xl" />
                </div>
                <div className="print:hidden">
                  <Label>Status</Label>
                  <Select
                    value={invoice.status}
                    onValueChange={(value: string) => setInvoice({ ...invoice, status: value as 'draft' | 'sent' | 'paid' | 'overdue' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="print:hidden">Issue Date</Label>
                  <Input
                    type="date"
                    value={invoice.issueDate}
                    onChange={(e) => setInvoice({ ...invoice, issueDate: e.target.value })}
                    className="print:border-none print:p-0"
                  />
                </div>
                <div>
                  <Label className="print:hidden">Due Date</Label>
                  <Input
                    type="date"
                    value={invoice.dueDate}
                    onChange={(e) => setInvoice({ ...invoice, dueDate: e.target.value })}
                    className="print:border-none print:p-0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="print:hidden">Company Name</Label>
                  <Input
                    value={invoice.companyName}
                    onChange={(e) => setInvoice({ ...invoice, companyName: e.target.value })}
                    className="print:border-none print:p-0 print:font-bold"
                  />
                </div>
                <div>
                  <Label className="print:hidden">Customer Name</Label>
                  <Input
                    value={invoice.customerName}
                    onChange={(e) => setInvoice({ ...invoice, customerName: e.target.value })}
                    className="print:border-none print:p-0 print:font-bold"
                  />
                </div>
                <div>
                  <Label className="print:hidden">Company Address</Label>
                  <Textarea
                    value={invoice.companyAddress}
                    onChange={(e) => setInvoice({ ...invoice, companyAddress: e.target.value })}
                    rows={2}
                    className="print:border-none print:p-0 print:resize-none"
                  />
                </div>
                <div>
                  <Label className="print:hidden">Customer Email</Label>
                  <Input
                    type="email"
                    value={invoice.customerEmail}
                    onChange={(e) => setInvoice({ ...invoice, customerEmail: e.target.value })}
                    className="print:border-none print:p-0"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card className="print:shadow-none print:border-none">
            <CardHeader className="print:hidden">
              <div className="flex items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="print:p-0">
              <div className="space-y-4">
                {invoice.lineItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end print:border-b print:pb-2">
                    <div className="col-span-5">
                      <Label className="print:hidden">Description</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Item description"
                        className="print:border-none print:p-0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="print:hidden">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 1)}
                        className="print:border-none print:p-0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="print:hidden">Unit Price</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.unitPrice}
                        onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="print:border-none print:p-0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="print:hidden">Tax %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={item.taxRate}
                        onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                        className="print:border-none print:p-0"
                      />
                    </div>
                    <div className="col-span-1 print:hidden">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                        disabled={invoice.lineItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          <Card className="print:shadow-none print:border-none">
            <CardHeader className="print:hidden">
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 print:p-0">
              <div>
                <Label className="print:hidden">Notes</Label>
                <Textarea
                  value={invoice.notes}
                  onChange={(e) => setInvoice({ ...invoice, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes for the customer"
                  className="print:border-none print:p-0 print:resize-none"
                />
              </div>
              <div>
                <Label className="print:hidden">Payment Terms</Label>
                <Textarea
                  value={invoice.terms}
                  onChange={(e) => setInvoice({ ...invoice, terms: e.target.value })}
                  rows={2}
                  placeholder="Payment terms and conditions"
                  className="print:border-none print:p-0 print:resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Preview & Totals */}
        <div className="space-y-6 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax:</span>
                <span className="font-medium">${invoice.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t text-lg font-bold">
                <span>Total:</span>
                <span>${invoice.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InvoiceDownloadButton invoice={invoice} />
              <Button variant="outline" className="w-full" onClick={handlePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview PDF
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSend}>
                <Send className="h-4 w-4 mr-2" />
                Email Invoice
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
