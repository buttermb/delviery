import { cn } from "@/lib/utils";

/**
 * Base Skeleton Component
 * Displays a loading placeholder with pulse animation
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      role="status"
      aria-label="Loading..."
      {...props}
    />
  );
}

/**
 * Skeleton Text
 * Displays one or more lines of skeleton text
 */
interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  lastLineWidth?: "full" | "3/4" | "1/2" | "1/4";
}

function SkeletonText({
  lines = 3,
  lastLineWidth = "3/4",
  className,
  ...props
}: SkeletonTextProps) {
  const widthMap = {
    "full": "w-full",
    "3/4": "w-3/4",
    "1/2": "w-1/2",
    "1/4": "w-1/4",
  };

  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading text..." {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? widthMap[lastLineWidth] : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton Avatar
 * Displays a circular avatar placeholder
 */
interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: SkeletonAvatarProps) {
  const sizeMap = {
    xs: "h-6 w-6",
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <Skeleton
      className={cn("rounded-full", sizeMap[size], className)}
      aria-label="Loading avatar..."
      {...props}
    />
  );
}

/**
 * Skeleton Card
 * Displays a card-shaped placeholder with optional header, content, and footer
 */
interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hasImage?: boolean;
  hasHeader?: boolean;
  hasFooter?: boolean;
  lines?: number;
}

function SkeletonCard({
  hasImage = false,
  hasHeader = true,
  hasFooter = false,
  lines = 3,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      className={cn("rounded-lg border bg-card p-4 space-y-4", className)}
      role="status"
      aria-label="Loading card..."
      {...props}
    >
      {hasImage && (
        <Skeleton className="h-40 w-full rounded-md" />
      )}
      {hasHeader && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      <SkeletonText lines={lines} />
      {hasFooter && (
        <div className="flex justify-between pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </div>
  );
}

/**
 * Skeleton Table Row
 * Displays a table row placeholder
 */
interface SkeletonTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  columns?: number;
  hasAvatar?: boolean;
  hasActions?: boolean;
}

function SkeletonTableRow({
  columns = 4,
  hasAvatar = false,
  hasActions = false,
  className,
  ...props
}: SkeletonTableRowProps) {
  const actualColumns = columns - (hasAvatar ? 1 : 0) - (hasActions ? 1 : 0);

  return (
    <tr className={cn("border-b", className)} role="status" aria-label="Loading row..." {...props}>
      {hasAvatar && (
        <td className="p-4">
          <SkeletonAvatar size="sm" />
        </td>
      )}
      {Array.from({ length: actualColumns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className={cn("h-4", i === 0 ? "w-3/4" : "w-full")} />
        </td>
      ))}
      {hasActions && (
        <td className="p-4">
          <div className="flex gap-2 justify-end">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </td>
      )}
    </tr>
  );
}

/**
 * Skeleton Table
 * Displays a complete table placeholder
 */
interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  columns?: number;
  hasAvatar?: boolean;
  hasActions?: boolean;
  hasHeader?: boolean;
}

function SkeletonTable({
  rows = 5,
  columns = 4,
  hasAvatar = false,
  hasActions = false,
  hasHeader = true,
  className,
  ...props
}: SkeletonTableProps) {
  return (
    <div className={cn("rounded-md border", className)} role="status" aria-label="Loading table..." {...props}>
      <table className="w-full">
        {hasHeader && (
          <thead className="border-b bg-muted/50">
            <tr>
              {hasAvatar && <th className="p-4 text-left"><Skeleton className="h-4 w-8" /></th>}
              {Array.from({ length: columns - (hasAvatar ? 1 : 0) - (hasActions ? 1 : 0) }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
              {hasActions && <th className="p-4 text-right"><Skeleton className="h-4 w-16" /></th>}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow
              key={i}
              columns={columns}
              hasAvatar={hasAvatar}
              hasActions={hasActions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Skeleton List Item
 * Displays a list item placeholder with optional avatar
 */
interface SkeletonListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  hasAvatar?: boolean;
  hasSecondaryText?: boolean;
  hasAction?: boolean;
}

function SkeletonListItem({
  hasAvatar = true,
  hasSecondaryText = true,
  hasAction = false,
  className,
  ...props
}: SkeletonListItemProps) {
  return (
    <div
      className={cn("flex items-center gap-4 p-4", className)}
      role="status"
      aria-label="Loading list item..."
      {...props}
    >
      {hasAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        {hasSecondaryText && <Skeleton className="h-3 w-1/2" />}
      </div>
      {hasAction && <Skeleton className="h-8 w-20 rounded" />}
    </div>
  );
}

/**
 * Skeleton Button
 * Displays a button-shaped placeholder
 */
interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
  width?: "auto" | "full";
}

function SkeletonButton({
  size = "default",
  width = "auto",
  className,
  ...props
}: SkeletonButtonProps) {
  const sizeMap = {
    sm: "h-9 w-20",
    default: "h-10 w-24",
    lg: "h-11 w-32",
  };

  return (
    <Skeleton
      className={cn(
        "rounded-md",
        sizeMap[size],
        width === "full" && "w-full",
        className
      )}
      aria-label="Loading button..."
      {...props}
    />
  );
}

/**
 * Skeleton Input
 * Displays an input field placeholder
 */
interface SkeletonInputProps extends React.HTMLAttributes<HTMLDivElement> {
  hasLabel?: boolean;
}

function SkeletonInput({
  hasLabel = true,
  className,
  ...props
}: SkeletonInputProps) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading input..." {...props}>
      {hasLabel && <Skeleton className="h-4 w-24" />}
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonListItem,
  SkeletonButton,
  SkeletonInput,
};
