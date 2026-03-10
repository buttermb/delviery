/**
 * StepIndicator
 * Displays checkout progress steps - compact pills on mobile, full icons on desktop
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { STEPS } from './types';

interface StepIndicatorProps {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  themeColor: string;
  isLuxuryTheme: boolean;
}

export function StepIndicator({ currentStep, setCurrentStep, themeColor, isLuxuryTheme }: StepIndicatorProps) {
  return (
    <div className="mb-6 sm:mb-8">
      {/* Mobile: compact pill indicators */}
      <nav className="flex sm:hidden gap-2 justify-center" aria-label="Checkout steps">
        {STEPS.map((step) => {
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const isFuture = currentStep < step.id;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                if (isComplete) setCurrentStep(step.id);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                isActive
                  ? 'text-white shadow-md'
                  : isComplete
                    ? 'text-white/90'
                    : isFuture
                      ? (isLuxuryTheme ? 'bg-white/5 text-white/30' : 'bg-muted text-muted-foreground')
                      : ''
              }`}
              style={{
                backgroundColor: isComplete || isActive ? themeColor : undefined,
                opacity: isComplete ? 0.7 : undefined,
              }}
              disabled={isFuture}
            >
              {isComplete ? (
                <Check className="w-3 h-3" />
              ) : (
                <span>{step.id}</span>
              )}
              <span>{step.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Desktop: full icon step indicator */}
      <nav className="hidden sm:flex justify-between">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          const isFuture = currentStep < step.id;

          return (
            <div
              key={step.id}
              className="flex-1 flex flex-col items-center relative"
            >
              {/* Connecting Line */}
              {index < STEPS.length - 1 && (
                <div className={`absolute top-5 left-[calc(50%+20px)] w-[calc(100%-40px)] h-[2px] ${isLuxuryTheme ? 'bg-white/5' : 'bg-muted'}`}>
                  <motion.div
                    className="h-full"
                    initial={{ width: "0%" }}
                    animate={{ width: isComplete ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{ backgroundColor: themeColor }}
                  />
                </div>
              )}

              <div
                className={`relative w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-300 ${isActive ? 'ring-2 ring-offset-4 ring-offset-background scale-110' : ''
                  } ${isFuture ? (isLuxuryTheme ? 'bg-white/5 text-white/20' : 'bg-muted text-muted-foreground') : ''
                  }`}
                style={{
                  backgroundColor: isComplete || isActive ? themeColor : undefined,
                  color: isComplete || isActive ? '#fff' : undefined,
                  boxShadow: isActive && isLuxuryTheme ? `0 0 20px ${themeColor}60` : undefined,
                  borderColor: isLuxuryTheme ? '#000' : undefined
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
              </div>

              <span
                className={`text-xs uppercase tracking-widest mt-4 font-semibold transition-colors duration-300 ${isActive ? 'text-primary' : (isLuxuryTheme ? 'text-white/20' : 'text-muted-foreground')
                  }`}
                style={{ color: isActive ? themeColor : undefined }}
              >
                {step.name}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
