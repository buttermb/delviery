/**
 * Empty State Component
 * Consistent empty state displays
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('p-12 text-center', className)}>
      <div className="flex flex-col items-center justify-center">
        <div className="mb-4 text-muted-foreground opacity-50">{icon}</div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick}>{action.label}</Button>
        )}
      </div>
    </Card>
  );
}

