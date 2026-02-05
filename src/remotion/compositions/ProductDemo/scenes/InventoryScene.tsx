import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';
import { DashboardMockup } from '../components/DashboardMockup';
import { FeatureCallout } from '../components/FeatureCallout';
import { useSlideIn, useCountUp } from '../../../utils/animations';

const INVENTORY_ITEMS = [
  { name: 'Blue Dream', category: 'Flower', stock: 84, unit: 'lbs', status: 'good', forecast: 'Stable' },
  { name: 'OG Kush', category: 'Flower', stock: 12, unit: 'lbs', status: 'low', forecast: 'Reorder in 3 days' },
  { name: 'Sour Diesel Cart', category: 'Vape', stock: 240, unit: 'units', status: 'good', forecast: 'High demand +18%' },
  { name: 'Indica Gummies', category: 'Edible', stock: 156, unit: 'packs', status: 'good', forecast: 'Stable' },
  { name: 'Jack Herer', category: 'Flower', stock: 8, unit: 'lbs', status: 'critical', forecast: 'Out in 24h' },
  { name: 'Mango Haze Pre-Roll', category: 'Pre-Roll', stock: 320, unit: 'units', status: 'good', forecast: 'Trending up' },
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  good: { bg: '#d1fae5', text: '#065f46', label: 'In Stock' },
  low: { bg: '#fef3c7', text: '#92400e', label: 'Low Stock' },
  critical: { bg: '#fee2e2', text: '#991b1b', label: 'Critical' },
};

export function InventoryScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleStyle = useSlideIn(5, 'up', 'smooth');

  // AI alert animation
  const alertDelay = 80;
  const alertProgress = spring({
    frame: frame - alertDelay,
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
            color: COLORS.primary,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Inventory Intelligence
        </div>
      </div>

      <DashboardMockup title="inventory" delay={8}>
        <div style={{ padding: 28 }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
                Inventory Management
              </div>
              <div style={{ fontSize: 14, color: COLORS.textLight, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                820 SKUs tracked &middot; 2 items need attention
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ background: COLORS.surface, color: COLORS.text, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'Inter, sans-serif', border: `1px solid ${COLORS.border}` }}>
                Export CSV
              </div>
              <div style={{ background: COLORS.primary, color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                + Add Product
              </div>
            </div>
          </div>

          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total SKUs', value: 820, color: COLORS.primary },
              { label: 'Low Stock Alerts', value: 2, color: COLORS.warning },
              { label: 'Forecasted Demand', value: 94, suffix: '%', color: COLORS.accent },
              { label: 'Inventory Value', value: 284, prefix: '$', suffix: 'k', color: COLORS.purple },
            ].map((stat, i) => {
              const cardDelay = 18 + i * 5;
              const progress = spring({ frame: frame - cardDelay, fps, config: SPRING_PRESETS.snappy });
              const count = useCountUp(stat.value, cardDelay + 5, 40);

              return (
                <div
                  key={i}
                  style={{
                    opacity: progress,
                    transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
                    flex: 1,
                    background: COLORS.background,
                    borderRadius: 10,
                    padding: '14px 16px',
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div style={{ fontSize: 12, color: COLORS.textLight, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>{stat.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                    {stat.prefix || ''}{count}{stat.suffix || ''}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inventory table */}
          <div style={{ background: COLORS.background, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'flex', padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.backgroundAlt }}>
              {['Product', 'Category', 'Stock', 'Status', 'AI Forecast'].map((col, i) => (
                <div key={i} style={{ flex: i === 0 ? 2 : 1, fontSize: 12, fontWeight: 700, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {col}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {INVENTORY_ITEMS.map((item, i) => {
              const rowDelay = 30 + i * 6;
              const progress = spring({ frame: frame - rowDelay, fps, config: SPRING_PRESETS.snappy });
              const statusStyle = STATUS_STYLES[item.status];

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    padding: '14px 20px',
                    borderBottom: i < INVENTORY_ITEMS.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
                    alignItems: 'center',
                    opacity: progress,
                    transform: `translateX(${interpolate(progress, [0, 1], [-20, 0])}px)`,
                    background: item.status === 'critical' ? '#fef2f210' : 'transparent',
                  }}
                >
                  <div style={{ flex: 2, fontSize: 14, fontWeight: 600, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>{item.name}</div>
                  <div style={{ flex: 1, fontSize: 13, color: COLORS.textLight, fontFamily: 'Inter, sans-serif' }}>{item.category}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>{item.stock} {item.unit}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusStyle.text, background: statusStyle.bg, padding: '3px 10px', borderRadius: 12, fontFamily: 'Inter, sans-serif' }}>
                      {statusStyle.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: item.status !== 'good' ? COLORS.warning : COLORS.textLight, fontFamily: 'Inter, sans-serif', fontWeight: item.status !== 'good' ? 600 : 400 }}>
                    {item.forecast}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DashboardMockup>

      {/* AI Alert popup */}
      {frame >= alertDelay && (
        <div
          style={{
            position: 'absolute',
            top: 130,
            right: 130,
            opacity: alertProgress,
            transform: `scale(${interpolate(alertProgress, [0, 1], [0.9, 1])}) translateY(${interpolate(alertProgress, [0, 1], [-10, 0])}px)`,
            background: `linear-gradient(135deg, #1e293b, #0f172a)`,
            borderRadius: 14,
            padding: '16px 22px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.primary}40`,
            zIndex: 30,
            maxWidth: 300,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: `${COLORS.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              &#9889;
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
              AI Prediction
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            OG Kush will be out of stock in <span style={{ color: COLORS.warning, fontWeight: 700 }}>3 days</span> based on current demand. Auto-reorder suggested.
          </div>
        </div>
      )}

      <FeatureCallout
        label="AI-Powered Demand Forecasting"
        delay={55}
        position={{ bottom: 60, right: 120 }}
      />
    </div>
  );
}
