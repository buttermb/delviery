import { useMemo, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { PortalInvoice } from '@/types/portal';
import { generateInvoicePDF } from './InvoicePDFGenerator';
import { logger } from '@/lib/logger';
import { showErrorToast } from '@/utils/toastHelpers';

export interface InvoiceTableProps {
  invoices: PortalInvoice[];
  clientName?: string;
  clientAddress?: string;
}

export function InvoiceTable({ invoices, clientName, clientAddress }: InvoiceTableProps) {
  const isMobile = useIsMobile();
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      return new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime();
    });
  }, [invoices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'sent':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'overdue':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'draft':
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const handleGeneratePDF = (invoice: PortalInvoice) => {
    try {
      setGeneratingPDF(invoice.id);
      generateInvoicePDF({
        invoice,
        clientName,
        clientAddress,
      });
    } catch (error: unknown) {
      logger.error('Failed to generate PDF', error, { component: 'InvoiceTable', invoiceId: invoice.id });
      showErrorToast('Failed to generate PDF');
    } finally {
      setGeneratingPDF(null);
    }
  };

  if (sortedInvoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
        <p>No invoices found</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-4">
        {sortedInvoices.map((invoice) => (
          <Card key={invoice.id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{invoice.invoice_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(invoice.issue_date), 'MMM dd, yyyy')}
                  </div>
                </div>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.status}
                </Badge>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <div>
                  <div className="text-sm text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">
                    ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleGeneratePDF(invoice)}
                  disabled={generatingPDF === invoice.id}
                >
                  {generatingPDF === invoice.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Desktop: Table layout
  return (
    <div className="rounded-md border dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedInvoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
              <TableCell>{format(new Date(invoice.issue_date), 'MMM dd, yyyy')}</TableCell>
              <TableCell>{format(new Date(invoice.due_date), 'MMM dd, yyyy')}</TableCell>
              <TableCell className="font-semibold">
                ${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleGeneratePDF(invoice)}
                  disabled={generatingPDF === invoice.id}
                >
                  {generatingPDF === invoice.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

