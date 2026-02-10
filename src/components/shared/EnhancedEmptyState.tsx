import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { isValidElement } from "react";

export type EmptyStateType =
  | "no_tenants"
  | "no_orders"
  | "no_menus"
  | "no_products"
  | "no_customers"
  | "no_data"
  | "generic";

export interface EnhancedEmptyStateProps {
  /** Pre-configured type with default icon/title/description */
  type?: EmptyStateType;
  /** Custom title (overrides type default) */
  title?: string;
  /** Custom description (overrides type default) */
  description?: string;
  /** Custom icon - can be React node or LucideIcon */
  icon?: React.ReactNode | LucideIcon;
  /** Primary action button */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode | LucideIcon;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Additional className */
  className?: string;
  /** Design system variant for theming */
  designSystem?: "marketing" | "super-admin" | "tenant-admin" | "customer";
  /** Compact mode without card wrapper */
  compact?: boolean;
}

const emptyStateConfig: Record<
  EmptyStateType,
  {
    emoji: string;
    defaultTitle: string;
    defaultDescription: string;
  }
> = {
  no_tenants: {
    emoji: "🏢",
    defaultTitle: "No Tenants Yet",
    defaultDescription: "Create your first tenant to start managing your platform.",
  },
  no_orders: {
    emoji: "📦",
    defaultTitle: "No Orders Yet",
    defaultDescription: "Orders will appear here once customers start placing them.",
  },
  no_menus: {
    emoji: "📋",
    defaultTitle: "No Menus Available",
    defaultDescription: "Contact your supplier to get access to menus.",
  },
  no_products: {
    emoji: "📦",
    defaultTitle: "No Products",
    defaultDescription: "Add products to start creating menus and receiving orders.",
  },
  no_customers: {
    emoji: "👥",
    defaultTitle: "No Customers",
    defaultDescription: "Customers will appear here once they start ordering.",
  },
  no_data: {
    emoji: "📊",
    defaultTitle: "No Data Available",
    defaultDescription: "Data will appear here once it becomes available.",
  },
  generic: {
    emoji: "🔍",
    defaultTitle: "Nothing Here",
    defaultDescription: "There's nothing to display at the moment.",
  },
};

// Helper to check if something is a LucideIcon component (handles forwardRef)
// Helper to check if something is a LucideIcon component (handles forwardRef)
const isLucideIcon = (icon: unknown): icon is LucideIcon => {
  // If it's already a React Element (JSX), it's not a component definition
  if (isValidElement(icon)) return false;

  // Check if it's a function (class or function component)
  if (typeof icon === 'function') return true;

  // Check if it's a forwardRef component (object with $$typeof)
  if (typeof icon === 'object' && icon !== null && '$$typeof' in icon) {
    return true;
  }

  return false;
};

export function EnhancedEmptyState({
  type = "generic",
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
  designSystem = "tenant-admin",
  compact = false,
}: EnhancedEmptyStateProps) {
  const config = emptyStateConfig[type];
  const finalTitle = title || config.defaultTitle;
  const finalDescription = description || config.defaultDescription;

  // Handle different icon types
  const renderIcon = () => {
    if (!icon) {
      return (
        <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: "2s" }}>
          {config.emoji}
        </div>
      );
    }

    // If it's a LucideIcon component, render it
    if (isLucideIcon(icon)) {
      const IconComponent = icon;
      return <IconComponent className="h-12 w-12 text-muted-foreground" />;
    }

    // Otherwise it's already a ReactNode
    return icon;
  };

  const finalIcon = renderIcon();

  const primaryButtonClass = {
    marketing: "bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] hover:opacity-90 text-white",
    "super-admin": "bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white",
    "tenant-admin": "bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:opacity-90 text-white",
    customer: "bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white",
  }[designSystem];

  // Render action icon (handles LucideIcon or ReactNode)
  const renderActionIcon = (actionIcon: React.ReactNode | LucideIcon | undefined) => {
    if (!actionIcon) return null;
    if (isLucideIcon(actionIcon)) {
      const IconComponent = actionIcon;
      return <IconComponent className="h-4 w-4 mr-2" />;
    }
    return <span className="mr-2">{actionIcon}</span>;
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center",
      compact ? "py-8 px-4" : "space-y-6"
    )}>
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          compact ? "w-16 h-16 bg-muted/50 mb-4" : "w-24 h-24 bg-gradient-to-br from-opacity-10 to-opacity-5 mb-4"
        )}
        aria-hidden="true"
      >
        {finalIcon}
      </div>

      <div className="space-y-2 text-center">
        <h3 className={cn(compact ? "text-lg" : "text-2xl", "font-semibold text-foreground")} id={`empty-state-title-${type}`}>
          {finalTitle}
        </h3>
        <p className={cn("text-sm max-w-sm text-muted-foreground")} id={`empty-state-desc-${type}`}>
          {finalDescription}
        </p>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className={cn("flex gap-3", compact ? "mt-4" : "w-full")}>
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className={compact ? "" : "flex-1"}
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              className={cn(compact ? "" : "flex-1", !compact && primaryButtonClass)}
            >
              {renderActionIcon(primaryAction.icon)}
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  // Compact mode renders without card wrapper
  if (compact) {
    return (
      <div className={className} role="status" aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <Card
      className={cn("p-12 text-center max-w-md mx-auto", className)}
      role="status"
      aria-live="polite"
    >
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

