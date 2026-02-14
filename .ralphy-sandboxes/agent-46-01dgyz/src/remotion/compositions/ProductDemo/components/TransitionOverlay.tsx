import { interpolate, useCurrentFrame } from 'remotion';

// Scene transition with morphing shapes
export function TransitionOverlay({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  if (progress <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        background: `linear-gradient(135deg, 
          hsl(160, 84%, 39%) ${progress * 100}%, 
          hsl(160, 84%, 29%) ${progress * 100 + 20}%,
          transparent ${progress * 100 + 40}%
        )`,
        opacity: progress < 0.5 ? progress * 2 : 2 - progress * 2,
        pointerEvents: 'none',
      }}
    />
  );
}
