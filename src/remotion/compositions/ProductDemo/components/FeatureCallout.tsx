import React from 'react';
import { COLORS } from '../../../config';
import { useSlideIn } from '../../../utils/animations';

interface FeatureCalloutProps {
  label: string;
  delay?: number;
  position?: { top?: number; right?: number; bottom?: number; left?: number };
  variant?: 'primary' | 'accent';
}

export function FeatureCallout({
  label,
  delay = 0,
  position = {},
  variant = 'primary',
}: FeatureCalloutProps) {
  const style = useSlideIn(delay, 'up', 'bouncy');
  const bg = variant === 'primary' ? COLORS.primary : COLORS.accent;

  return (
    <div
      style={{
        ...style,
        position: 'absolute',
        ...position,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: bg,
          color: '#fff',
          padding: '8px 20px',
          borderRadius: 24,
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.01em',
          boxShadow: `0 4px 20px ${bg}66`,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
    </div>
  );
}
