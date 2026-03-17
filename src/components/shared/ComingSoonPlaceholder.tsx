import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComingSoonPlaceholderProps {
  /** Section title displayed as the heading */
  title: string;
  /** Optional description of what this feature will offer */
  description?: string;
  /** Optional Lucide icon displayed alongside the title */
  icon?: LucideIcon;
  /** Additional className for the outer Card */
  className?: string;
}

export function ComingSoonPlaceholder({
  title,
  description,
  icon: Icon,
  className,
}: ComingSoonPlaceholderProps) {
  return (
    <Card className={cn("p-6", className)}>
      <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
        {Icon && (
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted/50 p-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <h3 className="text-lg font-semibold tracking-tight">
          {title}
        </h3>

        {description && (
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}

        <Badge
          variant="secondary"
          className="mt-4 gap-1.5 font-medium text-muted-foreground"
        >
          <Clock className="h-3 w-3" />
          Coming Soon
        </Badge>
      </CardContent>
    </Card>
  );
}
