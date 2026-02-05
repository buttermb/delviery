import React from 'react';
import { COLORS } from '../../../config';
import { useSlideIn, useCountUp } from '../../../utils/animations';

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend?: number;
  delay?: number;
  color?: string;
}

export function StatCard({
  label,
  value,
  prefix = '',
  suffix = '',
  trend,
  delay = 0,
  color = COLORS.primary,
}: StatCardProps) {
  const style = useSlideIn(delay, 'up', 'snappy');
  const count = useCountUp(value, delay + 10, 45);

  return (
    <div
      style={{
        ...style,
        background: COLORS.background,
        borderRadius: 12,
        padding: '20px 24px',
        border: `1px solid ${COLORS.border}`,
        minWidth: 200,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: COLORS.textLight,
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: COLORS.text,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {prefix}{count.toLocaleString()}{suffix}
      </div>
      {trend !== undefined && (
        <div
          style={{
            marginTop: 8,
            fontSize: 13,
            fontWeight: 600,
            color: trend >= 0 ? COLORS.success : COLORS.danger,
            fontFamily: 'Inter, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {trend >= 0 ? '\u2191' : '\u2193'} {Math.abs(trend)}%
          <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>vs last month</span>
        </div>
      )}
    </div>
  );
}
