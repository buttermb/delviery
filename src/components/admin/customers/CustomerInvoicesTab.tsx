/**
 * CustomerInvoicesTab Component
 *
 * Displays a list of invoices for a specific customer in their profile.
 * Shows invoice number, status, amount, due date, and actions.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useCustomerInvoices } from '@/hooks/useCustomerInvoices';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';
import { EnhancedEmptyState } from '@/components/shared/EnhancedEmptyState';
import { FileText, Calendar, DollarSign, Mail, Eye, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerInvoicesTabProps {
  customerId: string;
  onCreateInvoice?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadgeStyles(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'paid':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'unpaid':
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    case 'overdue':
      return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    case 'draft':
      return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-800';
    case 'cancelled':
    case 'void':
      return 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function getStatusLabel(status: string | null): string {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function CustomerInvoicesTab({ customerId, onCreateInvoice }: CustomerInvoicesTabProps) {
  const { data: invoices, isLoading, isError } = useCustomerInvoices(customerId);
  const { navigateToAdmin } = useTenantNavigation();

  if (isLoading) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
                <Skeleton className="h-4 w-48 mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load invoices. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const totalInvoiced = invoices?.reduce((sum, inv) => sum + inv.total, 0) ?? 0;
  const paidInvoices = invoices?.filter((inv) => inv.status?.toLowerCase() === 'paid') ?? [];
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const unpaidInvoices = invoices?.filter(
    (inv) => inv.status?.toLowerCase() === 'unpaid' || inv.status?.toLowerCase() === 'pending' || inv.status?.toLowerCase() === 'overdue'
  ) ?? [];
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <Card className="bg-[hsl(var(--tenant-bg))] border-[hsl(var(--tenant-border))] shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-[hsl(var(--tenant-text))]">Invoices</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            if (onCreateInvoice) {
              onCreateInvoice();
            } else {
              navigateToAdmin(`customers/${customerId}/invoices`);
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        {invoices && invoices.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total Invoiced</p>
                <p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
                <p className="text-xs text-muted-foreground mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">{paidInvoices.length} invoice{paidInvoices.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className={`text-2xl font-bold ${totalUnpaid > 0 ? 'text-amber-600' : ''}`}>{formatCurrency(totalUnpaid)}</p>
                <p className="text-xs text-muted-foreground mt-1">{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <Separator className="mb-4" />
          </>
        )}

        {/* Invoice List */}
        <div className="space-y-4">
          {!invoices || invoices.length === 0 ? (
            <EnhancedEmptyState
              icon={FileText}
              title="No Invoices Yet"
              description="Create the first invoice for this customer."
              primaryAction={{
                label: "Create Invoice",
                onClick: () => {
                  if (onCreateInvoice) {
                    onCreateInvoice();
                  } else {
                    navigateToAdmin(`customers/${customerId}/invoices`);
                  }
                },
                icon: Plus,
              }}
              compact
            />
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">Invoice #{invoice.invoice_number}</p>
                      <Badge className={getStatusBadgeStyles(invoice.status)}>
                        {invoice.status?.toLowerCase() === 'paid' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                      </span>
                      {invoice.created_at && (
                        <span className="flex items-center gap-1">
                          Created {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">{formatCurrency(invoice.total)}</p>
                    {invoice.paid_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Paid {format(new Date(invoice.paid_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Invoice Details */}
                {(invoice.subtotal !== invoice.total || invoice.tax || invoice.discount) && (
                  <div className="text-sm text-muted-foreground mb-3 flex gap-4">
                    <span>Subtotal: {formatCurrency(invoice.subtotal)}</span>
                    {invoice.tax !== null && invoice.tax > 0 && (
                      <span>Tax: {formatCurrency(invoice.tax)}</span>
                    )}
                    {invoice.discount !== null && invoice.discount > 0 && (
                      <span>Discount: -{formatCurrency(invoice.discount)}</span>
                    )}
                  </div>
                )}

                {invoice.notes && (
                  <p className="text-sm text-muted-foreground mb-3 italic">"{invoice.notes}"</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigateToAdmin(`invoices/${invoice.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Mail className="w-4 h-4 mr-2" />
                    Send
                  </Button>
                  {invoice.status?.toLowerCase() !== 'paid' && (
                    <Button size="sm">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Record Payment
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
