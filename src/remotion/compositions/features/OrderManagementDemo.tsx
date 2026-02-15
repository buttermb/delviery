// @ts-nocheck
/**
 * OrderManagementDemo — Shows order pipeline/kanban,
 * approval workflow, and delivery tracking.
 * 10 seconds (300 frames @ 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const COLUMNS = [
  { title: 'New', color: COLORS.blue500 },
  { title: 'Approved', color: COLORS.amber500 },
  { title: 'Shipped', color: COLORS.purple500 },
  { title: 'Delivered', color: COLORS.primary },
];

const ORDERS = [
  { id: 'ORD-001', customer: 'Green Valley', amount: '$1,240', column: 0 },
  { id: 'ORD-002', customer: 'Sunset Dispensary', amount: '$890', column: 1 },
  { id: 'ORD-003', customer: 'Mountain High', amount: '$2,100', column: 2 },
  { id: 'ORD-004', customer: 'City Greens', amount: '$560', column: 3 },
];

export function OrderManagementDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Move first order through pipeline
  const order1Column = frame < 80 ? 0 : frame < 160 ? 1 : frame < 240 ? 2 : 3;

  // Container animation
  const containerScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 20,
  });

  // Approval animation (frames 80-100)
  const showApprovalStamp = frame >= 80 && frame < 120;
  const stampScale = spring({
    frame: frame - 80,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 20,
  });

  // Delivery confirmation (frames 240-280)
  const showDelivered = frame >= 240;
  const checkScale = spring({
    frame: frame - 240,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 20,
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        padding: 40,
      }}
    >
      {/* Kanban board */}
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          backgroundColor: 'white',
          borderRadius: 16,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          transform: `scale(${containerScale})`,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
            Order Pipeline
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight }}>
            4 orders in progress
          </div>
        </div>

        {/* Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            padding: 24,
            minHeight: 300,
          }}
        >
          {COLUMNS.map((col, colIndex) => {
            const colDelay = 10 + colIndex * 8;
            const colOpacity = interpolate(frame, [colDelay, colDelay + 15], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            // Get orders for this column
            const columnOrders = ORDERS.filter((o, i) => {
              if (i === 0) return order1Column === colIndex;
              return o.column === colIndex;
            });

            return (
              <div
                key={colIndex}
                style={{
                  backgroundColor: COLORS.bgSubtle,
                  borderRadius: 12,
                  padding: 12,
                  opacity: colOpacity,
                }}
              >
                {/* Column header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottom: `2px solid ${col.color}`,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: col.color,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>
                    {col.title}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      color: COLORS.textLight,
                      backgroundColor: 'white',
                      padding: '2px 6px',
                      borderRadius: 10,
                    }}
                  >
                    {columnOrders.length}
                  </span>
                </div>

                {/* Order cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {columnOrders.map((order) => {
                    const isMovingOrder = order.id === 'ORD-001';
                    const cardScale = isMovingOrder
                      ? spring({
                          frame: frame - (colIndex === order1Column ? colIndex * 80 : 0),
                          fps,
                          config: SPRING_PRESETS.snappy,
                          durationInFrames: 15,
                        })
                      : 1;

                    return (
                      <div
                        key={order.id}
                        style={{
                          padding: 10,
                          backgroundColor: 'white',
                          borderRadius: 8,
                          border: `1px solid ${COLORS.border}`,
                          transform: `scale(${cardScale})`,
                          boxShadow: isMovingOrder
                            ? '0 4px 12px rgba(0,0,0,0.1)'
                            : 'none',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: col.color,
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            marginBottom: 4,
                          }}
                        >
                          {order.id}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: COLORS.text,
                            marginBottom: 4,
                          }}
                        >
                          {order.customer}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>
                          {order.amount}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Approval stamp overlay */}
      {showApprovalStamp && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${stampScale}) rotate(-15deg)`,
            padding: '16px 32px',
            border: `4px solid ${COLORS.primary}`,
            borderRadius: 8,
            backgroundColor: 'white',
            zIndex: 30,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: COLORS.primary,
              letterSpacing: 4,
            }}
          >
            APPROVED
          </div>
        </div>
      )}

      {/* Delivered checkmark overlay */}
      {showDelivered && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${checkScale})`,
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: COLORS.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30,
            boxShadow: `0 0 40px ${COLORS.primary}40`,
            opacity: interpolate(frame, [240, 250, 280, 300], [0, 1, 1, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            }),
          }}
        >
          <span style={{ fontSize: 40, color: 'white' }}>✓</span>
        </div>
      )}
    </div>
  );
}
