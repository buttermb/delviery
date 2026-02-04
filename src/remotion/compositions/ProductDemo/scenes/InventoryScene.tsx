/**
 * Scene 3: Inventory — Table rows + predictive SVG line chart.
 * Frames 0–180 within its Sequence (6 seconds at 30fps)
 */

import { useCurrentFrame, interpolate } from 'remotion';
import { COLORS } from '@/remotion/config';
import { DashboardMockup } from '@/remotion/compositions/ProductDemo/components/DashboardMockup';
import { FeatureCallout } from '@/remotion/compositions/ProductDemo/components/FeatureCallout';

const PRODUCTS = [
  { name: 'Blue Dream', category: 'Flower', stock: 142, status: 'Ideal', statusColor: COLORS.primary },
  { name: 'OG Kush', category: 'Flower', stock: 85, status: 'Good', statusColor: COLORS.primary },
  { name: 'Sour Diesel', category: 'Extract', stock: 12, status: 'Low Stock', statusColor: COLORS.amber500 },
  { name: 'Gummies', category: 'Edible', stock: 340, status: 'Overstock', statusColor: COLORS.purple500 },
  { name: 'Vape Pen', category: 'Accessory', stock: 0, status: 'Out of Stock', statusColor: COLORS.red500 },
];

const CHART_VALUES = [30, 45, 35, 60, 50, 75, 65, 90, 80, 55, 40, 60];

export function InventoryScene() {
  const frame = useCurrentFrame();

  // SVG line path progress
  const lineProgress = interpolate(frame, [60, 140], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <DashboardMockup title="floraiq.com/admin/inventory">
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Inventory Analytics</div>
            <div style={{ fontSize: 11, color: COLORS.textLight }}>Warehouse A &bull; 1,240 SKUs</div>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Table */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr',
                padding: '10px 16px',
                backgroundColor: COLORS.bgSubtle,
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 10,
                fontWeight: 700,
                color: COLORS.textLight,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              <span>Product</span>
              <span style={{ textAlign: 'right' }}>Stock</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>

            {/* Rows */}
            {PRODUCTS.map((product, i) => {
              const rowDelay = i * 8;
              const rowOpacity = interpolate(frame, [rowDelay, rowDelay + 12], [0, 1], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });
              const rowX = interpolate(frame, [rowDelay, rowDelay + 12], [-20, 0], {
                extrapolateRight: 'clamp',
                extrapolateLeft: 'clamp',
              });

              return (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${COLORS.bgSubtle}`,
                    opacity: rowOpacity,
                    transform: `translateX(${rowX}px)`,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{product.name}</div>
                    <div style={{ fontSize: 10, color: COLORS.textLight }}>{product.category}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: COLORS.text, fontFamily: 'monospace' }}>
                    {product.stock}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                        color: product.statusColor,
                        backgroundColor: `${product.statusColor}15`,
                        border: `1px solid ${product.statusColor}25`,
                      }}
                    >
                      {product.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Demand Forecast Chart */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 12 }}>
              Demand Forecast
            </div>

            {/* Bar chart */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 4, position: 'relative' }}>
              {CHART_VALUES.map((h, i) => {
                const barDelay = 40 + i * 4;
                const barHeight = interpolate(frame, [barDelay, barDelay + 15], [0, h], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                });

                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${barHeight}%`,
                      backgroundColor: `${COLORS.textLight}20`,
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                );
              })}

              {/* Trend line overlay */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible',
                }}
                viewBox="0 0 300 100"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="trend-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={COLORS.primary} />
                    <stop offset="100%" stopColor={COLORS.blue500} />
                  </linearGradient>
                </defs>
                <path
                  d="M0,95 C40,95 60,70 90,70 S150,40 180,50 S240,65 280,55"
                  fill="none"
                  stroke="url(#trend-grad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="300"
                  strokeDashoffset={300 - 300 * lineProgress}
                />
              </svg>
            </div>

            {/* Alert */}
            <div
              style={{
                marginTop: 8,
                fontSize: 10,
                fontWeight: 700,
                color: COLORS.amber500,
                backgroundColor: `${COLORS.amber500}10`,
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${COLORS.amber500}25`,
                textAlign: 'center',
                opacity: interpolate(frame, [100, 110], [0, 1], {
                  extrapolateRight: 'clamp',
                  extrapolateLeft: 'clamp',
                }),
              }}
            >
              Stockout predicted in 3 days
            </div>
          </div>
        </div>
      </div>

      <FeatureCallout text="AI Demand Forecasting" x={1400} y={200} delay={80} />
    </DashboardMockup>
  );
}
