/**
 * Reusable chrome frame with header bar and sidebar placeholder.
 */

import type { ReactNode } from 'react';
import { COLORS } from '@/remotion/config';

interface DashboardMockupProps {
  children: ReactNode;
  title?: string;
}

export function DashboardMockup({ children, title = 'FloraIQ' }: DashboardMockupProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: COLORS.bgSubtle,
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          height: 48,
          backgroundColor: 'white',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
        }}
      >
        {/* Traffic light dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f87171' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fbbf24' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#34d399' }} />
        </div>
        {/* Title */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: COLORS.bgSubtle,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 6,
              padding: '4px 16px',
              fontSize: 12,
              color: COLORS.textLight,
              fontFamily: 'monospace',
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ width: 52 }} />
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div
          style={{
            width: 56,
            backgroundColor: 'white',
            borderRight: `1px solid ${COLORS.border}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
            gap: 16,
          }}
        >
          {[COLORS.primary, COLORS.textLight, COLORS.textLight, COLORS.textLight].map(
            (color, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: i === 0 ? `${color}15` : 'transparent',
                  border: i === 0 ? `1px solid ${color}30` : 'none',
                }}
              />
            ),
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}
