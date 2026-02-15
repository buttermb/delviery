// @ts-nocheck
/**
 * SecurityExplainer — 15-second composition (450 frames @ 30fps).
 * Shield materializes → encryption text scramble → auto-burn countdown → "Protected" badge.
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

function getScrambledText(original: string, progress: number): string {
  const revealed = Math.floor(progress * original.length);
  return original
    .split('')
    .map((char, i) => {
      if (i < revealed) return char;
      const idx = (i * 7 + Math.floor(progress * 100)) % SCRAMBLE_CHARS.length;
      return SCRAMBLE_CHARS[idx];
    })
    .join('');
}

export function SecurityExplainer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Shield materializes (0-90)
  const shieldScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 30,
  });
  const shieldOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const shieldGlow = interpolate(
    frame % 60,
    [0, 30, 60],
    [0.3, 0.8, 0.3],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Phase 2: Text scramble (90-240)
  const encryptionText = 'AES-256-GCM ENCRYPTION ACTIVE';
  const scrambleProgress = interpolate(frame, [90, 200], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const scrambleOpacity = interpolate(frame, [85, 95], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Phase 3: Auto-burn countdown (240-370)
  const countdownValue = interpolate(frame, [240, 370], [60, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const countdownOpacity = interpolate(frame, [235, 245], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const burnProgress = interpolate(frame, [240, 370], [100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Phase 4: Protected badge (370-450)
  const badgeScale = spring({
    frame: frame - 370,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 25,
  });
  const badgeOpacity = interpolate(frame, [370, 380], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: 42,
          fontWeight: 800,
          color: 'white',
          textAlign: 'center',
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          }),
          transform: `translateY(${interpolate(frame, [0, 20], [20, 0], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          })}px)`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        OPSEC-Grade Security
      </div>

      {/* Shield */}
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.primary}40, transparent 70%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: shieldOpacity,
          transform: `scale(${shieldScale})`,
          boxShadow: `0 0 ${40 * shieldGlow}px ${COLORS.primary}50`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ fontSize: 72 }}>🛡️</div>
      </div>

      {/* Encryption text scramble */}
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.primary,
          letterSpacing: 3,
          opacity: scrambleOpacity,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {getScrambledText(encryptionText, scrambleProgress)}
      </div>

      {/* Auto-burn countdown */}
      {frame >= 240 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            opacity: countdownOpacity,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            Auto-Burn Countdown
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: countdownValue <= 15 ? '#ef4444' : '#f59e0b', fontFamily: 'monospace' }}>
            {Math.max(0, Math.floor(countdownValue))}s
          </div>
          {/* Progress bar */}
          <div style={{ width: 300, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${burnProgress}%`,
                height: '100%',
                backgroundColor: countdownValue <= 15 ? '#ef4444' : '#f59e0b',
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      )}

      {/* Protected badge */}
      {frame >= 370 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 28px',
            borderRadius: 16,
            backgroundColor: `${COLORS.primary}20`,
            border: `2px solid ${COLORS.primary}`,
            opacity: badgeOpacity,
            transform: `scale(${badgeScale})`,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 24 }}>✓</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.primary, letterSpacing: 2 }}>
            PROTECTED
          </span>
        </div>
      )}
    </div>
  );
}
