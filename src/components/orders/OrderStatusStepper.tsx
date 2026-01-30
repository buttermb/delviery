import { Clock, CheckCircle, Package, Truck, Home, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Order status type for the stepper
 */
export type OrderStepperStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

interface OrderStatusStepperProps {
  /**
   * Current status of the order
   */
  status: OrderStepperStatus | string;
  /**
   * Optional class name for styling
   */
  className?: string;
  /**
   * Size variant
   */
  size?: 'sm' | 'default' | 'lg';
  /**
   * Show labels under each step
   */
  showLabels?: boolean;
  /**
   * Orientation of the stepper
   */
  orientation?: 'horizontal' | 'vertical';
}

interface StepConfig {
  id: OrderStepperStatus;
  label: string;
  icon: typeof Clock;
}

const STEPS: StepConfig[] = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { id: 'packed', label: 'Packed', icon: Package },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'delivered', label: 'Delivered', icon: Home },
];

const SIZE_CONFIG = {
  sm: {
    circle: 'w-8 h-8',
    icon: 'h-4 w-4',
    label: 'text-[10px]',
    line: 'h-0.5',
    gap: 'gap-1',
    verticalLine: 'w-0.5 h-6',
  },
  default: {
    circle: 'w-10 h-10',
    icon: 'h-5 w-5',
    label: 'text-xs',
    line: 'h-1',
    gap: 'gap-2',
    verticalLine: 'w-1 h-8',
  },
  lg: {
    circle: 'w-12 h-12',
    icon: 'h-6 w-6',
    label: 'text-sm',
    line: 'h-1.5',
    gap: 'gap-2',
    verticalLine: 'w-1.5 h-10',
  },
};

/**
 * Get the step index for a given status
 */
function getStepIndex(status: string): number {
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  const index = STEPS.findIndex((s) => s.id === normalized);

  if (index === -1) {
    // Map similar statuses to our steps
    if (normalized === 'ready' || normalized === 'ready_for_pickup' || normalized === 'preparing') {
      return 2; // packed
    }
    if (normalized === 'in_transit' || normalized === 'out_for_delivery') {
      return 3; // shipped
    }
    if (normalized === 'completed') {
      return 4; // delivered
    }
    return 0; // default to pending
  }

  return index;
}

/**
 * Check if order is in a cancelled state
 */
function isCancelled(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled' || normalized === 'rejected';
}

/**
 * OrderStatusStepper Component
 *
 * Visual stepper showing order progress through:
 * pending → confirmed → packed → shipped → delivered
 *
 * @example
 * ```tsx
 * <OrderStatusStepper status="confirmed" />
 * <OrderStatusStepper status="shipped" size="lg" showLabels />
 * <OrderStatusStepper status="delivered" orientation="vertical" />
 * ```
 */
export function OrderStatusStepper({
  status,
  className,
  size = 'default',
  showLabels = true,
  orientation = 'horizontal',
}: OrderStatusStepperProps) {
  const currentStepIndex = getStepIndex(status);
  const cancelled = isCancelled(status);
  const sizeConfig = SIZE_CONFIG[size];

  if (cancelled) {
    return (
      <div className={cn('flex items-center justify-center py-4', className)}>
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              'rounded-full flex items-center justify-center bg-destructive text-white',
              sizeConfig.circle
            )}
          >
            <XCircle className={sizeConfig.icon} />
          </div>
          {showLabels && (
            <span className={cn('font-medium text-destructive', sizeConfig.label)}>
              Cancelled
            </span>
          )}
        </div>
      </div>
    );
  }

  if (orientation === 'vertical') {
    return (
      <div className={cn('flex flex-col', sizeConfig.gap, className)}>
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Step circle and connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    sizeConfig.circle,
                    isActive
                      ? 'bg-primary border-primary text-white'
                      : 'bg-muted border-muted-foreground/30 text-muted-foreground',
                    isCurrent && 'ring-4 ring-primary/20 scale-110'
                  )}
                >
                  <Icon className={sizeConfig.icon} />
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'transition-all duration-500',
                      sizeConfig.verticalLine,
                      isActive && index < currentStepIndex
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                    )}
                  />
                )}
              </div>

              {/* Label */}
              {showLabels && (
                <div className="pt-2">
                  <span
                    className={cn(
                      'font-medium transition-colors duration-300',
                      sizeConfig.label,
                      isActive ? 'text-primary' : 'text-muted-foreground',
                      isCurrent && 'font-bold'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal orientation (default)
  return (
    <div className={cn('w-full py-4', className)}>
      <div className="relative flex items-center justify-between w-full">
        {/* Progress line background */}
        <div
          className={cn(
            'absolute left-0 top-1/2 transform -translate-y-1/2 w-full bg-muted-foreground/20 rounded-full -z-10',
            sizeConfig.line
          )}
        />

        {/* Active progress line */}
        <div
          className={cn(
            'absolute left-0 top-1/2 transform -translate-y-1/2 bg-primary rounded-full -z-10 transition-all duration-700 ease-out',
            sizeConfig.line
          )}
          style={{
            width: `${(currentStepIndex / (STEPS.length - 1)) * 100}%`,
          }}
        />

        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                'flex flex-col items-center bg-background dark:bg-background px-1',
                sizeConfig.gap
              )}
            >
              <div
                className={cn(
                  'rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  sizeConfig.circle,
                  isActive
                    ? 'bg-primary border-primary text-white shadow-lg'
                    : 'bg-background border-muted-foreground/30 text-muted-foreground',
                  isCurrent && 'ring-4 ring-primary/20 scale-110'
                )}
              >
                <Icon className={sizeConfig.icon} />
              </div>
              {showLabels && (
                <span
                  className={cn(
                    'font-medium transition-colors duration-300 whitespace-nowrap',
                    sizeConfig.label,
                    isActive ? 'text-primary' : 'text-muted-foreground',
                    isCurrent && 'font-bold'
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get the display label for a status
 */
export function getOrderStatusLabel(status: OrderStepperStatus | string): string {
  const step = STEPS.find((s) => s.id === status.toLowerCase());
  if (step) return step.label;

  if (isCancelled(status)) return 'Cancelled';

  // Fallback: capitalize the status
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get the ordered list of statuses for the stepper
 */
export function getOrderStatusSteps(): readonly StepConfig[] {
  return STEPS;
}
