import { useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiCelebrationProps {
  trigger: boolean;
  onComplete?: () => void;
}

export function ConfettiCelebration({ trigger, onComplete }: ConfettiCelebrationProps) {
  useEffect(() => {
    if (!trigger) return;

    const duration = 3000;
    const end = Date.now() + duration;

    const colors = [
      'hsl(var(--primary))',       // emerald
      'hsl(var(--info))',          // blue
      'hsl(var(--warning))',       // amber
      'hsl(var(--destructive))',   // red
      'hsl(var(--marketing-secondary))' // purple
    ];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });

      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      } else {
        onComplete?.();
      }
    };

    frame();
  }, [trigger, onComplete]);

  return null;
}
