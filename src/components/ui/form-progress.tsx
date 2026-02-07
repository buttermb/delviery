/**
 * Form Progress Component
 * Shows step-by-step progress for multi-section forms
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormProgressStep {
  name: string;
  completed?: boolean;
}

interface FormProgressProps {
  steps: FormProgressStep[];
  currentStep: number;
  className?: string;
  showEstimatedTime?: boolean;
  estimatedMinutesRemaining?: number;
}

export function FormProgress({
  steps,
  currentStep,
  className,
  showEstimatedTime = false,
  estimatedMinutesRemaining,
}: FormProgressProps) {
  const completedSteps = steps.filter((s) => s.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = step.completed || index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.name}
              className={cn(
                'flex items-center gap-2 text-xs',
                isCompleted && 'text-primary',
                isCurrent && !isCompleted && 'text-foreground font-medium',
                !isCompleted && !isCurrent && 'text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && !isCompleted && 'bg-primary/20 text-primary border-2 border-primary',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
              </div>
              <span className="hidden sm:inline">{step.name}</span>
            </div>
          );
        })}
      </div>

      {/* Estimated Time */}
      {showEstimatedTime && estimatedMinutesRemaining !== undefined && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>⏱️</span>
          <span>
            About {estimatedMinutesRemaining} minute{estimatedMinutesRemaining !== 1 ? 's' : ''} remaining
          </span>
        </div>
      )}
    </div>
  );
}

interface FormStepHeaderProps {
  title: string;
  description?: string;
  stepNumber: number;
  totalSteps: number;
}

export function FormStepHeader({ title, description, stepNumber, totalSteps }: FormStepHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        Step {stepNumber} of {totalSteps}
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}
