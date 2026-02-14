/**
 * DisposableMenusDemo — Shows encrypted menu creation with lock animation,
 * QR code generation, and burn countdown.
 * 10 seconds (300 frames @ 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

export function DisposableMenusDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase: create (0-100), encrypt (100-180), share (180-240), burn (240-300)
  const phase = frame < 100 ? 'create' : frame < 180 ? 'encrypt' : frame < 240 ? 'share' : 'burn';

  // Phone mockup scale
  const phoneScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 20,
  });

  // Lock animation
  const lockScale = spring({
    frame: frame - 100,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 25,
  });

  // QR code reveal
  const qrOpacity = interpolate(frame, [180, 200], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Burn countdown
  const burnProgress = interpolate(frame, [240, 290], [100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Menu items stagger
  const menuItems = ['Blue Dream - $45', 'OG Kush - $52', 'Sour Diesel - $48'];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(${COLORS.border} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          opacity: 0.5,
        }}
      />

      {/* Phone mockup */}
      <div
        style={{
          width: 280,
          height: 500,
          backgroundColor: '#1e293b',
          borderRadius: 36,
          border: '8px solid #334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transform: `scale(${phoneScale})`,
          position: 'relative',
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 80,
            height: 20,
            backgroundColor: '#0f172a',
            borderRadius: 16,
            zIndex: 30,
          }}
        />

        {/* Screen content */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'white',
            paddingTop: 40,
            position: 'relative',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${COLORS.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
              Premium Selection
            </div>
            <div
              style={{
                fontSize: 10,
                color: COLORS.textLight,
                fontFamily: 'monospace',
              }}
            >
              {phase === 'burn' ? `${Math.floor(burnProgress)}s` : 'EXP: 24h'}
            </div>
          </div>

          {/* Menu items */}
          <div style={{ padding: 16 }}>
            {menuItems.map((item, i) => {
              const itemDelay = 20 + i * 15;
              const itemOpacity = interpolate(frame, [itemDelay, itemDelay + 10], [0, 1], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });
              const itemX = interpolate(frame, [itemDelay, itemDelay + 15], [20, 0], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });

              return (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    backgroundColor: COLORS.bgSubtle,
                    borderRadius: 8,
                    marginBottom: 8,
                    opacity: phase === 'burn' ? burnProgress / 100 : itemOpacity,
                    transform: `translateX(${itemX}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      backgroundColor: COLORS.primary + '20',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                      {item.split(' - ')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.primary, fontWeight: 700 }}>
                      {item.split(' - ')[1]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lock overlay during encrypt phase */}
          {phase === 'encrypt' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 20,
              }}
            >
              <div
                style={{
                  fontSize: 48,
                  transform: `scale(${lockScale})`,
                  marginBottom: 16,
                }}
              >
                🔐
              </div>
              <div style={{ color: 'white', fontSize: 12, fontFamily: 'monospace' }}>
                ENCRYPTING...
              </div>
            </div>
          )}

          {/* QR code during share phase */}
          {(phase === 'share' || phase === 'burn') && (
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: qrOpacity,
                backgroundColor: 'white',
                padding: 12,
                borderRadius: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  backgroundColor: COLORS.text,
                  borderRadius: 4,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 2,
                  padding: 4,
                }}
              >
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      backgroundColor: i % 3 === 0 ? 'white' : COLORS.text,
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: COLORS.textLight,
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                Scan to view
              </div>
            </div>
          )}

          {/* Burn effect */}
          {phase === 'burn' && burnProgress < 50 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(to top, rgba(239, 68, 68, ${(50 - burnProgress) / 50}) 0%, transparent 60%)`,
                zIndex: 15,
              }}
            />
          )}
        </div>
      </div>

      {/* Phase indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
        }}
      >
        {['create', 'encrypt', 'share', 'burn'].map((p) => (
          <div
            key={p}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: phase === p ? COLORS.primary : COLORS.bgSubtle,
              color: phase === p ? 'white' : COLORS.textLight,
              border: `1px solid ${phase === p ? COLORS.primary : COLORS.border}`,
            }}
          >
            {p.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
