/**
 * Scene 5: Menus — Phone mockup: lock → decrypt → menu reveal.
 * Frames 0–180 within its Sequence (6 seconds at 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';
import { FeatureCallout } from '@/remotion/compositions/ProductDemo/components/FeatureCallout';

export function MenusScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase transitions: lock (0-60), decrypt (60-100), reveal (100-180)
  const phase = frame < 60 ? 'lock' : frame < 100 ? 'decrypt' : 'reveal';

  // Phone gentle oscillation
  const phoneRotateY = interpolate(
    frame % 180,
    [0, 90, 180],
    [-8, -2, -8],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Lock progress bar
  const lockProgress = interpolate(frame, [10, 55], [0, 100], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Reveal slide up
  const revealY = interpolate(frame, [100, 120], [30, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const revealOpacity = interpolate(frame, [100, 115], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Decrypt shield scale
  const shieldScale = spring({
    frame: frame - 60,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 20,
  });

  // Background admin panel opacity
  const bgOpacity = interpolate(frame, [0, 10], [0, 0.35], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      {/* Background admin panel (blurred) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: bgOpacity,
          filter: 'blur(2px)',
          padding: 40,
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: 'white',
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
          }}
        >
          {/* Sidebar */}
          <div style={{ width: 200, borderRight: `1px solid ${COLORS.border}`, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Security Settings
            </div>
            {['General', 'Access Control', 'Encryption', 'Audit Logs'].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: i === 2 ? COLORS.primary : COLORS.textLight,
                  backgroundColor: i === 2 ? `${COLORS.primary}10` : 'transparent',
                  marginBottom: 4,
                }}
              >
                {item}
              </div>
            ))}
          </div>
          {/* Content */}
          <div style={{ flex: 1, padding: 32 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>Menu Encryption</div>
            <div style={{ fontSize: 11, color: COLORS.textLight }}>Configure access requirements for this menu.</div>
          </div>
        </div>
      </div>

      {/* Phone mockup — centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 1000,
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: 320,
            height: 600,
            backgroundColor: '#1e293b',
            borderRadius: 44,
            border: '10px solid #334155',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            position: 'relative',
            transform: `rotateY(${phoneRotateY}deg)`,
          }}
        >
          {/* Notch */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 100,
              height: 24,
              backgroundColor: '#0f172a',
              borderRadius: 20,
              zIndex: 40,
            }}
          />

          {/* Screen shine */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%)',
              pointerEvents: 'none',
              zIndex: 50,
              borderRadius: 34,
            }}
          />

          {/* Phase: Lock */}
          {phase === 'lock' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#1e293b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 30,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  fontSize: 28,
                }}
              >
                🔒
              </div>
              <div style={{ color: 'white', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                Secure Menu
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 32 }}>
                Enter passphrase to decrypt.
              </div>
              {/* Password dots */}
              <div
                style={{
                  width: '80%',
                  height: 40,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {[0, 1, 2, 3].map((i) => {
                  const dotOpacity = interpolate(frame, [15 + i * 6, 18 + i * 6], [0, 1], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'white',
                        opacity: dotOpacity,
                      }}
                    />
                  );
                })}
              </div>
              {/* Progress bar */}
              <div style={{ width: '80%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${lockProgress}%`,
                    height: '100%',
                    backgroundColor: COLORS.primary,
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          )}

          {/* Phase: Decrypt */}
          {phase === 'decrypt' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: '#1e293b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: 48, transform: `scale(${shieldScale})`, marginBottom: 16 }}>🛡️</div>
              <div style={{ color: '#34d399', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                DECRYPTING ASSETS...
              </div>
            </div>
          )}

          {/* Phase: Reveal */}
          {phase === 'reveal' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 48,
                opacity: revealOpacity,
                transform: `translateY(${revealY}px)`,
              }}
            >
              <div style={{ padding: '0 24px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: COLORS.textLight, fontFamily: 'monospace', marginBottom: 4 }}>
                  EXP: 23h 59m
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>
                  Premium Selection
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: 16,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  overflow: 'hidden',
                }}
              >
                {[0, 1, 2, 3].map((i) => {
                  const cardDelay = 105 + i * 8;
                  const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 10], [0, 1], {
                    extrapolateRight: 'clamp',
                    extrapolateLeft: 'clamp',
                  });
                  return (
                    <div
                      key={i}
                      style={{
                        backgroundColor: COLORS.bgSubtle,
                        borderRadius: 10,
                        padding: 8,
                        border: `1px solid ${COLORS.border}`,
                        opacity: cardOpacity,
                      }}
                    >
                      <div style={{ aspectRatio: '1', backgroundColor: '#e2e8f0', borderRadius: 8, marginBottom: 8 }} />
                      <div style={{ height: 10, width: '75%', backgroundColor: '#e2e8f0', borderRadius: 4, marginBottom: 4 }} />
                      <div style={{ height: 10, width: '50%', backgroundColor: '#e2e8f0', borderRadius: 4 }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <FeatureCallout text="AES-256 Encrypted Menus" x={1100} y={160} delay={50} />
    </div>
  );
}
