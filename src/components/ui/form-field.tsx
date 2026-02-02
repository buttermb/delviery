import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import HelpCircle from "lucide-react/dist/esm/icons/help-circle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FormFieldProps {
  /** Field label */
  label: string;
  /** HTML ID for the input (for label association) */
  htmlFor?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Optional description below label */
  description?: string;
  /** Error message to display */
  error?: string;
  /** Help text tooltip */
  helpText?: string;
  /** Whether to show "(optional)" for non-required fields */
  showOptional?: boolean;
  /** Additional class name */
  className?: string;
  /** Children (the input component) */
  children: React.ReactNode;
}

/**
 * Form field wrapper with label, required indicator, and error display
 * 
 * @example
 * ```tsx
 * <FormField
 *   label="Email"
 *   required
 *   error={errors.email}
 *   helpText="We'll never share your email"
 * >
 *   <Input
 *     type="email"
 *     value={email}
 *     onChange={e => setEmail(e.target.value)}
 *   />
 * </FormField>
 * ```
 */
export function FormField({
  label,
  htmlFor,
  required = false,
  description,
  error,
  helpText,
  showOptional = false,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Label row */}
      <div className="flex items-center gap-2">
        <Label
          htmlFor={htmlFor}
          className={cn(
            'text-sm font-medium',
            error && 'text-destructive'
          )}
        >
          {label}
          {required && (
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
          )}
          {!required && showOptional && (
            <span className="text-muted-foreground ml-1 font-normal">
              (optional)
            </span>
          )}
        </Label>

        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-sm">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Description */}
      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      {/* Input (children) */}
      <div className={cn(error && '[&>*]:border-destructive')}>
        {children}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Error summary component for displaying all form errors at once
 */
interface ErrorSummaryProps {
  errors: Record<string, string>;
  title?: string;
  className?: string;
  /** Field refs for scroll-to-field functionality */
  fieldRefs?: Record<string, HTMLElement | null>;
}

export function ErrorSummary({
  errors,
  title = 'Please fix the following errors:',
  className,
  fieldRefs,
}: ErrorSummaryProps) {
  const errorEntries = Object.entries(errors).filter(([, msg]) => msg);

  if (errorEntries.length === 0) return null;

  const scrollToField = (field: string) => {
    const element = fieldRefs?.[field] || document.getElementById(field);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus();
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-destructive/50 bg-destructive/10 p-4',
        className
      )}
      role="alert"
      aria-labelledby="error-summary-title"
    >
      <h3
        id="error-summary-title"
        className="text-sm font-medium text-destructive mb-2"
      >
        {title}
      </h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
        {errorEntries.map(([field, message]) => (
          <li key={field}>
            <button
              type="button"
              className="underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-1 rounded"
              onClick={() => scrollToField(field)}
            >
              {message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Required field legend component
 */
export function RequiredFieldLegend({ className }: { className?: string }) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      <span className="text-destructive" aria-hidden="true">
        *
      </span>{' '}
      indicates required field
    </p>
  );
}

export default FormField;
