/**
 * Floating label with pulsing dot — used to highlight features in scenes.
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

interface FeatureCalloutProps {
  text: string;
  x: number;
  y: number;
  delay?: number;
}

export function FeatureCallout({ text, x, y, delay = 0 }: FeatureCalloutProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 20,
  });

  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Pulsing dot animation (loops every 30 frames)
  const pulseOpacity = interpolate(
    (frame - delay) % 30,
    [0, 15, 30],
    [0.4, 1, 0.4],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${scale})`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: COLORS.primary,
          opacity: pulseOpacity,
          boxShadow: `0 0 12px ${COLORS.primary}60`,
        }}
      />
      <div
        style={{
          backgroundColor: 'white',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          color: COLORS.text,
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          border: `1px solid ${COLORS.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </div>
  );
}
