import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Package,
  Search,
  FileQuestion,
  Users,
  ShoppingCart,
  Inbox,
  FolderOpen,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Predefined illustrations for common empty states
 */
const illustrations = {
  "no-data": Package,
  "no-results": Search,
  "not-found": FileQuestion,
  "no-users": Users,
  "empty-cart": ShoppingCart,
  "empty-inbox": Inbox,
  "empty-folder": FolderOpen,
  "error": AlertCircle,
} as const;

type IllustrationType = keyof typeof illustrations;

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The main title displayed in the empty state
   */
  title: string;
  /**
   * Optional description text below the title
   */
  description?: string;
  /**
   * Predefined illustration type or custom icon component
   */
  illustration?: IllustrationType | LucideIcon;
  /**
   * Shorthand: pass a LucideIcon directly (alias for illustration)
   */
  icon?: LucideIcon;
  /**
   * Size of the illustration icon
   */
  iconSize?: "sm" | "md" | "lg" | "xl";
  /**
   * Primary action button configuration
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost";
    icon?: LucideIcon;
  };
  /**
   * Shorthand: action button label (used with onAction)
   */
  actionLabel?: string;
  /**
   * Shorthand: action button callback (used with actionLabel)
   */
  onAction?: () => void;
  /**
   * Secondary action button configuration
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /**
   * Visual variant of the empty state
   */
  variant?: "default" | "card" | "inline";
  /**
   * Whether to center the content (default: true)
   */
  centered?: boolean;
}

/**
 * EmptyState Component
 * 
 * A reusable component for displaying empty states with illustrations,
 * titles, descriptions, and action buttons.
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   title="No products found"
 *   description="Try adjusting your search or filter to find what you're looking for."
 *   illustration="no-results"
 *   action={{
 *     label: "Clear filters",
 *     onClick: () => clearFilters(),
 *   }}
 * />
 * ```
 */
function EmptyState({
  title,
  description,
  illustration,
  icon,
  iconSize = "lg",
  action,
  actionLabel,
  onAction,
  secondaryAction,
  variant = "default",
  centered = true,
  className,
  children,
  ...props
}: EmptyStateProps) {
  // Resolve icon: prefer explicit `icon` prop, then `illustration`, then default
  const resolvedIllustration = icon ?? illustration ?? "no-data";

  // Resolve the icon component
  const IconComponent: LucideIcon =
    typeof resolvedIllustration === "string"
      ? illustrations[resolvedIllustration]
      : resolvedIllustration;

  // Resolve action: prefer explicit `action` object, then shorthand props
  const resolvedAction = action ?? (actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined);

  // Icon size mapping
  const iconSizeMap = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24",
  };

  // Container size mapping for the icon background
  const containerSizeMap = {
    sm: "h-14 w-14",
    md: "h-20 w-20",
    lg: "h-24 w-24",
    xl: "h-32 w-32",
  };

  const content = (
    <>
      {/* Icon Container */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-muted",
          containerSizeMap[iconSize]
        )}
      >
        <IconComponent
          className={cn(iconSizeMap[iconSize], "text-muted-foreground")}
          strokeWidth={1.5}
        />
      </div>

      {/* Text Content */}
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {(resolvedAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {resolvedAction && (
            <Button
              variant={resolvedAction.variant ?? "default"}
              onClick={resolvedAction.onClick}
              className="gap-2"
            >
              {resolvedAction.icon && <resolvedAction.icon className="h-4 w-4" />}
              {resolvedAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="gap-2"
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {/* Custom Children */}
      {children}
    </>
  );

  // Variant styles
  const variantStyles = {
    default: "py-12 px-6",
    card: "py-12 px-6 border rounded-lg bg-card",
    inline: "py-6 px-4",
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        centered && "items-center text-center",
        variantStyles[variant],
        className
      )}
      role="status"
      aria-label={title}
      {...props}
    >
      {content}
    </div>
  );
}

/**
 * EmptyStateCompact
 * A smaller, inline version for use in cards or constrained spaces
 */
interface EmptyStateCompactProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
}

function EmptyStateCompact({
  title,
  description,
  icon: Icon = Package,
  action,
  className,
  ...props
}: EmptyStateCompactProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-8 px-4 text-center",
        className
      )}
      role="status"
      aria-label={title}
      {...props}
    >
      <Icon className="h-10 w-10 text-muted-foreground mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
      {action && (
        <Button
          variant="link"
          size="sm"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * ErrorState
 * A specialized empty state for error scenarios
 */
interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

function ErrorState({
  title = "Something went wrong",
  description = "We encountered an unexpected error. Please try again.",
  onRetry,
  retryLabel = "Try again",
  className,
  ...props
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      illustration="error"
      action={
        onRetry
          ? {
              label: retryLabel,
              onClick: onRetry,
            }
          : undefined
      }
      className={className}
      {...props}
    />
  );
}

export { EmptyState, EmptyStateCompact, ErrorState, illustrations };
export type { EmptyStateProps, EmptyStateCompactProps, ErrorStateProps, IllustrationType };


