// @ts-nocheck
/**
 * CustomerPortalDemo — Shows white-labeled storefront mockup,
 * customer browsing and ordering.
 * 10 seconds (300 frames @ 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';

const PRODUCTS = [
  { name: 'Blue Dream', price: '$45', category: 'Flower' },
  { name: 'OG Kush', price: '$52', category: 'Flower' },
  { name: 'Gummies 10pk', price: '$35', category: 'Edible' },
  { name: 'Vape Cart', price: '$40', category: 'Extract' },
];

export function CustomerPortalDemo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase: browse (0-120), select (120-200), checkout (200-300)
  const phase = frame < 120 ? 'browse' : frame < 200 ? 'select' : 'checkout';

  // Browser mockup scale
  const browserScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 20,
  });

  // Product hover effect (simulated cursor)
  const hoverIndex = frame < 60 ? -1 : frame < 90 ? 0 : frame < 120 ? 1 : 1;

  // Cart item count
  const cartCount = frame < 120 ? 0 : frame < 150 ? 1 : 2;

  // Add to cart animation
  const showAddToCart = frame >= 120 && frame < 150;
  const addToCartScale = spring({
    frame: frame - 120,
    fps,
    config: SPRING_PRESETS.bouncy,
    durationInFrames: 15,
  });

  // Checkout panel
  const checkoutX = interpolate(frame, [200, 230], [400, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Order confirmation
  const showConfirmation = frame >= 270;
  const confirmScale = spring({
    frame: frame - 270,
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
      {/* Browser mockup */}
      <div
        style={{
          width: '100%',
          maxWidth: 900,
          backgroundColor: 'white',
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          transform: `scale(${browserScale})`,
        }}
      >
        {/* Browser header */}
        <div
          style={{
            height: 36,
            backgroundColor: COLORS.bgSubtle,
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f87171' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbf24' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#34d399' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                backgroundColor: 'white',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 4,
                padding: '2px 12px',
                fontSize: 10,
                color: COLORS.textLight,
                fontFamily: 'monospace',
              }}
            >
              yourstore.floraiq.com
            </div>
          </div>
        </div>

        {/* Store header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${COLORS.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: COLORS.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              GV
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Green Valley</div>
              <div style={{ fontSize: 10, color: COLORS.textLight }}>Premium Selection</div>
            </div>
          </div>

          {/* Cart */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              backgroundColor: COLORS.bgSubtle,
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ fontSize: 16 }}>🛒</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>Cart ({cartCount})</span>
          </div>
        </div>

        {/* Products grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 16,
            padding: 24,
            position: 'relative',
          }}
        >
          {PRODUCTS.map((product, i) => {
            const isHovered = hoverIndex === i;
            const cardDelay = 30 + i * 10;
            const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 15], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });
            const cardY = interpolate(frame, [cardDelay, cardDelay + 15], [20, 0], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            return (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: `2px solid ${isHovered ? COLORS.primary : COLORS.border}`,
                  overflow: 'hidden',
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px) scale(${isHovered ? 1.02 : 1})`,
                  boxShadow: isHovered ? '0 8px 20px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <div
                  style={{
                    height: 100,
                    backgroundColor: COLORS.bgSubtle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      backgroundColor: COLORS.primary + '20',
                    }}
                  />
                </div>
                <div style={{ padding: 12 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: COLORS.primary,
                      fontWeight: 700,
                      marginBottom: 4,
                      textTransform: 'uppercase',
                    }}
                  >
                    {product.category}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{product.price}</div>
                </div>
              </div>
            );
          })}

          {/* Checkout panel */}
          {phase === 'checkout' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 280,
                backgroundColor: 'white',
                borderLeft: `1px solid ${COLORS.border}`,
                boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
                transform: `translateX(${checkoutX}px)`,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.text,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${COLORS.border}`,
                }}
              >
                Checkout
              </div>

              {['Blue Dream', 'OG Kush'].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: COLORS.text }}>{item}</span>
                  <span style={{ fontWeight: 700, color: COLORS.text }}>${i === 0 ? '45' : '52'}</span>
                </div>
              ))}

              <div
                style={{
                  marginTop: 'auto',
                  paddingTop: 16,
                  borderTop: `1px solid ${COLORS.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ color: COLORS.text }}>Total</span>
                  <span style={{ color: COLORS.primary }}>$97</span>
                </div>
                <div
                  style={{
                    backgroundColor: COLORS.primary,
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Place Order
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add to cart notification */}
      {showAddToCart && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            right: '30%',
            transform: `scale(${addToCartScale})`,
            padding: '10px 16px',
            backgroundColor: COLORS.primary,
            color: 'white',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          }}
        >
          Added to cart!
        </div>
      )}

      {/* Order confirmation */}
      {showConfirmation && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${confirmScale})`,
            backgroundColor: 'white',
            padding: 30,
            borderRadius: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            textAlign: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <span style={{ fontSize: 30, color: 'white' }}>✓</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
            Order Placed!
          </div>
          <div style={{ fontSize: 12, color: COLORS.textLight }}>Order #ORD-2847 confirmed</div>
        </div>
      )}
    </div>
  );
}
