import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';
import { DashboardMockup } from '../components/DashboardMockup';
import { StatCard } from '../components/StatCard';
import { BarChart } from '../components/BarChart';
import { FeatureCallout } from '../components/FeatureCallout';
import { useSlideIn, useFadeIn } from '../../../utils/animations';

const REVENUE_DATA = [
  { label: 'Mon', value: 12400 },
  { label: 'Tue', value: 18200 },
  { label: 'Wed', value: 15800 },
  { label: 'Thu', value: 22600 },
  { label: 'Fri', value: 28400 },
  { label: 'Sat', value: 32100 },
  { label: 'Sun', value: 24800 },
];

const ACTIVITY_ITEMS = [
  { text: 'New order #4821 received', time: '2m ago', color: COLORS.primary },
  { text: 'Inventory alert: OG Kush low stock', time: '5m ago', color: COLORS.warning },
  { text: 'Driver Marcus completed delivery', time: '8m ago', color: COLORS.accent },
  { text: 'Customer Green Valley signed up', time: '12m ago', color: COLORS.purple },
];

export function DashboardScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleStyle = useSlideIn(5, 'up', 'smooth');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
      {/* Scene title */}
      <div
        style={{
          ...titleStyle,
          position: 'absolute',
          top: 40,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.primary,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Dashboard Overview
        </div>
      </div>

      {/* Dashboard mockup */}
      <DashboardMockup title="dashboard" delay={10}>
        <div style={{ display: 'flex', height: '100%' }}>
          {/* Sidebar */}
          <div
            style={{
              width: 220,
              background: COLORS.background,
              borderRight: `1px solid ${COLORS.border}`,
              padding: '20px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div
              style={{
                padding: '8px 20px',
                fontSize: 20,
                fontWeight: 800,
                color: COLORS.primary,
                fontFamily: 'Inter, sans-serif',
                letterSpacing: '-0.02em',
                marginBottom: 16,
              }}
            >
              FloraIQ
            </div>
            {['Dashboard', 'Orders', 'Inventory', 'Customers', 'Fleet', 'Menus'].map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  color: i === 0 ? COLORS.primary : COLORS.textLight,
                  fontWeight: i === 0 ? 600 : 400,
                  background: i === 0 ? `${COLORS.primary}10` : 'transparent',
                  borderRight: i === 0 ? `2px solid ${COLORS.primary}` : 'none',
                }}
              >
                {item}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div style={{ flex: 1, padding: 28, overflow: 'hidden' }}>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <StatCard label="Revenue (MTD)" value={148200} prefix="$" trend={12.4} delay={20} />
              <StatCard label="Active Orders" value={47} trend={8.2} delay={25} />
              <StatCard label="Customers" value={312} trend={15.1} delay={30} />
              <StatCard label="Avg. Order Value" value={894} prefix="$" trend={3.7} delay={35} />
            </div>

            <div style={{ display: 'flex', gap: 20 }}>
              {/* Revenue chart */}
              <div
                style={{
                  flex: 1,
                  background: COLORS.background,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: COLORS.text,
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 20,
                  }}
                >
                  Weekly Revenue
                </div>
                <BarChart data={REVENUE_DATA} delay={40} height={200} width={520} />
              </div>

              {/* Activity feed */}
              <div
                style={{
                  width: 320,
                  background: COLORS.background,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: COLORS.text,
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 16,
                  }}
                >
                  Recent Activity
                </div>
                {ACTIVITY_ITEMS.map((item, i) => {
                  const itemDelay = 50 + i * 8;
                  const progress = spring({
                    frame: frame - itemDelay,
                    fps,
                    config: SPRING_PRESETS.snappy,
                  });

                  return (
                    <div
                      key={i}
                      style={{
                        opacity: progress,
                        transform: `translateX(${interpolate(progress, [0, 1], [20, 0])}px)`,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 0',
                        borderBottom: i < ACTIVITY_ITEMS.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: item.color,
                          marginTop: 5,
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            color: COLORS.text,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          {item.text}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: COLORS.textMuted,
                            fontFamily: 'Inter, sans-serif',
                            marginTop: 2,
                          }}
                        >
                          {item.time}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DashboardMockup>

      {/* Feature callout */}
      <FeatureCallout
        label="Real-Time Revenue Analytics"
        delay={60}
        position={{ bottom: 60, right: 120 }}
      />
    </div>
  );
}
