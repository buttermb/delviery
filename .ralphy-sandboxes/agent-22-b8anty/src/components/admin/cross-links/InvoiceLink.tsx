/**
 * InvoiceLink - Clickable cross-link to an invoice detail page.
 * Renders as an inline link with hover underline and a subtle icon.
 * Falls back to plain text if no invoiceId is provided.
 */

import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface InvoiceLinkProps {
  invoiceId?: string | null;
  invoiceNumber: string;
  className?: string;
}

export function InvoiceLink({ invoiceId, invoiceNumber, className = "" }: InvoiceLinkProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!invoiceId || !tenantSlug) {
    return <span className={className}>{invoiceNumber}</span>;
  }

  return (
    <Link
      to={`/${tenantSlug}/admin/crm/invoices/${invoiceId}`}
      className={`inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
      title={`View invoice: ${invoiceNumber}`}
    >
      {invoiceNumber}
      <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-70 flex-shrink-0" />
    </Link>
  );
}
