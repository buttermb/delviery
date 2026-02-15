// @ts-nocheck
// src/remotion/compositions/FloraIQHeroLoop.tsx
// 10-second looping background video for the homepage hero
// Shows: floating menu card with data flowing through it
// Designed to loop seamlessly and play muted behind hero text

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const COLORS = {
  bg: "#0A0A0B",
  bgCard: "#111113",
  emerald: "#10B981",
  emeraldGlow: "rgba(16, 185, 129, 0.12)",
  white: "#FFFFFF",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray800: "#1F2937",
};

const FONT = {
  display: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', monospace",
};

export const FloraIQHeroLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // ═══ FLOATING MENU CARD ═══
  // Gentle float up and down (seamless loop)
  const floatY = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0, -12, 0],
    { easing: Easing.inOut(Easing.sin) }
  );

  // Subtle rotation
  const floatRotate = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [-0.5, 0.5, -0.5],
    { easing: Easing.inOut(Easing.sin) }
  );

  // ═══ BACKGROUND GLOW ═══
  // Breathing glow effect
  const glowScale = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [1, 1.15, 1],
    { easing: Easing.inOut(Easing.sin) }
  );

  const glowOpacity = interpolate(
    frame,
    [0, durationInFrames / 2, durationInFrames],
    [0.2, 0.35, 0.2],
    { easing: Easing.inOut(Easing.sin) }
  );

  // ═══ DATA FLOW PARTICLES ═══
  // Small dots that travel across the card suggesting data movement
  const particles = Array.from({ length: 6 }, (_, i) => {
    const speed = 0.8 + i * 0.3;
    const offset = (i * 50) % durationInFrames;
    const progress = ((frame + offset) * speed) % durationInFrames;
    const normalizedProgress = progress / durationInFrames;

    return {
      x: interpolate(normalizedProgress, [0, 1], [-100, 820]),
      y: 160 + i * 55 + Math.sin((frame + i * 40) * 0.05) * 8,
      opacity: interpolate(normalizedProgress, [0, 0.1, 0.9, 1], [0, 0.6, 0.6, 0]),
      size: 4 + (i % 3) * 2,
    };
  });

  // ═══ STATUS INDICATOR PULSE ═══
  const statusPulse = interpolate(
    frame,
    [0, 15, 30],
    [1, 0.4, 1],
    { easing: Easing.inOut(Easing.sin) }
  );

  // ═══ NOTIFICATION that appears/disappears ═══
  // Appears at frame 90, disappears at frame 210, loops
  const notifCycle = frame % durationInFrames;
  const notifVisible = notifCycle >= 90 && notifCycle < 240;
  const notifOpacity = notifVisible
    ? notifCycle < 105
      ? interpolate(notifCycle, [90, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : notifCycle > 225
        ? interpolate(notifCycle, [225, 240], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
        : 1
    : 0;

  const notifY = notifVisible
    ? interpolate(notifCycle, [90, 110], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
    : 20;

  // Menu items (static display)
  const menuItems = [
    { name: "Runtz — 1oz", price: "$280", thc: "29%" },
    { name: "Gelato #41 — 1oz", price: "$260", thc: "27%" },
    { name: "Zaza OG — QP", price: "$950", thc: "31%" },
    { name: "Blue Dream — HP", price: "$1,400", thc: "24%" },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* ─── BACKGROUND GLOW ─── */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.emeraldGlow} 0%, transparent 65%)`,
          transform: `scale(${glowScale})`,
          opacity: glowOpacity,
        }}
      />

      {/* ─── GRID PATTERN (subtle) ─── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ─── DATA FLOW PARTICLES ─── */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `calc(50% - 350px + ${p.x}px)`,
            top: `calc(50% - 200px + ${p.y}px)`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: COLORS.emerald,
            opacity: p.opacity,
            filter: "blur(1px)",
          }}
        />
      ))}

      {/* ─── FLOATING MENU CARD ─── */}
      <div
        style={{
          transform: `translateY(${floatY}px) rotate(${floatRotate}deg)`,
          width: 700,
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "rgba(17, 17, 19, 0.9)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(16, 185, 129, 0.05)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: COLORS.emerald,
                opacity: statusPulse,
              }}
            />
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 15,
                color: COLORS.white,
                fontWeight: 600,
              }}
            >
              Wholesale Menu — Brooklyn Collective
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 11,
              color: COLORS.gray500,
            }}
          >
            🔒 Encrypted • Expires after order
          </span>
        </div>

        {/* Menu items */}
        {menuItems.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 24px",
              borderBottom: "1px solid rgba(255,255,255,0.025)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "rgba(16, 185, 129, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                🌿
              </div>
              <div>
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 15,
                    color: COLORS.white,
                    fontWeight: 500,
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    color: COLORS.gray500,
                    marginTop: 1,
                  }}
                >
                  THC: {item.thc}
                </div>
              </div>
            </div>
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: 18,
                color: COLORS.emerald,
                fontWeight: 700,
              }}
            >
              {item.price}
            </span>
          </div>
        ))}

        {/* Footer with link */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13 }}>🔗</span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: "rgba(16, 185, 129, 0.5)",
            }}
          >
            floraiq.co/m/x8k2jF9...
          </span>
        </div>
      </div>

      {/* ─── FLOATING NOTIFICATION ─── */}
      <div
        style={{
          position: "absolute",
          top: "calc(50% - 220px)",
          right: "calc(50% - 440px)",
          opacity: notifOpacity,
          transform: `translateY(${notifY}px)`,
          padding: "14px 20px",
          borderRadius: 14,
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 13,
            color: COLORS.emerald,
            fontWeight: 600,
          }}
        >
          ✓ New order — $2,890
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: COLORS.gray500,
            marginTop: 2,
          }}
        >
          Brooklyn Collective • just now
        </div>
      </div>
    </AbsoluteFill>
  );
};
