/**
 * Product Card with Optimistic State Indicator
 * Shows visual feedback when product is being synced
 */

import { ReactNode } from 'react';
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import { cn } from '@/lib/utils';

interface OptimisticProductCardProps {
  children: ReactNode;
  isOptimistic?: boolean;
  className?: string;
}

export function OptimisticProductCard({
  children,
  isOptimistic = false,
  className,
}: OptimisticProductCardProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Optimistic State Badge */}
      {isOptimistic && (
        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-info text-info-foreground rounded-full text-xs font-medium shadow-lg animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        </div>
      )}
      
      {/* Subtle overlay for optimistic state */}
      {isOptimistic && (
        <div className="absolute inset-0 bg-info/5 pointer-events-none rounded-lg z-0" />
      )}
      
      {children}
    </div>
  );
}
