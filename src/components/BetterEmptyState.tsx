import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BetterEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function BetterEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: BetterEmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      {Icon && (
        <div className="rounded-full bg-muted p-6 mb-4">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      
      {description && (
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex gap-3">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {action.icon && <action.icon className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
