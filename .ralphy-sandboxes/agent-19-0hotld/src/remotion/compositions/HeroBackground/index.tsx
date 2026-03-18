/**
 * HeroBackground — 4-second looping gradient mesh (120 frames @ 30fps).
 * Two SVG radial-gradient blobs oscillating positions with sin/cos.
 */

import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '@/remotion/config';

export function HeroBackground() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const t = frame / fps; // time in seconds

  // Blob 1: oscillates in a slow circle
  const blob1X = 25 + Math.sin(t * 0.8) * 10;
  const blob1Y = 20 + Math.cos(t * 0.6) * 8;

  // Blob 2: oscillates counter-phase
  const blob2X = 70 + Math.cos(t * 0.7) * 12;
  const blob2Y = 30 + Math.sin(t * 0.9) * 10;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
        {/* Blob 1: Primary green */}
        <div
          style={{
            position: 'absolute',
            left: `${blob1X}%`,
            top: `${blob1Y}%`,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.primary}66 0%, transparent 70%)`,
            filter: 'blur(100px)',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {/* Blob 2: Accent cyan */}
        <div
          style={{
            position: 'absolute',
            left: `${blob2X}%`,
            top: `${blob2Y}%`,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${COLORS.accent}4D 0%, transparent 70%)`,
            filter: 'blur(100px)',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}
