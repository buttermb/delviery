/**
 * AnalyticsDemo — Shows dashboard with animated charts,
 * metrics counters, and report generation.
 * 10 seconds (300 frames @ 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const CHART_DATA = [35, 45, 30, 60, 75, 55, 80, 70, 90, 65, 85, 95];
const METRICS = [
  { label: 'Revenue', value: 124592, prefix: '$', suffix: '' },
  { label: 'Orders', value: 847, prefix: '', suffix: '' },
  { label: 'Customers', value: 234, prefix: '', suffix: '' },
  { label: 'Avg Order', value: 147, prefix: '$', suffix: '' },
];

export function AnalyticsDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Container animation
  const containerScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 20,
  });

  // Counter animation
  const counterProgress = interpolate(frame, [30, 120], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Chart bar animation
  const chartProgress = interpolate(frame, [80, 180], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Line chart drawing
  const lineProgress = interpolate(frame, [120, 220], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Export animation
  const showExport = frame >= 250;
  const exportScale = spring({
    frame: frame - 250,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 20,
  });

  // Generate SVG path for line chart
  const linePoints = CHART_DATA.map((val, i) => {
    const x = (i / (CHART_DATA.length - 1)) * 100;
    const y = 100 - val;
    return `${x},${y}`;
  }).join(' ');

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
        padding: 40,
      }}
    >
      {/* Dashboard container */}
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          backgroundColor: 'white',
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          transform: `scale(${containerScale})`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>Analytics Dashboard</div>
            <div style={{ fontSize: 12, color: COLORS.textLight }}>Last 30 days</div>
          </div>
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: COLORS.bgSubtle,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.text,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>📊</span>
            Export Report
          </div>
        </div>

        {/* Metrics row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            padding: '24px 24px 0',
          }}
        >
          {METRICS.map((metric, i) => {
            const cardDelay = 15 + i * 10;
            const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 15], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            const displayValue = Math.round(metric.value * counterProgress);

            return (
              <div
                key={i}
                style={{
                  padding: 16,
                  backgroundColor: COLORS.bgSubtle,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  opacity: cardOpacity,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.textLight,
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {metric.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.text }}>
                  {metric.prefix}
                  {displayValue.toLocaleString()}
                  {metric.suffix}
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            padding: 24,
          }}
        >
          {/* Bar chart */}
          <div
            style={{
              padding: 16,
              backgroundColor: COLORS.bgSubtle,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 16 }}>
              Monthly Revenue
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
              {CHART_DATA.map((val, i) => {
                const barDelay = i * 4;
                const barHeight = interpolate(chartProgress, [barDelay / 48, (barDelay + 8) / 48], [0, val], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                });

                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${barHeight}%`,
                      backgroundColor: i === CHART_DATA.length - 1 ? COLORS.primary : COLORS.primary + '60',
                      borderRadius: 4,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Line chart */}
          <div
            style={{
              padding: 16,
              backgroundColor: COLORS.bgSubtle,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 16 }}>
              Order Trend
            </div>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: 120 }} preserveAspectRatio="none">
              {/* Grid lines */}
              {[25, 50, 75].map((y) => (
                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={COLORS.border} strokeWidth="0.5" />
              ))}

              {/* Line path */}
              <polyline
                points={linePoints}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="300"
                strokeDashoffset={300 - 300 * lineProgress}
              />

              {/* Dots */}
              {CHART_DATA.map((val, i) => {
                const x = (i / (CHART_DATA.length - 1)) * 100;
                const y = 100 - val;
                const dotOpacity = interpolate(lineProgress, [(i * 0.8) / 12, (i * 0.8 + 1) / 12], [0, 1], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                });

                return <circle key={i} cx={x} cy={y} r="2" fill={COLORS.primary} opacity={dotOpacity} />;
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Export notification */}
      {showExport && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${exportScale})`,
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            textAlign: 'center',
            zIndex: 30,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
            Report Generated
          </div>
          <div style={{ fontSize: 11, color: COLORS.textLight }}>analytics_report_2024.pdf</div>
        </div>
      )}
    </div>
  );
}
