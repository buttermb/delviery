import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Circle, ChevronRight, ChevronLeft } from "lucide-react";

/**
 * Step status type
 */
type StepStatus = "pending" | "current" | "complete" | "error";

/**
 * Step configuration
 */
interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  optional?: boolean;
}

/**
 * Stepper Context
 */
interface StepperContextValue {
  steps: Step[];
  currentStep: number;
  orientation: "horizontal" | "vertical";
  setCurrentStep: (step: number) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  completedSteps: Set<number>;
  markStepComplete: (stepIndex: number) => void;
  markStepIncomplete: (stepIndex: number) => void;
}

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper components must be used within a Stepper");
  }
  return context;
}

/**
 * Stepper Props
 */
interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Array of step configurations
   */
  steps: Step[];
  /**
   * Current active step index (0-based)
   */
  currentStep?: number;
  /**
   * Callback when step changes
   */
  onStepChange?: (step: number) => void;
  /**
   * Orientation of the stepper
   */
  orientation?: "horizontal" | "vertical";
  /**
   * Whether clicking on steps navigates to them
   */
  clickable?: boolean;
  /**
   * Visual variant
   */
  variant?: "default" | "circles" | "simple";
}

/**
 * Stepper Component
 * 
 * A multi-step wizard component for guiding users through a process.
 * 
 * @example
 * ```tsx
 * const [step, setStep] = useState(0);
 * const steps = [
 *   { id: "info", title: "Basic Info" },
 *   { id: "details", title: "Details" },
 *   { id: "review", title: "Review" },
 * ];
 * 
 * <Stepper steps={steps} currentStep={step} onStepChange={setStep}>
 *   <StepperContent step={0}>
 *     <p>Step 1 content</p>
 *   </StepperContent>
 *   <StepperContent step={1}>
 *     <p>Step 2 content</p>
 *   </StepperContent>
 *   <StepperContent step={2}>
 *     <p>Step 3 content</p>
 *   </StepperContent>
 *   <StepperNavigation />
 * </Stepper>
 * ```
 */
function Stepper({
  steps,
  currentStep: controlledStep,
  onStepChange,
  orientation = "horizontal",
  clickable = true,
  variant = "default",
  className,
  children,
  ...props
}: StepperProps) {
  const [internalStep, setInternalStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());

  const currentStep = controlledStep ?? internalStep;

  const setCurrentStep = React.useCallback(
    (step: number) => {
      if (step >= 0 && step < steps.length) {
        setInternalStep(step);
        onStepChange?.(step);
      }
    },
    [steps.length, onStepChange]
  );

  const goToNextStep = React.useCallback(() => {
    setCurrentStep(currentStep + 1);
  }, [currentStep, setCurrentStep]);

  const goToPreviousStep = React.useCallback(() => {
    setCurrentStep(currentStep - 1);
  }, [currentStep, setCurrentStep]);

  const markStepComplete = React.useCallback((stepIndex: number) => {
    setCompletedSteps((prev) => new Set(prev).add(stepIndex));
  }, []);

  const markStepIncomplete = React.useCallback((stepIndex: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(stepIndex);
      return next;
    });
  }, []);

  const contextValue: StepperContextValue = {
    steps,
    currentStep,
    orientation,
    setCurrentStep,
    goToNextStep,
    goToPreviousStep,
    canGoNext: currentStep < steps.length - 1,
    canGoPrevious: currentStep > 0,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    completedSteps,
    markStepComplete,
    markStepIncomplete,
  };

  return (
    <StepperContext.Provider value={contextValue}>
      <div
        className={cn(
          "w-full",
          orientation === "vertical" && "flex gap-8",
          className
        )}
        {...props}
      >
        {/* Step Indicators */}
        <StepperIndicators
          variant={variant}
          clickable={clickable}
          orientation={orientation}
        />

        {/* Content */}
        <div className={cn("flex-1", orientation === "horizontal" && "mt-8")}>
          {children}
        </div>
      </div>
    </StepperContext.Provider>
  );
}

/**
 * Step Indicators Component
 */
interface StepperIndicatorsProps {
  variant: "default" | "circles" | "simple";
  clickable: boolean;
  orientation: "horizontal" | "vertical";
}

