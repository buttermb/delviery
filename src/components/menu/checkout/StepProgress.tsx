import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CheckoutStep } from './types';
import { STEPS } from './types';

export function StepProgress({
  steps,
  currentStep,
  onStepClick
}: {
  steps: typeof STEPS;
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
}) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="space-y-3 px-4 py-3">
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          const isClickable = isComplete && onStepClick;

          return (
            <button
              key={step.id}
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                isClickable && "cursor-pointer hover:opacity-80"
              )}
            >
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300",
                isActive && "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110",
                isComplete && "bg-emerald-500 text-white",
                !isActive && !isComplete && "bg-muted text-muted-foreground"
              )}>
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium hidden sm:block",
                isActive && "text-primary",
                isComplete && "text-emerald-600",
                !isActive && !isComplete && "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
