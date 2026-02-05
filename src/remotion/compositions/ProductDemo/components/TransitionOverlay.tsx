import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS } from '../../../config';

interface TransitionOverlayProps {
  startFrame: number;
  direction?: 'left' | 'right' | 'diagonal';
}

export function TransitionOverlay({ startFrame, direction = 'right' }: TransitionOverlayProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame) return null;

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 30, mass: 1, stiffness: 80 },
  });

  const clipPaths: Record<string, string> = {
    left: `inset(0 ${interpolate(progress, [0, 1], [100, 0])}% 0 0)`,
    right: `inset(0 0 0 ${interpolate(progress, [0, 1], [100, 0])}%)`,
    diagonal: `polygon(${interpolate(progress, [0, 1], [100, 0])}% 0%, 100% 0%, 100% 100%, ${interpolate(progress, [0, 1], [120, 0])}% 100%)`,
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
        clipPath: clipPaths[direction],
        zIndex: 100,
      }}
    />
  );
}
