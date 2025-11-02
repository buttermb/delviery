import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateType = 
  | "no_tenants" 
  | "no_orders" 
  | "no_menus" 
  | "no_products" 
  | "no_customers"
  | "no_data"
  | "generic";

interface EnhancedEmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  designSystem?: "marketing" | "super-admin" | "tenant-admin" | "customer";
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

export function EnhancedEmptyState({
  type = "generic",
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
  designSystem = "tenant-admin",
}: EnhancedEmptyStateProps) {
  const config = emptyStateConfig[type];
  const finalTitle = title || config.defaultTitle;
  const finalDescription = description || config.defaultDescription;
  const finalIcon = icon || (
    <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: "2s" }}>
      {config.emoji}
    </div>
  );

  // Design system-specific styling
  const bgColor = {
    marketing: "bg-white",
    "super-admin": "bg-[hsl(var(--super-admin-surface))]/80 backdrop-blur-xl border-white/10",
    "tenant-admin": "bg-white",
    customer: "bg-white",
  }[designSystem];

  const borderColor = {
    marketing: "border-[hsl(var(--marketing-border))]",
    "super-admin": "border-white/10",
    "tenant-admin": "border-[hsl(var(--tenant-border))]",
    customer: "border-[hsl(var(--customer-border))]",
  }[designSystem];

  const textColor = {
    marketing: "text-[hsl(var(--marketing-text))]",
    "super-admin": "text-[hsl(var(--super-admin-text))]",
    "tenant-admin": "text-[hsl(var(--tenant-text))]",
    customer: "text-[hsl(var(--customer-text))]",
  }[designSystem];

  const textLightColor = {
    marketing: "text-[hsl(var(--marketing-text-light))]",
    "super-admin": "text-[hsl(var(--super-admin-text-light))]",
    "tenant-admin": "text-[hsl(var(--tenant-text-light))]",
    customer: "text-[hsl(var(--customer-text-light))]",
  }[designSystem];

  const primaryButtonClass = {
    marketing: "bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] hover:opacity-90 text-white",
    "super-admin": "bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white",
    "tenant-admin": "bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:opacity-90 text-white",
    customer: "bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white",
  }[designSystem];

  const secondaryButtonClass = {
    marketing: "border-[hsl(var(--marketing-border))] text-[hsl(var(--marketing-text))] hover:bg-[hsl(var(--marketing-bg-subtle))]",
    "super-admin": "border-white/10 text-[hsl(var(--super-admin-text))] hover:bg-white/10",
    "tenant-admin": "border-[hsl(var(--tenant-border))] text-[hsl(var(--tenant-text))] hover:bg-[hsl(var(--tenant-surface))]",
    customer: "border-[hsl(var(--customer-border))] text-[hsl(var(--customer-text))] hover:bg-[hsl(var(--customer-surface))]",
  }[designSystem];

  return (
    <Card 
      className={cn("p-12 text-center max-w-md mx-auto", bgColor, borderColor, className)}
      role="status"
      aria-live="polite"
    >
      <CardContent className="flex flex-col items-center justify-center space-y-6">
        <div 
          className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-opacity-10 to-opacity-5 mb-4"
          aria-hidden="true"
        >
          {finalIcon}
        </div>

        <div className="space-y-2">
          <h3 className={cn("text-2xl font-semibold", textColor)} id={`empty-state-title-${type}`}>
            {finalTitle}
          </h3>
          <p className={cn("text-sm max-w-sm", textLightColor)} id={`empty-state-desc-${type}`}>
            {finalDescription}
          </p>
        </div>

        {(primaryAction || secondaryAction) && (
          <div className="flex gap-3 w-full">
            {secondaryAction && (
              <Button
                variant="outline"
                onClick={secondaryAction.onClick}
                className={cn("flex-1", secondaryButtonClass)}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                onClick={primaryAction.onClick}
                className={cn("flex-1", primaryButtonClass)}
              >
                {primaryAction.icon && <span className="mr-2">{primaryAction.icon}</span>}
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

