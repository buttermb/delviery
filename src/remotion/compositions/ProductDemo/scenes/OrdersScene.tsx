/**
 * Scene 2: Orders — Kanban pipeline with cards flowing between columns.
 * Frames 0–180 within its Sequence (6 seconds at 30fps)
 */

import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';
import { DashboardMockup } from '@/remotion/compositions/ProductDemo/components/DashboardMockup';
import { FeatureCallout } from '@/remotion/compositions/ProductDemo/components/FeatureCallout';

const COLUMNS = ['New', 'Prep', 'Quality', 'Ready'];
const COLUMN_COLORS = [COLORS.blue500, COLORS.amber500, COLORS.purple500, COLORS.primary];

interface OrderCard {
  id: number;
  customer: string;
  items: number;
  total: string;
}

const INITIAL_CARDS: Record<string, OrderCard[]> = {
  New: [
    { id: 4930, customer: 'Green Leaf', items: 12, total: '$1.2k' },
    { id: 4931, customer: 'High Tide', items: 5, total: '$420' },
  ],
  Prep: [
    { id: 4928, customer: 'Urban Well', items: 8, total: '$850' },
  ],
  Quality: [
    { id: 4926, customer: 'Coastal Co', items: 24, total: '$2.1k' },
  ],
  Ready: [
    { id: 4925, customer: 'Med Leaf', items: 6, total: '$540' },
  ],
};

export function OrdersScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine which column each card is in based on frame
  // Card 4930 moves: New (0-60) → Prep (60-120) → Quality (120-180)
  const getCardColumn = (cardId: number): string => {
    if (cardId === 4930) {
      if (frame < 60) return 'New';
      if (frame < 120) return 'Prep';
      return 'Quality';
    }
    if (cardId === 4928) {
      if (frame < 90) return 'Prep';
      return 'Quality';
    }
    if (cardId === 4926) {
      if (frame < 70) return 'Quality';
      return 'Ready';
    }
    // Static cards
    for (const [col, cards] of Object.entries(INITIAL_CARDS)) {
      if (cards.some((c) => c.id === cardId)) return col;
    }
    return 'New';
  };

  const allCards = Object.values(INITIAL_CARDS).flat();

  const getCardsForColumn = (col: string): OrderCard[] =>
    allCards.filter((card) => getCardColumn(card.id) === col);

  return (
    <DashboardMockup title="floraiq.com/admin/orders">
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>Order Management</span>
            <div
              style={{
                fontSize: 10,
                padding: '3px 10px',
                backgroundColor: `${COLORS.primary}15`,
                color: COLORS.primary,
                borderRadius: 20,
                fontWeight: 700,
                border: `1px solid ${COLORS.primary}30`,
              }}
            >
              Live Pipeline
            </div>
          </div>
        </div>

        {/* Kanban columns */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {COLUMNS.map((col, colIdx) => {
            const colOpacity = interpolate(frame, [colIdx * 5, colIdx * 5 + 10], [0, 1], {
              extrapolateRight: 'clamp',
              extrapolateLeft: 'clamp',
            });

            const cards = getCardsForColumn(col);

            return (
              <div
                key={col}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: `1px solid ${COLORS.border}`,
                  padding: 12,
                  opacity: colOpacity,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '0 4px' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLUMN_COLORS[colIdx] }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{col}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10,
                      backgroundColor: COLORS.bgSubtle,
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: COLORS.textLight,
                      fontFamily: 'monospace',
                    }}
                  >
                    {cards.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {cards.map((card) => {
                    const cardScale = spring({ frame: frame - 5, fps, config: SPRING_PRESETS.snappy, durationInFrames: 15 });

                    return (
                      <div
                        key={card.id}
                        style={{
                          backgroundColor: COLORS.bgSubtle,
                          borderRadius: 10,
                          border: `1px solid ${COLORS.border}`,
                          padding: 12,
                          transform: `scale(${cardScale})`,
                        }}
                      >
                        <div style={{ fontSize: 10, color: COLORS.textLight, fontFamily: 'monospace', marginBottom: 6 }}>
                          #{card.id}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>
                          {card.customer}
                        </div>
                        <div style={{ fontSize: 10, color: COLORS.textLight }}>
                          {card.items} Items &bull; {card.total}
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

      <FeatureCallout text="Automated Kanban Pipeline" x={300} y={80} delay={20} />
    </DashboardMockup>
  );
}
