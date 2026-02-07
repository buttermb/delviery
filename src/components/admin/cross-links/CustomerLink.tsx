/**
 * CustomerLink - Clickable cross-link to a customer/client detail page.
 * Renders as an inline link with hover underline and a subtle icon.
 * Falls back to plain text if no customerId is provided.
 */

import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface CustomerLinkProps {
  customerId?: string | null;
  customerName: string;
  className?: string;
}

export function CustomerLink({ customerId, customerName, className = "" }: CustomerLinkProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!customerId || !tenantSlug) {
    return <span className={className}>{customerName}</span>;
  }

  return (
    <Link
      to={`/${tenantSlug}/admin/crm/clients/${customerId}`}
      className={`inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
      title={`View customer: ${customerName}`}
    >
      {customerName}
      <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-70 flex-shrink-0" />
    </Link>
  );
}
