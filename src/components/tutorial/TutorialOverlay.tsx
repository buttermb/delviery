import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TutorialStep {
  id: string;
  target: string; // CSS selector or data-tutorial attribute
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
}

interface TutorialOverlayProps {
  isOpen: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TutorialOverlay({
  isOpen,
  steps,
  currentStep,
  onNext,
  onPrevious,
  onSkip,
  onComplete,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [contentPosition, setContentPosition] = useState<{ top: number; left: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Find and highlight target element
  useEffect(() => {
    if (!isOpen || !currentStepData) return;

    const findTarget = () => {
      // Try data-tutorial attribute first (most reliable)
      let element = document.querySelector(`[data-tutorial="${currentStepData.target}"]`);
      
      // Fallback to CSS selector if target doesn't start with [data-tutorial=
      if (!element && !currentStepData.target.startsWith('[data-tutorial=')) {
        try {
          element = document.querySelector(currentStepData.target);
        } catch (e) {
          // Invalid selector, return null
          console.warn(`Invalid tutorial target selector: ${currentStepData.target}`);
        }
      }

      return element as HTMLElement | null;
    };

    const updateTarget = () => {
      const target = findTarget();
      
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        
        // Calculate content position based on step position preference
        const position = currentStepData.position || 'bottom';
        const spacing = 20;
        const contentWidth = 320;
        const contentHeight = 200;
        
        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = rect.top - contentHeight - spacing;
            left = rect.left + rect.width / 2 - contentWidth / 2;
            break;
          case 'bottom':
            top = rect.bottom + spacing;
            left = rect.left + rect.width / 2 - contentWidth / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2 - contentHeight / 2;
            left = rect.left - contentWidth - spacing;
            break;
          case 'right':
            top = rect.top + rect.height / 2 - contentHeight / 2;
            left = rect.right + spacing;
            break;
          case 'center':
            top = window.innerHeight / 2 - contentHeight / 2;
            left = window.innerWidth / 2 - contentWidth / 2;
            break;
        }

        // Ensure content stays within viewport
        top = Math.max(20, Math.min(top, window.innerHeight - contentHeight - 20));
        left = Math.max(20, Math.min(left, window.innerWidth - contentWidth - 20));

        setContentPosition({ top, left });
        
        // Scroll target into view if needed (with delay to ensure element is stable)
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }, 100);
      } else {
        // If target not found, center the content and show a helpful message
        setTargetRect(null);
        setContentPosition({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 160,
        });
        // Log warning for debugging (only in dev)
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Tutorial target not found: ${currentStepData.target}. Centering content.`);
        }
      }
    };

    // Initial update with delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      updateTarget();
      // Also try after a longer delay in case of lazy-loaded content
      setTimeout(updateTarget, 300);
    }, 100);

    // Update on scroll/resize
    const handleUpdate = () => updateTarget();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Use MutationObserver to watch for DOM changes (for dynamic content)
    const observer = new MutationObserver(() => {
      updateTarget();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tutorial', 'class', 'style']
    });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      observer.disconnect();
    };
  }, [isOpen, currentStep, currentStepData]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' && !isLastStep) {
        onNext();
      } else if (e.key === 'ArrowLeft' && !isFirstStep) {
        onPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFirstStep, isLastStep, onNext, onPrevious, onSkip]);

  if (!isOpen || !currentStepData) return null;

  return (
    <AnimatePresence>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[9999] pointer-events-auto"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        role="dialog"
      >
        {/* Dark overlay with cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75"
          style={{
            clipPath: targetRect
              ? `polygon(
                  0% 0%, 
                  0% 100%, 
                  ${targetRect.left}px 100%, 
                  ${targetRect.left}px ${targetRect.top}px, 
                  ${targetRect.right}px ${targetRect.top}px, 
                  ${targetRect.right}px ${targetRect.bottom}px, 
                  ${targetRect.left}px ${targetRect.bottom}px, 
                  ${targetRect.left}px 100%, 
                  100% 100%, 
                  100% 0%
                )`
              : undefined,
          }}
        />

        {/* Highlight border around target */}
        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4px_rgba(59,130,246,0.5)] pointer-events-none"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}

        {/* Tutorial content */}
        {contentPosition && (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bg-background border border-border rounded-lg shadow-xl p-6 max-w-sm pointer-events-auto"
            style={{
              top: contentPosition.top,
              left: contentPosition.left,
            }}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={onSkip}
              aria-label="Close tutorial"
            >
              <X className="h-4 w-4" />
            </Button>

            {/* Progress indicator */}
            <div className="flex items-center gap-1 mb-4">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    index === currentStep
                      ? 'bg-primary flex-1'
                      : index < currentStep
                      ? 'bg-primary/50 w-2'
                      : 'bg-muted w-2'
                  )}
                />
              ))}
            </div>

            {/* Step number */}
            <div className="text-xs text-muted-foreground mb-2">
              Step {currentStep + 1} of {steps.length}
            </div>

            {/* Title */}
            <h3 id="tutorial-title" className="text-lg font-semibold mb-2">
              {currentStepData.title}
            </h3>

            {/* Content */}
            <p className="text-sm text-muted-foreground mb-6">
              {currentStepData.content}
            </p>

            {/* Action button (optional) */}
            {currentStepData.action && (
              <Button
                variant="outline"
                size="sm"
                className="mb-4 w-full"
                onClick={currentStepData.action}
              >
                Try it now
              </Button>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrevious}
                disabled={isFirstStep}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-muted-foreground"
              >
                Skip
              </Button>

              <Button
                size="sm"
                onClick={isLastStep ? onComplete : onNext}
                className="flex-1"
              >
                {isLastStep ? 'Complete' : 'Next'}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}

