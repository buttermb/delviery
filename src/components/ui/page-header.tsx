import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Breadcrumb item configuration
 */
interface BreadcrumbItemConfig {
  label: string;
  href?: string;
}

/**
 * Action button configuration
 */
interface ActionConfig {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  disabled?: boolean;
  loading?: boolean;
}

/**
 * PageHeader Props
 */
interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Main page title
   */
  title: string;
  /**
   * Optional description text below the title
   */
  description?: string;
  /**
   * Breadcrumb navigation items
   */
  breadcrumbs?: BreadcrumbItemConfig[];
  /**
   * Primary action buttons
   */
  actions?: ActionConfig[];
  /**
   * Back button configuration
   */
  backButton?: {
    label?: string;
    href?: string;
    onClick?: () => void;
  };
  /**
   * Badge or status indicator next to title
   */
  badge?: React.ReactNode;
  /**
   * Icon displayed next to the title
   */
  icon?: LucideIcon;
  /**
   * Additional content below the main header
   */
  children?: React.ReactNode;
  /**
   * Visual variant
   */
  variant?: "default" | "compact" | "hero";
  /**
   * Whether the header is sticky
   */
  sticky?: boolean;
}

/**
 * PageHeader Component
 * 
 * A reusable page header component with title, description,
 * breadcrumbs, and action buttons.
 * 
 * @example
 * ```tsx
 * <PageHeader
 *   title="Products"
 *   description="Manage your product catalog"
 *   breadcrumbs={[
 *     { label: "Dashboard", href: "/" },
 *     { label: "Products" },
 *   ]}
 *   actions={[
 *     { label: "Export", variant: "outline", onClick: handleExport },
 *     { label: "Add Product", icon: Plus, onClick: handleAdd },
 *   ]}
 * />
 * ```
 */
function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  backButton,
  badge,
  icon: Icon,
  children,
  variant = "default",
  sticky = false,
  className,
  ...props
}: PageHeaderProps) {
  const headerContent = (
    <>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link to={item.href}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Back Button */}
      {backButton && (
        <div className="mb-4">
          {backButton.href ? (
            <Button variant="ghost" size="sm" asChild className="gap-2 -ml-2">
              <Link to={backButton.href}>
                <ChevronLeft className="h-4 w-4" />
                {backButton.label || "Back"}
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={backButton.onClick}
              className="gap-2 -ml-2"
            >
              <ChevronLeft className="h-4 w-4" />
              {backButton.label || "Back"}
            </Button>
          )}
        </div>
      )}

      {/* Main Header Row */}
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
          variant === "compact" && "gap-2"
        )}
      >
        {/* Title Section */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <h1
                className={cn(
                  "font-bold tracking-tight text-foreground",
                  variant === "hero" && "text-3xl sm:text-4xl",
                  variant === "default" && "text-2xl sm:text-3xl",
                  variant === "compact" && "text-xl sm:text-2xl"
                )}
              >
                {title}
              </h1>
              {badge}
            </div>
          </div>
          {description && (
            <p
              className={cn(
                "text-muted-foreground",
                variant === "hero" && "text-base sm:text-lg",
                variant === "default" && "text-sm sm:text-base",
                variant === "compact" && "text-sm"
              )}
            >
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {actions.map((action, index) => (
              <ActionButton key={index} {...action} />
            ))}
          </div>
        )}
      </div>

      {/* Additional Content */}
      {children && <div className="mt-6">{children}</div>}
    </>
  );

  return (
    <header
      className={cn(
        "pb-6",
        variant === "hero" && "pb-8",
        variant === "compact" && "pb-4",
        sticky &&
          "sticky top-0 z-sticky bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
        sticky && "pt-4 -mt-4",
        className
      )}
      {...props}
    >
      {headerContent}
    </header>
  );
}

/**
 * ActionButton Component
 */
function ActionButton({
  label,
  onClick,
  href,
  icon: Icon,
  variant = "default",
  disabled = false,
  loading = false,
}: ActionConfig) {
  const buttonContent = (
    <>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && <Icon className="h-4 w-4" />
      )}
      {label}
    </>
  );

  if (href && !disabled) {
    return (
      <Button variant={variant} asChild className="gap-2">
        <Link to={href}>{buttonContent}</Link>
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled || loading}
      className="gap-2"
    >
      {buttonContent}
    </Button>
  );
}

/**
 * PageHeaderSkeleton Component
 * Loading state for PageHeader
 */
function PageHeaderSkeleton({
  hasDescription = true,
  hasBreadcrumbs = true,
  hasActions = true,
  className,
}: {
  hasDescription?: boolean;
  hasBreadcrumbs?: boolean;
  hasActions?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("pb-6", className)}>
      {hasBreadcrumbs && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          {hasDescription && (
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          )}
        </div>
        {hasActions && (
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 bg-muted rounded animate-pulse" />
            <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * SubHeader Component
 * A secondary header for sections within a page
 */
interface SubHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: ActionConfig[];
}

function SubHeader({
  title,
  description,
  actions,
  className,
  ...props
}: SubHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4",
        className
      )}
      {...props}
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action, index) => (
            <ActionButton key={index} {...action} />
          ))}
        </div>
      )}
    </div>
  );
}

export { PageHeader, PageHeaderSkeleton, SubHeader };
export type { PageHeaderProps, SubHeaderProps, BreadcrumbItemConfig, ActionConfig };


