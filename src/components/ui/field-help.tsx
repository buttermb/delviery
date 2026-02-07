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
    tooltip: 'Maximum amount of unpaid credit allowed for this customer.',
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
};
