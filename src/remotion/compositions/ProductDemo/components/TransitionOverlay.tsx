/**
 * Color wipe transition overlay between scenes.
 */

import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '@/remotion/config';

interface TransitionOverlayProps {
  /** Frame at which the transition begins */
  startFrame: number;
  /** How many frames the transition lasts */
  duration?: number;
  color?: string;
}

export function TransitionOverlay({
  startFrame,
  duration = 15,
  color = COLORS.primary,
}: TransitionOverlayProps) {
  const frame = useCurrentFrame();

  // Wipe in: 0 → 100% width
  const wipeIn = interpolate(
    frame,
    [startFrame, startFrame + duration / 2],
    [0, 100],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Wipe out: shift left 0 → 100%
  const wipeOut = interpolate(
    frame,
    [startFrame + duration / 2, startFrame + duration],
    [0, 100],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  const isActive = frame >= startFrame && frame <= startFrame + duration;

  if (!isActive) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${wipeOut}%`,
          width: `${wipeIn}%`,
          backgroundColor: color,
          opacity: 0.95,
        }}
      />
    </div>
  );
}
