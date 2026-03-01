/**
 * CheckoutProgressIndicator
 * Visual multi-step progress indicator for the checkout flow.
 * Shows connected steps with animated progress lines, clear visual states
 * for completed/active/future steps, and responsive mobile/desktop layouts.
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CheckoutStep {
  id: number;
  name: string;
  icon: LucideIcon;
}

interface CheckoutProgressIndicatorProps {
  steps: CheckoutStep[];
  currentStep: number;
  themeColor: string;
  isLuxuryTheme?: boolean;
  onStepClick?: (stepId: number) => void;
}

export function CheckoutProgressIndicator({
  steps,
  currentStep,
  themeColor,
  isLuxuryTheme = false,
  onStepClick,
}: CheckoutProgressIndicatorProps) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Mobile: compact connected step indicators */}
      <nav className="flex sm:hidden items-center justify-center gap-1" aria-label="Checkout steps">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const isFuture = currentStep < step.id;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => isComplete && onStepClick?.(step.id)}
                disabled={isFuture}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  isFuture
                    ? isLuxuryTheme
                      ? 'bg-white/5 text-white/30'
                      : 'bg-muted text-muted-foreground'
                    : ''
                }`}
                style={{
                  backgroundColor: isComplete || isActive ? themeColor : undefined,
                  color: isComplete || isActive ? '#fff' : undefined,
                  opacity: isComplete ? 0.7 : undefined,
                }}
              >
                {isComplete ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <span className="w-4 h-4 flex items-center justify-center text-xs">{step.id}</span>
                )}
                <span>{step.name}</span>

                {/* Active pulse indicator */}
                {isActive && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ border: `1.5px solid ${themeColor}` }}
                  />
                )}
              </button>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  className={`w-4 h-[2px] mx-0.5 ${
                    isLuxuryTheme ? 'bg-white/10' : 'bg-muted'
                  }`}
                >
                  <motion.div
                    className="h-full"
                    initial={{ width: '0%' }}
                    animate={{ width: isComplete ? '100%' : '0%' }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                    style={{ backgroundColor: themeColor }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Desktop: full icon step indicator with animated connector lines */}
      <nav className="hidden sm:flex justify-between" aria-label="Checkout steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const isFuture = currentStep < step.id;
          const isLast = index === steps.length - 1;

          return (
            <div
              key={step.id}
              className="flex-1 flex flex-col items-center relative"
            >
              {/* Connecting Line */}
              {!isLast && (
                <div
                  className={`absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${
                    isLuxuryTheme ? 'bg-white/5' : 'bg-muted'
                  }`}
                >
                  <motion.div
                    className="h-full"
                    initial={{ width: '0%' }}
                    animate={{ width: isComplete ? '100%' : '0%' }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{ backgroundColor: themeColor }}
                  />
                </div>
              )}

              {/* Step Circle */}
              <button
                type="button"
                onClick={() => isComplete && onStepClick?.(step.id)}
                disabled={isFuture}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${
                  isActive
                    ? 'ring-2 ring-offset-4 ring-offset-background scale-110'
                    : ''
                } ${
                  isFuture
                    ? isLuxuryTheme
                      ? 'bg-white/5 text-white/20'
                      : 'bg-muted text-muted-foreground'
                    : ''
                } ${isComplete || isActive ? 'cursor-pointer' : ''}`}
                style={{
                  backgroundColor: isComplete || isActive ? themeColor : undefined,
                  color: isComplete || isActive ? '#fff' : undefined,
                  boxShadow: isActive && isLuxuryTheme ? `0 0 20px ${themeColor}60` : undefined,
                  borderColor: isLuxuryTheme ? '#000' : undefined,
                  ringColor: isActive ? themeColor : undefined,
                }}
              >
                {isComplete ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}

                {/* Active Pulse Ring */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ border: `1px solid ${themeColor}` }}
                  />
                )}
              </button>

              {/* Step Label */}
              <span
                className={`text-sm uppercase tracking-widest mt-4 font-semibold transition-colors duration-300 ${
                  isActive
                    ? 'text-primary'
                    : isLuxuryTheme
                      ? 'text-white/20'
                      : 'text-muted-foreground'
                }`}
                style={{ color: isActive ? themeColor : isComplete ? themeColor : undefined, opacity: isComplete ? 0.6 : undefined }}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </nav>

      {/* Step counter text (mobile only) */}
      <p className="sm:hidden text-center text-xs text-muted-foreground mt-2">
        Step {currentStep} of {steps.length}
      </p>
    </div>
  );
}
