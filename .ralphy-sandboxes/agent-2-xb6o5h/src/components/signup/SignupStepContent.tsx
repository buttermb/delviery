import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SignupStepContentProps {
  children: ReactNode;
  step: number;
  currentStep: number;
  className?: string;
}

export function SignupStepContent({ children, step, currentStep, className }: SignupStepContentProps) {
  const isActive = step === currentStep;
  const _isPast = step < currentStep;
  const _isFuture = step > currentStep;

  if (!isActive) {
    return null;
  }

  return (
    <div
      className={cn(
        "animate-fade-in",
        className
      )}
    >
      {children}
    </div>
  );
}

