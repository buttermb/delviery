import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignupStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  steps: { label: string; key: string }[];
}

export function SignupStepIndicator({ currentStep, totalSteps, steps }: SignupStepIndicatorProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Progress Bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div key={step.key} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  "relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-primary border-primary text-primary-foreground scale-110",
                  isUpcoming && "bg-background border-muted-foreground text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center transition-colors",
                  isCurrent && "text-primary",
                  !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Number Display */}
      <div className="text-center text-sm text-muted-foreground">
        Step {currentStep + 1} of {totalSteps}
      </div>
    </div>
  );
}

