import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS, SPRING_PRESETS } from '../../../config';
import { PhoneMockup } from '../components/PhoneMockup';
import { FeatureCallout } from '../components/FeatureCallout';
import { useSlideIn, useTypewriter } from '../../../utils/animations';

const MENU_ITEMS = [
  { name: 'Blue Dream', type: 'Flower', thc: '21%', price: '$45/3.5g' },
  { name: 'OG Kush', type: 'Flower', thc: '24%', price: '$50/3.5g' },
  { name: 'Sour Diesel Cart', type: 'Vape', thc: '89%', price: '$40' },
  { name: 'Indica Gummies', type: 'Edible', thc: '10mg', price: '$25' },
];

export function MenusScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleStyle = useSlideIn(5, 'up', 'smooth');

  // Passphrase typing animation
  const passphrase = useTypewriter('green-valley-2024', 40, 0.6);

  // Lock -> unlock transition
  const unlockDelay = 70;
  const unlockProgress = spring({
    frame: frame - unlockDelay,
    fps,
    config: SPRING_PRESETS.bouncy,
  });

  // CTA animation
  const ctaDelay = 120;
  const ctaProgress = spring({
    frame: frame - ctaDelay,
    fps,
    config: SPRING_PRESETS.smooth,
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
          Secure Menus
        </div>
      </div>

      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 80, alignItems: 'center' }}>
        {/* Phone with passphrase entry */}
        <div style={{ position: 'relative' }}>
          <PhoneMockup delay={10}>
            {frame < unlockDelay ? (
              // Locked state - passphrase entry
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Lock icon */}
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${COLORS.primary}20, ${COLORS.accent}20)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    fontSize: 28,
                  }}
                >
                  &#128274;
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif', marginBottom: 6 }}>
                  Encrypted Menu
                </div>
                <div style={{ fontSize: 12, color: COLORS.textLight, fontFamily: 'Inter, sans-serif', marginBottom: 24, textAlign: 'center' }}>
                  Enter passphrase to view catalog
                </div>

                {/* Passphrase input */}
                <div
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    border: `2px solid ${COLORS.primary}`,
                    padding: '0 14px',
                    display: 'flex',
                    alignItems: 'center',
                    background: COLORS.backgroundAlt,
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 14, color: COLORS.text, fontFamily: 'monospace', fontWeight: 600 }}>
                    {passphrase}
                    <span style={{ opacity: Math.sin(frame * 0.15) > 0 ? 1 : 0, color: COLORS.primary }}>|</span>
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 10,
                    background: COLORS.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Access Menu
                </div>

                <div style={{ marginTop: 20, display: 'flex', gap: 16 }}>
                  {['Auto-burn', 'Fingerprint ID', 'No screenshots'].map((feature, i) => (
                    <div key={i} style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: COLORS.primary }} />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Unlocked state - menu view
              <div style={{ padding: '20px 14px', opacity: unlockProgress }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>
                      Green Valley Menu
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.primary, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
                      &#128274; Encrypted &middot; Expires in 24h
                    </div>
                  </div>
                </div>

                {MENU_ITEMS.map((item, i) => {
                  const itemDelay = unlockDelay + 5 + i * 6;
                  const itemProgress = spring({ frame: frame - itemDelay, fps, config: SPRING_PRESETS.snappy });

                  return (
                    <div
                      key={i}
                      style={{
                        opacity: itemProgress,
                        transform: `translateY(${interpolate(itemProgress, [0, 1], [10, 0])}px)`,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${COLORS.border}`,
                        marginBottom: 8,
                        background: COLORS.backgroundAlt,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, fontFamily: 'Inter, sans-serif' }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: COLORS.textLight, fontFamily: 'Inter, sans-serif' }}>
                            {item.type} &middot; THC {item.thc}
                          </div>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.primary, fontFamily: 'Inter, sans-serif' }}>
                          {item.price}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PhoneMockup>
        </div>

        {/* CTA panel */}
        <div
          style={{
            opacity: ctaProgress,
            transform: `translateX(${interpolate(ctaProgress, [0, 1], [40, 0])}px)`,
            maxWidth: 480,
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              marginBottom: 16,
            }}
          >
            Secure menus
            <br />
            <span style={{ color: COLORS.primary }}>that disappear.</span>
          </div>
          <div
            style={{
              fontSize: 18,
              color: '#94a3b8',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.5,
              marginBottom: 32,
            }}
          >
            OPSEC-grade encrypted catalogs with auto-burn,
            device fingerprinting, and expiring links.
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div
              style={{
                background: COLORS.primary,
                color: '#fff',
                padding: '14px 32px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'Inter, sans-serif',
                boxShadow: `0 4px 20px ${COLORS.primary}40`,
              }}
            >
              Start Free &rarr;
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '14px 32px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Watch Demo
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 13,
              color: '#64748b',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            No credit card required &middot; Free forever plan available
          </div>
        </div>
      </div>

      <FeatureCallout
        label="OPSEC-Grade Encryption"
        delay={50}
        position={{ bottom: 60, right: 120 }}
      />
    </div>
  );
}
