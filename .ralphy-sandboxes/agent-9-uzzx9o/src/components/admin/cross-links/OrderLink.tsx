/**
 * OrderLink - Clickable cross-link to an order detail view.
 * Renders as an inline link with hover underline and a subtle icon.
 * Falls back to plain text if no orderId is provided.
 */

import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface OrderLinkProps {
  orderId?: string | null;
  orderNumber: string;
  className?: string;
}

export function OrderLink({ orderId, orderNumber, className = "" }: OrderLinkProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!orderId || !tenantSlug) {
    return <span className={className}>{orderNumber}</span>;
  }

  return (
    <Link
      to={`/${tenantSlug}/admin/orders?order=${orderId}`}
      className={`inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
      title={`View order: ${orderNumber}`}
    >
      {orderNumber}
      <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-70 flex-shrink-0" />
    </Link>
  );
}
