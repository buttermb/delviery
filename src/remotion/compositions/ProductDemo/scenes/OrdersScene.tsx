import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';
import { DashboardMockup } from '../components/DashboardMockup';
import { OrderCard } from '../components/OrderCard';
import { FeatureCallout } from '../components/FeatureCallout';
import { useSlideIn } from '../../../utils/animations';

const COLUMNS = [
  {
    title: 'Pending',
    color: '#f59e0b',
    orders: [
      { id: '4821', customer: 'Green Valley Dispensary', amount: '$2,480', status: 'pending' as const },
      { id: '4820', customer: 'Sunset Wellness', amount: '$1,890', status: 'pending' as const },
    ],
  },
  {
    title: 'Processing',
    color: '#3b82f6',
    orders: [
      { id: '4819', customer: 'Peak Cannabis Co', amount: '$3,200', status: 'processing' as const },
      { id: '4817', customer: 'Mountain Meds', amount: '$1,650', status: 'processing' as const },
    ],
  },
  {
    title: 'Shipped',
    color: '#8b5cf6',
    orders: [
      { id: '4815', customer: 'Urban Leaf', amount: '$4,100', status: 'shipped' as const },
    ],
  },
  {
    title: 'Delivered',
    color: '#10B981',
    orders: [
      { id: '4812', customer: 'Coastal Herbs', amount: '$2,750', status: 'delivered' as const },
      { id: '4810', customer: 'Valley Green', amount: '$1,920', status: 'delivered' as const },
    ],
  },
];

export function OrdersScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleStyle = useSlideIn(5, 'up', 'smooth');

  // Toast notification animation
  const toastDelay = 90;
  const toastProgress = spring({
    frame: frame - toastDelay,
    fps,
    config: SPRING_PRESETS.bouncy,
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f172a' }}>
      {/* Scene title */}
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
            marginBottom: 4,
          }}
        >
          Order Pipeline
        </div>
      </div>

      <DashboardMockup title="orders" delay={8}>
        <div style={{ padding: 28 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
                Orders Pipeline
              </div>
              <div style={{ fontSize: 14, color: COLORS.textLight, fontFamily: 'Inter, sans-serif', marginTop: 4 }}>
                7 active orders &middot; $17,990 total value
              </div>
            </div>
            <div
              style={{
                background: COLORS.primary,
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              + New Order
            </div>
          </div>

          {/* Kanban board */}
          <div style={{ display: 'flex', gap: 16 }}>
            {COLUMNS.map((col, colIdx) => {
              const colDelay = 15 + colIdx * 8;
              const colProgress = spring({
                frame: frame - colDelay,
                fps,
                config: SPRING_PRESETS.smooth,
              });

              return (
                <div
                  key={colIdx}
                  style={{
                    flex: 1,
                    opacity: colProgress,
                    transform: `translateY(${interpolate(colProgress, [0, 1], [30, 0])}px)`,
                  }}
                >
                  {/* Column header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: `${col.color}10`,
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLORS.text,
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      {col.title}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: COLORS.textMuted,
                        fontFamily: 'Inter, sans-serif',
                        marginLeft: 'auto',
                      }}
                    >
                      {col.orders.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.orders.map((order, orderIdx) => (
                      <OrderCard
                        key={order.id}
                        orderId={order.id}
                        customer={order.customer}
                        amount={order.amount}
                        status={order.status}
                        delay={colDelay + 10 + orderIdx * 6}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DashboardMockup>

      {/* Toast notification */}
      {frame >= toastDelay && (
        <div
          style={{
            position: 'absolute',
            top: 120,
            right: 140,
            opacity: toastProgress,
            transform: `translateX(${interpolate(toastProgress, [0, 1], [40, 0])}px)`,
            background: COLORS.background,
            borderRadius: 12,
            padding: '14px 20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            border: `1px solid ${COLORS.primary}40`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 30,
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${COLORS.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 16 }}>&#10003;</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
              Order #4821 confirmed
            </div>
            <div style={{ fontSize: 11, color: COLORS.textLight, fontFamily: 'Inter, sans-serif' }}>
              Moved to Processing
            </div>
          </div>
        </div>
      )}

      <FeatureCallout
        label="Drag & Drop Order Management"
        delay={55}
        position={{ bottom: 60, left: 120 }}
        variant="accent"
      />
    </div>
  );
}
