// @ts-nocheck
/**
 * ROIAnimation — 12-second composition (360 frames @ 30fps).
 * Animated counter ($0 → $24,592 saved/month),
 * bar chart before/after comparison, percentage badge reveal.
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const BAR_DATA = [
  { label: 'Manual Entry', before: 85, after: 12, color: COLORS.red500, afterColor: COLORS.primary },
  { label: 'Order Processing', before: 70, after: 20, color: COLORS.red500, afterColor: COLORS.primary },
  { label: 'Inventory Tracking', before: 60, after: 15, color: COLORS.red500, afterColor: COLORS.primary },
  { label: 'Route Planning', before: 75, after: 25, color: COLORS.red500, afterColor: COLORS.primary },
];

export function ROIAnimation() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Title (0-30)
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Phase 2: Counter animation (30-180)
  const counterValue = interpolate(frame, [30, 170], [0, 24592], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Phase 3: Bar chart (120-280)
  // Phase 4: Percentage badge (280-360)
  const badgeScale = spring({
    frame: frame - 280,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 25,
  });
  const badgeOpacity = interpolate(frame, [280, 290], [0, 1], {
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
        justifyContent: 'center',
        padding: '60px 80px',
        gap: 40,
      }}
    >
      {/* Title */}
      <div
        style={{
          textAlign: 'center',
          opacity: titleOpacity,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Monthly Savings
        </div>
        <div style={{ fontSize: 72, fontWeight: 800, color: COLORS.text }}>
          ${Math.floor(counterValue).toLocaleString()}
        </div>
        <div style={{ fontSize: 18, color: COLORS.textLight, marginTop: 4 }}>
          saved per month with FloraIQ
        </div>
      </div>

      {/* Bar chart comparison */}
      <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {BAR_DATA.map((item, i) => {
          const barStart = 120 + i * 30;
          const beforeWidth = interpolate(frame, [barStart, barStart + 30], [0, item.before], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });
          const afterWidth = interpolate(frame, [barStart + 15, barStart + 45], [0, item.after], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          });

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                {item.label}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Before */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: COLORS.textLight, width: 40, fontWeight: 600 }}>Before</span>
                    <div style={{ flex: 1, height: 16, backgroundColor: `${COLORS.border}`, borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${beforeWidth}%`,
                          height: '100%',
                          backgroundColor: `${item.color}40`,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.textLight, fontFamily: 'monospace', width: 32 }}>
                      {Math.round(beforeWidth)}h
                    </span>
                  </div>
                  {/* After */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: COLORS.textLight, width: 40, fontWeight: 600 }}>After</span>
                    <div style={{ flex: 1, height: 16, backgroundColor: `${COLORS.border}`, borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${afterWidth}%`,
                          height: '100%',
                          backgroundColor: `${item.afterColor}40`,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.primary, fontFamily: 'monospace', fontWeight: 700, width: 32 }}>
                      {Math.round(afterWidth)}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Percentage badge */}
      {frame >= 280 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 32px',
            borderRadius: 20,
            backgroundColor: `${COLORS.primary}10`,
            border: `2px solid ${COLORS.primary}30`,
            opacity: badgeOpacity,
            transform: `scale(${badgeScale})`,
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 800, color: COLORS.primary }}>78%</span>
          <span style={{ fontSize: 16, color: COLORS.text, fontWeight: 600 }}>
            Time Saved on Operations
          </span>
        </div>
      )}
    </div>
  );
}
