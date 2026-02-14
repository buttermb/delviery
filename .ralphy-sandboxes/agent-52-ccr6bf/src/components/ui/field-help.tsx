import React from 'react';
import { Info, HelpCircle, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FieldHelpProps {
  /** The help text to display */
  tooltip: string;
  /** Optional example value */
  example?: string;
  /** Optional link to documentation */
  learnMoreUrl?: string;
  /** Icon variant */
  variant?: 'info' | 'help' | 'warning';
  /** Size of the icon */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Side of the tooltip */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const iconVariants = {
  info: Info,
  help: HelpCircle,
  warning: AlertCircle,
};

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

const variantClasses = {
  info: 'text-muted-foreground hover:text-foreground',
  help: 'text-muted-foreground hover:text-primary',
  warning: 'text-amber-500 hover:text-amber-600',
};

export function FieldHelp({
  tooltip,
  example,
  learnMoreUrl,
  variant = 'info',
  size = 'sm',
  className,
  side = 'top',
}: FieldHelpProps) {
  const Icon = iconVariants[variant];

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center transition-colors cursor-help',
              variantClasses[variant],
              className
            )}
            tabIndex={-1}
          >
            <Icon className={sizeClasses[size]} />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          className="max-w-xs p-3 bg-popover text-popover-foreground"
        >
          <p className="text-sm">{tooltip}</p>
          {example && (
            <p className="mt-1 text-xs text-muted-foreground">
              Example: <code className="bg-muted px-1 rounded">{example}</code>
            </p>
          )}
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-xs text-primary hover:underline"
            >
              Learn more →
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface LabelWithHelpProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  /** Label text */
  children: React.ReactNode;
  /** Help tooltip text */
  helpText?: string;
  /** Optional example */
  example?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Help variant */
  helpVariant?: 'info' | 'help' | 'warning';
}

export function LabelWithHelp({
  children,
  helpText,
  example,
  required,
  helpVariant = 'info',
  className,
  ...props
}: LabelWithHelpProps) {
  return (
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1.5',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-destructive">*</span>}
      {helpText && (
        <FieldHelp tooltip={helpText} example={example} variant={helpVariant} />
      )}
    </label>
  );
}

/**
 * Predefined help texts for common fields
 */
export const fieldHelpTexts = {
  lowStockAlert: {
    tooltip: "We'll alert you when stock falls below this number. Leave empty to disable alerts.",
    example: '10',
  },
  reorderPoint: {
    tooltip: 'The stock level at which you should reorder. Based on typical usage and lead time.',
    example: '25',
  },
  sku: {
    tooltip: 'A unique identifier for this product. Used for inventory tracking and barcodes.',
    example: 'PROD-001-BLK',
  },
  markup: {
    tooltip: 'The percentage added to cost to determine retail price.',
    example: '30%',
  },
  paymentTerms: {
    tooltip: 'Number of days the customer has to pay after invoice date.',
    example: 'Net 30',
  },
  creditLimit: {
    tooltip: 'Maximum amount of unpaid credit allowed for this customer. Orders exceeding available credit will require manager override.',
    example: '$5,000',
  },
  taxRate: {
    tooltip: 'Sales tax percentage applied to orders. Set to 0 for tax-exempt.',
    example: '8.875%',
  },
  batchNumber: {
    tooltip: 'Unique identifier for this production batch. Used for traceability and recalls.',
    example: 'BATCH-2024-001',
  },
  expirationDate: {
    tooltip: 'Date after which this product should not be sold.',
  },
  minimumOrder: {
    tooltip: 'Minimum quantity required for wholesale orders.',
    example: '10 units',
  },
  tenantSlug: {
    tooltip: 'The URL-friendly identifier for your store. Customers access your storefront at /shop/your-slug. Use lowercase letters, numbers, and hyphens only.',
    example: 'green-leaf-dispensary',
  },
  dataIsolation: {
    tooltip: 'Row-Level Security (RLS) ensures each tenant can only access their own data. All queries are automatically filtered by your tenant ID, so your products, orders, and customers are invisible to other tenants.',
  },
  deliveryZonePolygon: {
    tooltip: 'Delivery zones use polygon matching to determine if a customer address falls within your delivery area. Draw a shape on the map, and orders with addresses inside the polygon will be matched to this zone automatically.',
  },
  deliveryZonePriority: {
    tooltip: 'When delivery zones overlap, the zone with the highest priority number is matched first. Use this to create specific sub-zones within larger areas.',
    example: '10',
  },
  deliveryZoneZipCodes: {
    tooltip: 'Optional ZIP code fallback. If an address cannot be matched by polygon, it will be matched by ZIP code instead. Use alongside polygon for maximum coverage.',
    example: '10001, 10002',
  },
  burnType: {
    tooltip: 'Soft Burn disables the menu link but preserves data — it can be regenerated later. Hard Burn permanently destroys the menu and all access tokens. Choose carefully.',
  },
  burnTriggers: {
    tooltip: 'Automated conditions that will burn a menu when exceeded. Each trigger has a threshold — once reached, the menu is burned according to the burn type selected above.',
  },
  autoBurnSystem: {
    tooltip: 'The auto-burn system monitors menu access in real time. When suspicious activity is detected (too many views, failed access attempts, screenshots), the menu is automatically burned to protect your pricing and product data.',
  },
  creditSystem: {
    tooltip: 'Credits represent unpaid balances owed by wholesale clients. When a client places an order on credit terms, the order total is added to their outstanding balance. Credits are consumed when payments are recorded against invoices.',
  },
};
