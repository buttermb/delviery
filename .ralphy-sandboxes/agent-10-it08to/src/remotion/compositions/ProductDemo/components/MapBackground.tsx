import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';

interface MapBackgroundProps {
  delay?: number;
}

export function MapBackground({ delay = 0 }: MapBackgroundProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = spring({
    frame: frame - delay,
    fps,
    config: SPRING_PRESETS.gentle,
  });

  // Grid lines
  const gridLines = [];
  for (let i = 0; i < 20; i++) {
    gridLines.push(
      <line
        key={`h${i}`}
        x1="0"
        y1={`${i * 5}%`}
        x2="100%"
        y2={`${i * 5}%`}
        stroke={COLORS.border}
        strokeWidth="1"
        opacity={0.4}
      />,
      <line
        key={`v${i}`}
        x1={`${i * 5}%`}
        y1="0"
        x2={`${i * 5}%`}
        y2="100%"
        stroke={COLORS.border}
        strokeWidth="1"
        opacity={0.4}
      />
    );
  }

  // Delivery routes
  const routes = [
    { path: 'M200,400 C400,300 600,350 800,200', color: COLORS.primary },
    { path: 'M300,500 C450,400 650,450 900,300', color: COLORS.accent },
    { path: 'M150,300 C350,250 500,200 750,150', color: COLORS.purple },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fadeIn,
        background: `linear-gradient(135deg, ${COLORS.backgroundAlt}, ${COLORS.surface})`,
      }}
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {gridLines}
        {routes.map((route, i) => {
          const routeDelay = delay + 15 + i * 10;
          const routeProgress = spring({
            frame: frame - routeDelay,
            fps,
            config: SPRING_PRESETS.smooth,
          });

          return (
            <path
              key={i}
              d={route.path}
              fill="none"
              stroke={route.color}
              strokeWidth="3"
              strokeDasharray="1200"
              strokeDashoffset={interpolate(routeProgress, [0, 1], [1200, 0])}
              strokeLinecap="round"
              opacity={0.8}
            />
          );
        })}

        {/* Location pins */}
        {[
          { cx: 200, cy: 400, d: 10 },
          { cx: 800, cy: 200, d: 20 },
          { cx: 900, cy: 300, d: 30 },
          { cx: 750, cy: 150, d: 40 },
        ].map((pin, i) => {
          const pinProgress = spring({
            frame: frame - delay - 25 - i * 8,
            fps,
            config: SPRING_PRESETS.bouncy,
          });

          return (
            <g key={i} opacity={pinProgress}>
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r={interpolate(pinProgress, [0, 1], [0, 8])}
                fill={COLORS.primary}
              />
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r={interpolate(pinProgress, [0, 1], [0, 16])}
                fill="none"
                stroke={COLORS.primary}
                strokeWidth="2"
                opacity={0.3}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
