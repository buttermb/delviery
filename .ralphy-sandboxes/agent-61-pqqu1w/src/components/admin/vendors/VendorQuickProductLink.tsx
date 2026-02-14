/**
 * Vendor Quick Product Link Component
 *
 * Quick action button to add a new product sourced from a vendor.
 * Pre-fills vendor_id and navigates to product creation form.
 */

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTenantNavigation } from '@/lib/navigation/tenantNavigation';

// ============================================================================
// Types
// ============================================================================

interface VendorQuickProductLinkProps {
  vendorId: string;
  vendorName: string;
  /** Optional payment terms to pre-fill */
  paymentTerms?: string | null;
  /** Optional lead time in days to pre-fill */
  leadTimeDays?: number | null;
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show tooltip */
  showTooltip?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function VendorQuickProductLink({
  vendorId,
  vendorName,
  paymentTerms,
  leadTimeDays,
  variant = 'default',
  size = 'default',
  showTooltip = true,
  className,
}: VendorQuickProductLinkProps) {
  const { navigateToAdmin } = useTenantNavigation();

  const handleClick = () => {
    // Build query params for pre-filling the product form
    const params = new URLSearchParams();
    params.set('vendor', vendorName);
    params.set('vendorId', vendorId);

    if (paymentTerms) {
      params.set('paymentTerms', paymentTerms);
    }

    if (leadTimeDays !== null && leadTimeDays !== undefined) {
      params.set('leadTimeDays', String(leadTimeDays));
    }

    navigateToAdmin(`products/new?${params.toString()}`);
  };

  const button = (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={className}
    >
      <Plus className="h-4 w-4 mr-2" />
      Add Product from Vendor
    </Button>
  );

  if (!showTooltip) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent>
          <p>Create a new product sourced from {vendorName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Compact Icon-Only Version
// ============================================================================

interface VendorQuickProductIconProps {
  vendorId: string;
  vendorName: string;
  paymentTerms?: string | null;
  leadTimeDays?: number | null;
  className?: string;
}

export function VendorQuickProductIcon({
  vendorId,
  vendorName,
  paymentTerms,
  leadTimeDays,
  className,
}: VendorQuickProductIconProps) {
  const { navigateToAdmin } = useTenantNavigation();

  const handleClick = () => {
    const params = new URLSearchParams();
    params.set('vendor', vendorName);
    params.set('vendorId', vendorId);

    if (paymentTerms) {
      params.set('paymentTerms', paymentTerms);
    }

    if (leadTimeDays !== null && leadTimeDays !== undefined) {
      params.set('leadTimeDays', String(leadTimeDays));
    }

    navigateToAdmin(`products/new?${params.toString()}`);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={className}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add product from {vendorName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
