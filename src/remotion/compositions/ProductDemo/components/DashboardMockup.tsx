import React from 'react';
import { COLORS } from '../../../config';
import { useSlideIn } from '../../../utils/animations';

interface DashboardMockupProps {
  children: React.ReactNode;
  title?: string;
  delay?: number;
}

export function DashboardMockup({ children, title = 'FloraIQ Dashboard', delay = 0 }: DashboardMockupProps) {
  const style = useSlideIn(delay, 'up', 'smooth');

  return (
    <div
      style={{
        ...style,
        width: 1680,
        height: 900,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 25px 80px rgba(0,0,0,0.3)',
        border: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: `${style.transform} translate(-50%, -50%)`,
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 44,
          background: COLORS.surface,
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
        </div>
        <div
          style={{
            flex: 1,
            height: 28,
            borderRadius: 6,
            background: COLORS.background,
            border: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            color: COLORS.textLight,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          floraiqcrm.com/{title.toLowerCase().replace(/\s+/g, '-')}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          background: COLORS.backgroundAlt,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}
