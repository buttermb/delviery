import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  score: number;
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ score, showLabel = true, className }: ConfidenceBarProps) {
  const percentage = Math.round(score * 100);
  
  const getColor = () => {
    if (percentage >= 80) return 'bg-emerald-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div 
          className={cn('h-full transition-all rounded-full', getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={cn(
          'text-xs whitespace-nowrap',
          percentage >= 80 ? 'text-emerald-500' :
          percentage >= 60 ? 'text-yellow-500' :
          percentage >= 40 ? 'text-orange-500' :
          'text-red-500'
        )}>
          {percentage}%
        </span>
      )}
    </div>
  );
}




