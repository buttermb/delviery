import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

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
  const { theme } = useTheme();
  const config = emptyStateConfig[type];
  const finalTitle = title || config.defaultTitle;
  const finalDescription = description || config.defaultDescription;
  const finalIcon = icon || (
    <div className="text-6xl mb-4 animate-bounce" style={{ animationDuration: "2s" }}>
      {config.emoji}
    </div>
  );

  // Design system-specific styling using semantic tokens
  const bgColor = {
    marketing: "bg-card",
    "super-admin": "bg-card/80 backdrop-blur-xl",
    "tenant-admin": "bg-card",
    customer: "bg-card",
  }[designSystem];

  const borderColor = "border-border";
  const textColor = "text-card-foreground";
  const textLightColor = "text-muted-foreground";

  const primaryButtonClass = {
    marketing: "bg-gradient-to-r from-[hsl(var(--marketing-primary))] to-[hsl(var(--marketing-secondary))] hover:opacity-90 text-white",
    "super-admin": "bg-gradient-to-r from-[hsl(var(--super-admin-primary))] to-[hsl(var(--super-admin-secondary))] hover:opacity-90 text-white",
    "tenant-admin": "bg-gradient-to-r from-[hsl(var(--tenant-primary))] to-[hsl(var(--tenant-secondary))] hover:opacity-90 text-white",
    customer: "bg-gradient-to-r from-[hsl(var(--customer-primary))] to-[hsl(var(--customer-secondary))] hover:opacity-90 text-white",
  }[designSystem];

  const secondaryButtonClass = "border-border text-foreground hover:bg-muted";

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
                className="flex-1"
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

