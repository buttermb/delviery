/**
 * ProductLink - Clickable cross-link to a product in the inventory hub.
 * Renders as an inline link with hover underline and a subtle icon.
 * Falls back to plain text if no productId is provided.
 */

import { Link, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface ProductLinkProps {
  productId?: string | null;
  productName: string;
  className?: string;
}

export function ProductLink({ productId, productName, className = "" }: ProductLinkProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  if (!productId || !tenantSlug) {
    return <span className={className}>{productName}</span>;
  }

  return (
    <Link
      to={`/${tenantSlug}/admin/inventory-hub?tab=products&product=${productId}`}
      className={`inline-flex items-center gap-1 text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors ${className}`}
      onClick={(e) => e.stopPropagation()}
      title={`View product: ${productName}`}
    >
      {productName}
      <ExternalLink className="h-3 w-3 opacity-40 group-hover:opacity-70 flex-shrink-0" />
    </Link>
  );
}
