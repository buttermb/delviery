/**
 * Scene 1: Dashboard — Stats grid + revenue chart bars animate in.
 * Frames 0–180 (6 seconds at 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';
import { DashboardMockup } from '@/remotion/compositions/ProductDemo/components/DashboardMockup';
import { FeatureCallout } from '@/remotion/compositions/ProductDemo/components/FeatureCallout';

const STATS = [
  { label: 'Total Revenue', value: '$24,592', trend: '+12.5%', color: COLORS.primary },
  { label: 'Active Orders', value: '148', trend: '+4.2%', color: COLORS.blue500 },
  { label: 'Pending Delivery', value: '32', trend: '-1.1%', color: COLORS.amber500 },
  { label: 'Avg Order Value', value: '$165.20', trend: '+8.4%', color: COLORS.purple500 },
];

const CHART_HEIGHTS = [40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95];

export function DashboardScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <DashboardMockup title="floraiq.com/admin/dashboard">
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STATS.map((stat, i) => {
            const delay = i * 6;
            const scale = spring({ frame: frame - delay, fps, config: SPRING_PRESETS.snappy, durationInFrames: 20 });
            const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            return (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  padding: 20,
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                <div style={{ fontSize: 10, color: COLORS.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>
                  {stat.trend}
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue Chart */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 12,
            border: `1px solid ${COLORS.border}`,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 16 }}>
            Revenue Overview
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              paddingBottom: 8,
            }}
          >
            {CHART_HEIGHTS.map((h, i) => {
              const barDelay = 30 + i * 3;
              const barHeight = interpolate(frame, [barDelay, barDelay + 20], [0, h], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${barHeight}%`,
                    backgroundColor: `${COLORS.primary}30`,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <FeatureCallout text="Real-time Revenue Analytics" x={200} y={120} delay={50} />
    </DashboardMockup>
  );
}
