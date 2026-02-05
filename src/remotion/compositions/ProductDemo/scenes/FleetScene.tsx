import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';
import { DashboardMockup } from '../components/DashboardMockup';
import { MapBackground } from '../components/MapBackground';
import { FeatureCallout } from '../components/FeatureCallout';
import { useSlideIn } from '../../../utils/animations';

const DRIVERS = [
  { name: 'Marcus J.', status: 'En Route', stops: '3/5', eta: '22 min', color: COLORS.primary },
  { name: 'Sarah K.', status: 'Delivering', stops: '1/4', eta: '8 min', color: COLORS.accent },
  { name: 'James W.', status: 'En Route', stops: '4/6', eta: '45 min', color: COLORS.purple },
];

export function FleetScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleStyle = useSlideIn(5, 'up', 'smooth');

  // Route rerouting animation
  const rerouteDelay = 100;
  const rerouteProgress = spring({
    frame: frame - rerouteDelay,
    fps,
    config: SPRING_PRESETS.bouncy,
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
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
            color: COLORS.accent,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Fleet Tracking
        </div>
      </div>

      <DashboardMockup title="fleet" delay={8}>
        <div style={{ display: 'flex', height: '100%' }}>
          {/* Left panel - Driver list */}
          <div
            style={{
              width: 340,
              borderRight: `1px solid ${COLORS.border}`,
              padding: 20,
              background: COLORS.background,
              overflow: 'hidden',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>
              Active Drivers
            </div>
            <div style={{ fontSize: 13, color: COLORS.textLight, fontFamily: 'Inter, sans-serif', marginBottom: 20 }}>
              3 drivers on the road
            </div>

            {DRIVERS.map((driver, i) => {
              const driverDelay = 20 + i * 10;
              const progress = spring({ frame: frame - driverDelay, fps, config: SPRING_PRESETS.snappy });

              return (
                <div
                  key={i}
                  style={{
                    opacity: progress,
                    transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.border}`,
                    marginBottom: 10,
                    background: COLORS.backgroundAlt,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: `${driver.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 15,
                          fontWeight: 700,
                          color: driver.color,
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {driver.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>{driver.name}</div>
                        <div style={{ fontSize: 12, color: driver.color, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>{driver.status}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, color: COLORS.textLight, fontFamily: 'Inter, sans-serif' }}>
                      Stops: <span style={{ fontWeight: 700, color: COLORS.text }}>{driver.stops}</span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textLight, fontFamily: 'Inter, sans-serif' }}>
                      ETA: <span style={{ fontWeight: 700, color: COLORS.text }}>{driver.eta}</span>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: COLORS.surface, marginTop: 10 }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 2,
                        background: driver.color,
                        width: `${(parseInt(driver.stops) / parseInt(driver.stops.split('/')[1])) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right panel - Map */}
          <div style={{ flex: 1, position: 'relative' }}>
            <MapBackground delay={10} />

            {/* Vehicle markers with pulse */}
            {[
              { x: 350, y: 280, label: 'Marcus', color: COLORS.primary },
              { x: 650, y: 180, label: 'Sarah', color: COLORS.accent },
              { x: 500, y: 400, label: 'James', color: COLORS.purple },
            ].map((vehicle, i) => {
              const vDelay = 40 + i * 8;
              const vProgress = spring({ frame: frame - vDelay, fps, config: SPRING_PRESETS.bouncy });
              const pulseScale = 1 + Math.sin((frame - vDelay) * 0.1) * 0.15;

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: vehicle.x,
                    top: vehicle.y,
                    opacity: vProgress,
                    transform: `translate(-50%, -50%) scale(${interpolate(vProgress, [0, 1], [0, 1])})`,
                    zIndex: 10,
                  }}
                >
                  {/* Pulse ring */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: -12,
                      borderRadius: '50%',
                      background: `${vehicle.color}15`,
                      transform: `scale(${pulseScale})`,
                    }}
                  />
                  {/* Marker */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: vehicle.color,
                      border: '3px solid #fff',
                      boxShadow: `0 2px 8px ${vehicle.color}60`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {vehicle.label.charAt(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DashboardMockup>

      {/* Reroute notification */}
      {frame >= rerouteDelay && (
        <div
          style={{
            position: 'absolute',
            top: 130,
            right: 130,
            opacity: rerouteProgress,
            transform: `translateY(${interpolate(rerouteProgress, [0, 1], [-15, 0])}px)`,
            background: `linear-gradient(135deg, #1e293b, #0f172a)`,
            borderRadius: 14,
            padding: '14px 20px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.accent}40`,
            zIndex: 30,
            maxWidth: 280,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 14 }}>&#128679;</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
              Traffic Alert
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            Route optimized for Marcus. Saved <span style={{ color: COLORS.primary, fontWeight: 700 }}>12 minutes</span> via alternate route.
          </div>
        </div>
      )}

      <FeatureCallout
        label="Real-Time GPS + Smart Routing"
        delay={55}
        position={{ bottom: 60, left: 120 }}
        variant="accent"
      />
    </div>
  );
}
