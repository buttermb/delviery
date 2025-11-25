/**
 * AttentionBadge - Sidebar badge showing attention queue counts
 * 
 * Shows critical/important counts with dropdown preview.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AlertCircle, Bell, ChevronRight, Zap } from 'lucide-react';
import { useAttentionQueue } from '@/hooks/useAttentionQueue';
import { cn } from '@/lib/utils';

interface AttentionBadgeProps {
  className?: string;
  showPopover?: boolean;
}

export function AttentionBadge({ className, showPopover = true }: AttentionBadgeProps) {
  const { counts, getTopItems, hasUrgent, hasImportant, isLoading } = useAttentionQueue();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (isLoading || counts.total === 0) {
    return null;
  }

  const topItems = getTopItems(5);

  const badge = (
    <Badge
      variant={hasUrgent ? 'destructive' : hasImportant ? 'default' : 'secondary'}
      className={cn(
        'cursor-pointer transition-all hover:scale-105',
        hasUrgent && 'animate-pulse',
        className
      )}
    >
      {hasUrgent ? (
        <AlertCircle className="h-3 w-3 mr-1" />
      ) : (
        <Bell className="h-3 w-3 mr-1" />
      )}
      {counts.critical > 0 && (
        <span className="font-bold">{counts.critical}</span>
      )}
      {counts.critical > 0 && counts.important > 0 && (
        <span className="mx-0.5">·</span>
      )}
      {counts.important > 0 && (
        <span>{counts.important}</span>
      )}
    </Badge>
  );

  if (!showPopover) {
    return badge;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {badge}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Needs Attention
            </h4>
            <div className="flex gap-1">
              {counts.critical > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {counts.critical} critical
                </Badge>
              )}
              {counts.important > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {counts.important} important
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {topItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors',
                item.priority === 'critical' && 'bg-red-50 dark:bg-red-950/20',
                item.priority === 'important' && 'bg-yellow-50 dark:bg-yellow-950/20',
              )}
              onClick={() => {
                setOpen(false);
                navigate(item.actionRoute);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {item.priority === 'critical' ? '🔴' : item.priority === 'important' ? '🟡' : '🟢'}
                  </span>
                  <div>
                    <div className="font-medium text-sm">{item.title}</div>
                    {item.valueDisplay && (
                      <div className="text-xs text-muted-foreground">{item.valueDisplay}</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate('/admin/hotbox');
            }}
          >
            View All in Hotbox
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Simple count badge without popover (for compact spaces)
 */
export function AttentionCount({ className }: { className?: string }) {
  const { counts, hasUrgent, isLoading } = useAttentionQueue();

  if (isLoading || counts.total === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full',
        hasUrgent 
          ? 'bg-red-500 text-white animate-pulse' 
          : 'bg-yellow-500 text-white',
        className
      )}
    >
      {counts.critical + counts.important}
    </span>
  );
}

export default AttentionBadge;

