import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatSmartDate } from "@/lib/utils/formatDate";

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  status: string;
  issue_date: string;
  due_date?: string;
  stripe_invoice_id?: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
  onViewInvoice?: (invoiceId: string) => void;
  onDownloadInvoice?: (invoiceId: string) => void;
}

export function InvoiceList({ invoices, onViewInvoice, onDownloadInvoice }: InvoiceListProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      open: "secondary",
      draft: "outline",
      void: "outline",
      uncollectible: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No invoices yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => (
        <Card key={invoice.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">
                      Issued: {formatSmartDate(invoice.issue_date)}
                    </p>
                    {invoice.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due: {formatSmartDate(invoice.due_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold text-lg">{formatCurrency(invoice.total)}</p>
                  {getStatusBadge(invoice.status)}
                </div>

                <div className="flex gap-2">
                  {onViewInvoice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewInvoice(invoice.id)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  {onDownloadInvoice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadInvoice(invoice.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

