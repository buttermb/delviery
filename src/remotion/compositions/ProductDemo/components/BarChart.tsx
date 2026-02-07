import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';

interface BarChartProps {
  data: { label: string; value: number }[];
  delay?: number;
  height?: number;
  width?: number;
}

export function BarChart({ data, delay = 0, height = 240, width = 600 }: BarChartProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxVal = Math.max(...data.map((d) => d.value));
  const barWidth = (width - (data.length - 1) * 12) / data.length;

  return (
    <div style={{ width, height, position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
      {data.map((item, i) => {
        const barDelay = delay + i * 5;
        const progress = spring({
          frame: frame - barDelay,
          fps,
          config: SPRING_PRESETS.snappy,
        });

        const barHeight = interpolate(progress, [0, 1], [0, (item.value / maxVal) * (height - 30)]);

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: barWidth }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.text,
                fontFamily: 'Inter, sans-serif',
                opacity: progress,
              }}
            >
              ${(item.value / 1000).toFixed(0)}k
            </div>
            <div
              style={{
                width: barWidth,
                height: barHeight,
                borderRadius: '6px 6px 4px 4px',
                background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
                boxShadow: `0 2px 8px ${COLORS.primary}40`,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                fontFamily: 'Inter, sans-serif',
                opacity: progress,
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
