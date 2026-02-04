/**
 * Scene 4: Fleet — Map with driver dot tracing a route path.
 * Frames 0–180 within its Sequence (6 seconds at 30fps)
 */

import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '@/remotion/config';
import { FeatureCallout } from '@/remotion/compositions/ProductDemo/components/FeatureCallout';

export function FleetScene() {
  const frame = useCurrentFrame();

  // Route progress (driver moving along path)
  const routeProgress = interpolate(frame, [10, 140], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Rerouting event: shows between frames 70–110
  const isRerouting = frame >= 70 && frame < 110;

  // After reroute, show optimized path
  const showOptimized = frame >= 110;

  // Alert opacity
  const alertOpacity = interpolate(
    frame,
    [70, 75, 105, 110],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  // Driver card position interpolation
  const driverTop = interpolate(
    frame,
    [10, 80, 120, 160],
    [75, 55, 35, 22],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );
  const driverLeft = interpolate(
    frame,
    [10, 80, 120, 160],
    [12, 40, 55, 65],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' },
  );

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
      {/* Grid map background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}>
        <defs>
          <pattern id="grid-pattern" width="100" height="50" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="100" y1="0" x2="100" y2="50" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        {/* Park area */}
        <rect x="0" y="0" width="40%" height="45%" fill="#dcfce7" />
        <text x="5%" y="40%" fill="#059669" fontSize="18" fontWeight="bold" opacity="0.5">
          CENTRAL PARK
        </text>
      </svg>

      {/* Street labels */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', fontSize: 12, fontFamily: 'monospace', color: COLORS.textLight, fontWeight: 700, opacity: 0.4 }}>
        <span style={{ position: 'absolute', top: '50%', left: '20%' }}>W 42nd St</span>
        <span style={{ position: 'absolute', top: '60%', left: '50%' }}>5th Ave</span>
        <span style={{ position: 'absolute', top: '80%', right: '20%' }}>Broadway</span>
      </div>

      {/* Routes SVG */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 800 450"
        preserveAspectRatio="none"
      >
        {/* Original route (fades during reroute) */}
        <path
          d="M100,450 L100,250 L400,250 L400,100 L600,100"
          fill="none"
          stroke={COLORS.blue500}
          strokeWidth="4"
          opacity={showOptimized ? 0 : 0.5}
          strokeDasharray="800"
          strokeDashoffset={800 - 800 * routeProgress}
        />

        {/* Traffic block indicator */}
        {isRerouting && (
          <path
            d="M200,250 L350,250"
            fill="none"
            stroke={COLORS.red500}
            strokeWidth="6"
            strokeDasharray="200"
            strokeDashoffset={interpolate(frame, [70, 85], [200, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            })}
          />
        )}

        {/* Optimized route */}
        {showOptimized && (
          <path
            d="M100,450 L100,350 L500,350 L500,100 L600,100"
            fill="none"
            stroke={COLORS.primary}
            strokeWidth="4"
            strokeDasharray="900"
            strokeDashoffset={interpolate(frame, [110, 150], [900, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            })}
          />
        )}
      </svg>

      {/* Destination pulse */}
      <div style={{ position: 'absolute', top: '22%', right: '25%', pointerEvents: 'none' }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: COLORS.primary,
            border: '3px solid white',
            boxShadow: `0 0 ${12 + 8 * Math.sin(frame * 0.15)}px ${COLORS.primary}60`,
          }}
        />
      </div>

      {/* Driver card */}
      <div
        style={{
          position: 'absolute',
          top: `${driverTop}%`,
          left: `${driverLeft}%`,
          backgroundColor: 'white',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          width: 180,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isRerouting ? COLORS.red500 : showOptimized ? COLORS.primary : COLORS.blue500,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>Mike R.</span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              backgroundColor: COLORS.bgSubtle,
              padding: '1px 6px',
              borderRadius: 4,
              color: COLORS.textLight,
              fontFamily: 'monospace',
            }}
          >
            D-1
          </span>
        </div>
        <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, fontSize: 10, fontFamily: 'monospace' }}>
          {isRerouting ? (
            <span style={{ color: COLORS.red500 }}>TRAFFIC on 42nd ST</span>
          ) : showOptimized ? (
            <span style={{ color: COLORS.primary, fontWeight: 700 }}>REROUTED VIA 34th</span>
          ) : (
            <span style={{ color: COLORS.blue500 }}>Heading North</span>
          )}
        </div>
      </div>

      {/* Traffic alert overlay */}
      {alertOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#fef2f2',
            border: `1px solid ${COLORS.red500}30`,
            color: COLORS.red500,
            padding: '8px 20px',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 40,
            opacity: alertOpacity,
          }}
        >
          AVOID DELAY (+12m)
        </div>
      )}

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          backgroundColor: 'white',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          padding: '10px 16px',
          fontSize: 12,
          color: COLORS.text,
          fontFamily: 'monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          opacity: interpolate(frame, [0, 10], [0, 1], {
            extrapolateRight: 'clamp',
            extrapolateLeft: 'clamp',
          }),
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 2 }}>FLEET TRACKER</div>
        <div style={{ color: COLORS.textLight }}>Real-time GPS Optimization</div>
      </div>

      <FeatureCallout text="AI Route Optimization" x={1400} y={80} delay={40} />
    </div>
  );
}
