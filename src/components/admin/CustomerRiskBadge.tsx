/**
 * Customer Risk Badge Component
 * Displays risk score with color-coded indicator
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CustomerRiskBadgeProps {
  score: number | null | undefined;
  showLabel?: boolean;
  className?: string;
}

export function CustomerRiskBadge({ 
  score, 
  showLabel = true,
  className 
}: CustomerRiskBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        N/A
      </Badge>
    );
  }

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { label: 'Excellent', variant: 'default' as const, color: 'bg-success' };
    if (score >= 60) return { label: 'Good', variant: 'default' as const, color: 'bg-info' };
    if (score >= 40) return { label: 'Fair', variant: 'secondary' as const, color: 'bg-warning' };
    if (score >= 20) return { label: 'Poor', variant: 'secondary' as const, color: 'bg-warning' };
    return { label: 'High Risk', variant: 'destructive' as const, color: 'bg-destructive' };
  };

  const risk = getRiskLevel(score);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", risk.color)} />
      {showLabel && (
        <Badge variant={risk.variant} className="text-xs">
          {risk.label} ({score}/100)
        </Badge>
      )}
      {!showLabel && (
        <span className="text-sm text-muted-foreground">
          {risk.label}
        </span>
      )}
    </div>
  );
}

