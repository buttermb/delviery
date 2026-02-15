// @ts-nocheck
/**
 * TestimonialCard — Per-card composition (~8 seconds = 240 frames @ 30fps).
 * Typewriter quote text → star rating reveal → author fade-in.
 * Parametrized via Zod schema.
 */

import { z } from 'zod';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { COLORS, SPRING_PRESETS } from '@/remotion/config';
import { typewriter } from '@/remotion/utils/animations';

export const testimonialCardSchema = z.object({
  text: z.string(),
  author: z.string(),
  company: z.string(),
  rating: z.number().min(1).max(5),
  role: z.string(),
  avatar: z.string(),
});

type TestimonialCardProps = z.infer<typeof testimonialCardSchema>;

export function TestimonialCard({
  text,
  author,
  company,
  rating,
  role,
  avatar,
}: TestimonialCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Quote icon appears (0-15)
  const quoteScale = spring({
    frame,
    fps,
    config: SPRING_PRESETS.snappy,
    durationInFrames: 15,
  });

  // Phase 2: Typewriter text (10-160)
  const charsToShow = typewriter(frame, 10, text.length, 0.7);
  const displayedText = text.slice(0, charsToShow);

  // Phase 3: Star rating reveal (140-180)
  const starsOpacity = interpolate(frame, [140, 155], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  // Phase 4: Author fade-in (165-200)
  const authorOpacity = interpolate(frame, [165, 185], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const authorY = interpolate(frame, [165, 185], [15, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          width: '100%',
          backgroundColor: 'white',
          borderRadius: 24,
          border: `1px solid ${COLORS.border}`,
          padding: '60px 64px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Quote mark */}
        <div
          style={{
            fontSize: 48,
            color: `${COLORS.primary}30`,
            transform: `scale(${quoteScale})`,
            lineHeight: 1,
          }}
        >
          &ldquo;
        </div>

        {/* Quote text (typewriter) */}
        <div
          style={{
            fontSize: 22,
            lineHeight: 1.6,
            color: COLORS.text,
            minHeight: 120,
          }}
        >
          {displayedText}
          {charsToShow < text.length && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 24,
                backgroundColor: COLORS.primary,
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                opacity: frame % 16 < 8 ? 1 : 0,
              }}
            />
          )}
        </div>

        {/* Star rating */}
        <div style={{ display: 'flex', gap: 4, opacity: starsOpacity }}>
          {Array.from({ length: rating }).map((_, i) => {
            const starScale = spring({
              frame: frame - (140 + i * 4),
              fps,
              config: SPRING_PRESETS.bouncy,
              durationInFrames: 12,
            });
            return (
              <div
                key={i}
                style={{
                  fontSize: 22,
                  transform: `scale(${starScale})`,
                }}
              >
                &#11088;
              </div>
            );
          })}
        </div>

        {/* Author */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            opacity: authorOpacity,
            transform: `translateY(${authorY}px)`,
            borderTop: `1px solid ${COLORS.border}`,
            paddingTop: 24,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            {avatar}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
              {author}
            </div>
            <div style={{ fontSize: 14, color: COLORS.textLight }}>
              {role} at {company}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
