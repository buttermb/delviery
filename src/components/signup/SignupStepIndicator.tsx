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
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 transition-all duration-500 ease-out rounded-full shadow-lg"
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
                  "relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                  isCompleted && "bg-gradient-to-br from-blue-600 to-purple-600 border-transparent text-white shadow-lg",
                  isCurrent && "bg-gradient-to-br from-blue-600 to-purple-600 border-transparent text-white scale-110 shadow-xl ring-4 ring-blue-500/20",
                  isUpcoming && "bg-card border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium text-center transition-colors",
                  isCurrent && "text-primary font-semibold",
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
      <div className="text-center text-sm font-medium">
        <span className="text-primary">Step {currentStep + 1}</span>
        <span className="text-muted-foreground"> of {totalSteps}</span>
      </div>
    </div>
  );
}

