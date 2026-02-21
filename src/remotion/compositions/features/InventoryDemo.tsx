/**
 * InventoryDemo — Shows inventory grid with stock levels,
 * barcode scanning animation, and low stock alerts.
 * 10 seconds (300 frames @ 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const PRODUCTS = [
  { name: 'Blue Dream', stock: 142, max: 200, status: 'good' },
  { name: 'OG Kush', stock: 23, max: 100, status: 'low' },
  { name: 'Sour Diesel', stock: 0, max: 50, status: 'out' },
  { name: 'Gummies', stock: 340, max: 400, status: 'good' },
  { name: 'Vape Pen', stock: 8, max: 30, status: 'low' },
  { name: 'Tincture', stock: 65, max: 80, status: 'good' },
];

export function InventoryDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Barcode scan animation (frames 120-180)
  const isScanningPhase = frame >= 120 && frame < 180;
  const scanLineY = interpolate(frame % 60, [0, 30, 60], [0, 100, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Stock update animation after scan
  const stockUpdateProgress = interpolate(frame, [180, 200], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Alert pulse
  const alertPulse = Math.sin(frame * 0.15) * 0.3 + 0.7;

  // Container scale
  const containerScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
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
      {/* Main dashboard */}
      <div
        style={{
          width: '100%',
          maxWidth: 800,
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
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
              Inventory Dashboard
            </div>
            <div style={{ fontSize: 12, color: COLORS.textLight }}>
              Real-time stock levels
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: COLORS.red500 + '15',
                color: COLORS.red500,
                fontSize: 11,
                fontWeight: 700,
                opacity: alertPulse,
              }}
            >
              2 Low Stock
            </div>
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: COLORS.amber500 + '15',
                color: COLORS.amber500,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              1 Out of Stock
            </div>
          </div>
        </div>

        {/* Products grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            padding: 24,
          }}
        >
          {PRODUCTS.map((product, i) => {
            const cardDelay = 20 + i * 12;
            const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 15], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            const cardY = interpolate(frame, [cardDelay, cardDelay + 15], [20, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            // Animate stock for first product after scan
            const displayStock =
              i === 0 && frame > 180
                ? Math.round(interpolate(stockUpdateProgress, [0, 1], [142, 167]))
                : product.stock;

            const stockPercentage = (displayStock / product.max) * 100;
            const statusColor =
              product.status === 'good'
                ? COLORS.primary
                : product.status === 'low'
                  ? COLORS.amber500
                  : COLORS.red500;

            return (
              <div
                key={i}
                style={{
                  padding: 16,
                  backgroundColor: COLORS.bgSubtle,
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                    {product.name}
                  </div>
                  {(product.status === 'low' || product.status === 'out') && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: statusColor,
                        opacity: alertPulse,
                      }}
                    />
                  )}
                </div>

                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: statusColor,
                    marginBottom: 8,
                  }}
                >
                  {displayStock}
                  <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textLight }}>
                    {' '}
                    / {product.max}
                  </span>
                </div>

                {/* Progress bar */}
                <div
                  style={{
                    height: 6,
                    backgroundColor: COLORS.border,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${stockPercentage}%`,
                      height: '100%',
                      backgroundColor: statusColor,
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Barcode scanner overlay */}
        {isScanningPhase && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 200,
              height: 150,
              backgroundColor: 'rgba(0,0,0,0.9)',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: 120,
                height: 80,
                border: `2px solid ${COLORS.primary}`,
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Scan line */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${scanLineY}%`,
                  height: 2,
                  backgroundColor: COLORS.primary,
                  boxShadow: `0 0 8px ${COLORS.primary}`,
                }}
              />
              {/* Barcode */}
              <div
                style={{
                  position: 'absolute',
                  inset: 10,
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                }}
              >
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i % 3 === 0 ? 3 : 1,
                      height: '100%',
                      backgroundColor: 'white',
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              style={{
                color: COLORS.primary,
                fontSize: 11,
                fontWeight: 700,
                marginTop: 12,
                fontFamily: 'monospace',
              }}
            >
              SCANNING...
            </div>
          </div>
        )}

        {/* Stock updated notification */}
        {frame > 200 && frame < 280 && (
          <div
            style={{
              position: 'absolute',
              top: 80,
              right: 20,
              padding: '10px 16px',
              backgroundColor: COLORS.primary,
              color: 'white',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              opacity: interpolate(frame, [200, 210, 270, 280], [0, 1, 1, 0], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              }),
            }}
          >
            +25 units added to Blue Dream
          </div>
        )}
      </div>
    </div>
  );
}
