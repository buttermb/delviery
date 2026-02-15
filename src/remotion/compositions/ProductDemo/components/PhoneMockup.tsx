// @ts-nocheck
import React from 'react';
import { COLORS } from '../../../config';
import { useSlideIn } from '../../../utils/animations';

interface PhoneMockupProps {
  children: React.ReactNode;
  delay?: number;
}

export function PhoneMockup({ children, delay = 0 }: PhoneMockupProps) {
  const style = useSlideIn(delay, 'up', 'smooth');

  return (
    <div
      style={{
        ...style,
        width: 320,
        height: 640,
        borderRadius: 40,
        overflow: 'hidden',
        background: '#1a1a1a',
        padding: 8,
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        position: 'relative',
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 28,
          borderRadius: '0 0 16px 16px',
          background: '#1a1a1a',
          zIndex: 10,
        }}
      />

      {/* Screen */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 32,
          overflow: 'hidden',
          background: COLORS.background,
          position: 'relative',
        }}
      >
        {/* Status bar */}
        <div
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.text,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <span>9:41</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ width: 16, height: 10, borderRadius: 2, border: `1.5px solid ${COLORS.text}`, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 2, borderRadius: 1, background: COLORS.primary }} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
