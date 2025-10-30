import { cn } from "@/lib/utils";

interface BetterSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "card";
  animation?: "pulse" | "wave" | "none";
}

export function BetterSkeleton({ 
  className, 
  variant = "rectangular",
  animation = "pulse",
  ...props 
}: BetterSkeletonProps) {
  const variantClasses = {
    text: "h-4 w-full rounded",
    circular: "rounded-full aspect-square",
    rectangular: "rounded-md",
    card: "rounded-lg h-48"
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-[shimmer_2s_infinite] bg-gradient-to-r from-muted via-muted-foreground/10 to-muted bg-[length:200%_100%]",
    none: ""
  };

  return (
    <div
      className={cn(
        "bg-muted",
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <BetterSkeleton variant="rectangular" className="h-40" />
      <div className="space-y-2">
        <BetterSkeleton variant="text" className="w-3/4" />
        <BetterSkeleton variant="text" className="w-1/2" />
      </div>
      <div className="flex gap-2">
        <BetterSkeleton variant="rectangular" className="h-9 w-20" />
        <BetterSkeleton variant="rectangular" className="h-9 w-20" />
      </div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <BetterSkeleton variant="circular" className="h-10 w-10" />
          <div className="flex-1 space-y-2">
            <BetterSkeleton variant="text" className="w-1/3" />
            <BetterSkeleton variant="text" className="w-1/2" />
          </div>
          <BetterSkeleton variant="rectangular" className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
