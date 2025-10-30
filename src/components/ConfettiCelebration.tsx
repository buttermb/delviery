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

    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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

export function fireConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
}
