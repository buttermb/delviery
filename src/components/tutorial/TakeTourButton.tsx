import { Button } from '@/components/ui/button';
import Play from "lucide-react/dist/esm/icons/play";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { useTutorialContext } from './TutorialProvider';
import { TutorialOverlay, TutorialStep } from './TutorialOverlay';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { getTutorial } from '@/lib/tutorials/tutorialConfig';

interface TakeTourButtonProps {
  tutorialId: string;
  steps: TutorialStep[];
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function TakeTourButton({
  tutorialId,
  steps,
  variant = 'outline',
  size = 'sm',
  className,
}: TakeTourButtonProps) {
  const {
    state,
    isTutorialCompleted,
    startTutorial,
    nextStep,
    previousStep,
    skip,
    complete,
  } = useTutorialContext();

  const isCompleted = isTutorialCompleted(tutorialId);
  const isActive = state.isActive && state.tutorialId === tutorialId;
  const wasActiveRef = useRef(false);
  const tutorialNameRef = useRef<string | null>(null);

  // Get tutorial name from config
  useEffect(() => {
    const tutorial = getTutorial(tutorialId);
    if (tutorial) {
      tutorialNameRef.current = tutorial.name;
    } else {
      // Fallback: infer from tutorialId
      tutorialNameRef.current = tutorialId.replace('-tour', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }, [tutorialId]);

  // Show completion toast when tutorial completes
  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      // Tutorial just completed (was active, now inactive)
      const tutorialName = tutorialNameRef.current || 'Tutorial';
      toast.success(`🎉 ${tutorialName} Completed!`, {
        description: 'You can restart this tour anytime using the "Restart Tour" button.',
        duration: 4000,
      });
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  const handleStart = () => {
    // Prevent starting if another tutorial is already active
    if (state.isActive && state.tutorialId !== tutorialId) {
      toast.info('Please complete the current tour first');
      return;
    }
    
    const started = startTutorial(tutorialId, true);
    if (started) {
      wasActiveRef.current = true;
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleStart}
        className={className}
        aria-label={isCompleted ? 'Restart tutorial' : 'Take tour'}
      >
        {isCompleted ? (
          <>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart Tour
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            Take Tour
          </>
        )}
      </Button>

      {isActive && (
        <TutorialOverlay
          isOpen={isActive}
          steps={steps}
          currentStep={state.currentStep}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skip}
          onComplete={complete}
        />
      )}
    </>
  );
}

