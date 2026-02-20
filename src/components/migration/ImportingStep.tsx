import { Progress } from '@/components/ui/progress';
import { Loader2, Package, CheckCircle2 } from 'lucide-react';
import type { ImportProgress } from '@/types/migration';

interface ImportingStepProps {
  progress: ImportProgress | null;
  isLoading: boolean;
}

export function ImportingStep({ progress, isLoading }: ImportingStepProps) {
  const percentage = progress 
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Animated import indicator */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
        )}
        <div className="relative p-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
          {isLoading ? (
            <Loader2 className="h-12 w-12 text-emerald-500 animate-spin" />
          ) : (
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Status */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          {isLoading ? 'Importing Products...' : 'Import Complete'}
        </h3>
        {progress && (
          <p className="text-sm text-muted-foreground">
            Processing {progress.current} of {progress.total}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md space-y-2">
        <Progress value={percentage} className="h-3" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{progress?.current || 0} imported</span>
          <span>{progress?.total || 0} total</span>
        </div>
      </div>

      {/* Animated product cards */}
      {isLoading && (
        <div className="flex items-center gap-2 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg"
              style={{ 
                animationDelay: `${i * 0.2}s`,
                opacity: 1 - (i * 0.2),
              }}
            >
              <Package className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Product {(progress?.current || 0) + i + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