function StepperIndicators({ variant, clickable, orientation }: StepperIndicatorsProps) {
  const { steps, currentStep, setCurrentStep, completedSteps } = useStepperContext();

  const getStepStatus = (index: number): StepStatus => {
    if (completedSteps.has(index)) return "complete";
    if (index === currentStep) return "current";
    return "pending";
  };

  if (variant === "simple") {
    return (
      <div className="flex items-center justify-center gap-2 mb-4">
        {steps.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => clickable && setCurrentStep(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              index === currentStep ? "w-8 bg-primary" : "w-2 bg-muted",
              clickable && "cursor-pointer hover:bg-primary/70",
              !clickable && "cursor-default"
            )}
            aria-label={`Step ${index + 1}`}
            aria-current={index === currentStep ? "step" : undefined}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        orientation === "horizontal"
          ? "flex items-center justify-between"
          : "flex flex-col gap-2"
      )}
    >
      {steps.map((step, index) => {
        const status = getStepStatus(index);
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <StepIndicator
              step={step}
              index={index}
              status={status}
              variant={variant}
              clickable={clickable}
              onClick={() => clickable && setCurrentStep(index)}
            />
            {!isLast && orientation === "horizontal" && (
              <div
                className={cn(
                  "flex-1 h-[2px] mx-4",
                  status === "complete" || index < currentStep
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Individual Step Indicator
 */
interface StepIndicatorProps {
  step: Step;
  index: number;
  status: StepStatus;
  variant: "default" | "circles" | "simple";
  clickable: boolean;
  onClick: () => void;
}

function StepIndicator({
  step,
  index,
  status,
  variant,
  clickable,
  onClick,
}: StepIndicatorProps) {
  const isComplete = status === "complete";
  const isCurrent = status === "current";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3",
        clickable && "cursor-pointer",
        !clickable && "cursor-default",
        variant === "circles" && "flex-col text-center"
      )}
      aria-current={isCurrent ? "step" : undefined}
    >
      {/* Step Circle */}
      <div
        className={cn(
          "flex items-center justify-center rounded-full transition-all",
          variant === "circles" ? "h-12 w-12" : "h-10 w-10",
          isComplete && "bg-primary text-primary-foreground",
          isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
          !isComplete && !isCurrent && "bg-muted text-muted-foreground"
        )}
      >
        {isComplete ? (
          <Check className="h-5 w-5" />
        ) : step.icon ? (
          step.icon
        ) : (
          <span className="text-sm font-semibold">{index + 1}</span>
        )}
      </div>

      {/* Step Label */}
      {variant !== "circles" && (
        <div className="text-left">
          <p
            className={cn(
              "text-sm font-medium",
              isCurrent && "text-primary",
              isComplete && "text-foreground",
              !isComplete && !isCurrent && "text-muted-foreground"
            )}
          >
            {step.title}
            {step.optional && (
              <span className="text-xs text-muted-foreground ml-1">(Optional)</span>
            )}
          </p>
          {step.description && (
            <p className="text-xs text-muted-foreground">{step.description}</p>
          )}
        </div>
      )}

      {variant === "circles" && (
        <div className="mt-2">
          <p
            className={cn(
              "text-sm font-medium",
              isCurrent && "text-primary",
              !isCurrent && "text-muted-foreground"
            )}
          >
            {step.title}
          </p>
        </div>
      )}
    </button>
  );
}

/**
 * StepperContent Component
 * Renders content for a specific step
 */
interface StepperContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Step index this content belongs to (0-based)
   */
  step: number;
}

function StepperContent({
  step,
  className,
  children,
  ...props
}: StepperContentProps) {
  const { currentStep } = useStepperContext();

  if (step !== currentStep) {
    return null;
  }

  return (
    <div
      className={cn("animate-in fade-in-50 duration-300", className)}
      role="tabpanel"
      aria-label={`Step ${step + 1} content`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * StepperNavigation Component
 * Provides next/previous navigation buttons
 */
interface StepperNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Text for the previous button
   */
  previousLabel?: string;
  /**
   * Text for the next button
   */
  nextLabel?: string;
  /**
   * Text for the submit button (on last step)
   */
  submitLabel?: string;
  /**
   * Callback when submit is clicked on last step
   */
  onSubmit?: () => void;
  /**
   * Whether to show the previous button
   */
  showPrevious?: boolean;
  /**
   * Whether the next/submit button is disabled
   */
  nextDisabled?: boolean;
  /**
   * Whether the form is currently submitting
   */
  isSubmitting?: boolean;
}

function StepperNavigation({
  previousLabel = "Previous",
  nextLabel = "Next",
  submitLabel = "Submit",
  onSubmit,
  showPrevious = true,
  nextDisabled = false,
  isSubmitting = false,
  className,
  ...props
}: StepperNavigationProps) {
  const {
    goToNextStep,
    goToPreviousStep,
    canGoNext,
    canGoPrevious,
    isLastStep,
    currentStep,
    markStepComplete,
  } = useStepperContext();

  const handleNext = () => {
    markStepComplete(currentStep);
    if (isLastStep) {
      onSubmit?.();
    } else {
      goToNextStep();
    }
  };

  return (
    <div
      className={cn("flex items-center justify-between pt-6", className)}
      {...props}
    >
      <div>
        {showPrevious && canGoPrevious && (
          <Button
            type="button"
            variant="outline"
            onClick={goToPreviousStep}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {previousLabel}
          </Button>
        )}
      </div>

      <Button
        type="button"
        onClick={handleNext}
        disabled={nextDisabled || isSubmitting}
        className="gap-2"
      >
        {isLastStep ? submitLabel : nextLabel}
        {!isLastStep && <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}

/**
 * Hook for accessing stepper context
 */
function useStepper() {
  return useStepperContext();
}

export {
  Stepper,
  StepperContent,
  StepperNavigation,
  StepperIndicators,
  useStepper,
};
export type { Step, StepStatus, StepperProps, StepperContentProps, StepperNavigationProps };


