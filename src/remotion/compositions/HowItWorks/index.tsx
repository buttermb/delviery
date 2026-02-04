/**
 * HowItWorks — 20-second composition (600 frames @ 30fps).
 * 3 steps: Sign Up → Import → Go Live with sequential reveals,
 * checkmark animations, and connecting arrows.
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

interface StepData {
  title: string;
  description: string;
  time: string;
  details: string[];
  emoji: string;
}

const STEPS: StepData[] = [
  {
    title: 'Sign Up',
    description: 'Create your free account in 60 seconds',
    time: '1 min',
    details: ['No credit card required', 'Instant access', '14-day free trial'],
    emoji: '👤',
  },
  {
    title: 'Import Data',
    description: 'Import your products & customers',
    time: '5 min',
    details: ['CSV/Excel import', 'Manual entry option', 'Bulk product upload'],
    emoji: '📤',
  },
  {
    title: 'Go Live',
    description: 'Start taking orders and managing your business',
    time: '10 min',
    details: ['Create your first menu', 'Invite customers', 'Start receiving orders'],
    emoji: '🚀',
  },
];

function StepCard({ step, index }: { step: StepData; index: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 25,
  });

  const detailsStart = 30;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        transform: `scale(${cardScale})`,
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 42,
          boxShadow: `0 8px 24px ${COLORS.primary}30`,
        }}
      >
        {step.emoji}
      </div>

      {/* Step number */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: COLORS.primary,
          backgroundColor: `${COLORS.primary}15`,
          padding: '4px 14px',
          borderRadius: 20,
          border: `1px solid ${COLORS.primary}30`,
        }}
      >
        Step {index + 1}
      </div>

      {/* Title */}
      <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, textAlign: 'center' }}>
        {step.title}
      </div>

      {/* Description */}
      <div style={{ fontSize: 14, color: COLORS.textLight, textAlign: 'center', maxWidth: 280 }}>
        {step.description}
      </div>

      {/* Time badge */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.text,
          backgroundColor: COLORS.bgSubtle,
          padding: '6px 16px',
          borderRadius: 20,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        {step.time}
      </div>

      {/* Detail items with checkmarks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {step.details.map((detail, i) => {
          const detailOpacity = interpolate(
            frame,
            [detailsStart + i * 10, detailsStart + i * 10 + 8],
            [0, 1],
            { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
          );
          const checkScale = spring({
            frame: frame - (detailsStart + i * 10),
            fps,
            config: SPRING_PRESETS.bouncy,
            durationInFrames: 15,
          });

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: detailOpacity,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: COLORS.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${checkScale})`,
                  fontSize: 11,
                  color: 'white',
                  fontWeight: 800,
                }}
              >
                ✓
              </div>
              <span style={{ fontSize: 13, color: COLORS.text }}>{detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectingArrow({ delay }: { delay: number }) {
  const frame = useCurrentFrame();

  const arrowOpacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const arrowX = interpolate(frame, [delay, delay + 15], [-10, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: arrowOpacity,
        transform: `translateX(${arrowX}px)`,
        color: COLORS.primary,
        fontSize: 32,
        fontWeight: 800,
        paddingTop: 40,
      }}
    >
      →
    </div>
  );
}

export function HowItWorks() {
  const frame = useCurrentFrame();

  // Title fade in
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const titleY = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Progress bar
  const progressWidth = interpolate(frame, [0, 540], [0, 100], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 80px',
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <div style={{ fontSize: 48, fontWeight: 800, color: COLORS.text, marginBottom: 8 }}>
          How FloraIQ Works
        </div>
        <div style={{ fontSize: 20, color: COLORS.textLight }}>
          Get started in minutes, not months
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '60%',
          height: 6,
          backgroundColor: `${COLORS.border}`,
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 48,
        }}
      >
        <div
          style={{
            width: `${progressWidth}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
            borderRadius: 3,
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flex: 1 }}>
        {STEPS.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
            <Sequence from={i * 180} durationInFrames={600 - i * 180}>
              <StepCard step={step} index={i} />
            </Sequence>
            {i < STEPS.length - 1 && <ConnectingArrow delay={i * 180 + 60} />}
          </div>
        ))}
      </div>
    </div>
  );
}
