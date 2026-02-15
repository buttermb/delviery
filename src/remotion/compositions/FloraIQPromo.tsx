// @ts-nocheck
// src/remotion/compositions/FloraIQPromo.tsx
// Full 30-second promo video — the main composition
// Scenes: Intro → Problem → Solution Demo → Stats → CTA

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ═══════════════════════════════════════════════
// SHARED STYLES & CONSTANTS
// ═══════════════════════════════════════════════

const COLORS = {
  bg: "#0A0A0B",
  bgCard: "#111113",
  emerald: "#10B981",
  emeraldGlow: "rgba(16, 185, 129, 0.15)",
  emeraldDim: "rgba(16, 185, 129, 0.6)",
  white: "#FFFFFF",
  gray100: "#F3F4F6",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray700: "#374151",
  gray800: "#1F2937",
  red400: "#F87171",
  redGlow: "rgba(248, 113, 113, 0.15)",
};

const FONT = {
  display: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
};

// ═══════════════════════════════════════════════
// UTILITY: Fade helpers
// ═══════════════════════════════════════════════

function fadeIn(frame: number, start: number, duration = 15) {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function fadeOut(frame: number, start: number, duration = 12) {
  return interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

function slideUp(frame: number, start: number, distance = 40, duration = 18) {
  return interpolate(frame, [start, start + duration], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

// ═══════════════════════════════════════════════
// SCENE 1: BRAND INTRO (0s – 4s)
// Logo appears, tagline types in
// ═══════════════════════════════════════════════

const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale spring
  const logoScale = spring({ frame, fps, from: 0.6, to: 1, config: { stiffness: 80, damping: 15 } });
  const logoOpacity = fadeIn(frame, 0, 20);

  // Tagline types in letter by letter
  const tagline = "Wholesale menus that self-destruct.";
  const charsVisible = Math.floor(
    interpolate(frame, [25, 80], [0, tagline.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const displayedTagline = tagline.slice(0, charsVisible);

  // Cursor blink
  const cursorVisible = Math.floor(frame / 8) % 2 === 0;

  // Glow pulse behind logo
  const glowScale = interpolate(frame, [0, 60], [0.5, 1.2], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const glowOpacity = interpolate(frame, [0, 30, 90], [0, 0.4, 0.2], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.emeraldGlow} 0%, transparent 70%)`,
          transform: `scale(${glowScale})`,
          opacity: glowOpacity,
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Leaf icon */}
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 8C32 8 48 16 48 32C48 48 32 56 32 56C32 56 16 48 16 32C16 16 32 8 32 8Z"
              fill={COLORS.emerald}
              opacity={0.9}
            />
            <path
              d="M32 20V48M24 28L32 36L40 28"
              stroke={COLORS.bg}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 72,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: -2,
            }}
          >
            Flora
            <span style={{ color: COLORS.emerald }}>IQ</span>
          </span>
        </div>

        {/* Tagline with typing effect */}
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 28,
            color: COLORS.gray400,
            height: 40,
            letterSpacing: -0.5,
          }}
        >
          {displayedTagline}
          <span
            style={{
              color: COLORS.emerald,
              opacity: cursorVisible ? 1 : 0,
            }}
          >
            |
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// SCENE 2: THE PROBLEM (4s – 10s)
// Show the pain: texting menus, spreadsheets, pricing leaks
// ═══════════════════════════════════════════════

const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();

  const problems = [
    { icon: "💬", text: "Texting menus to 30 buyers", delay: 10 },
    { icon: "📊", text: "Tracking orders in spreadsheets", delay: 30 },
    { icon: "🔓", text: "Your pricing forwarded to competitors", delay: 50 },
    { icon: "📞", text: "\"Hey, you got any Runtz?\" at 2am", delay: 70 },
  ];

  // Title
  const titleOpacity = fadeIn(frame, 0, 15);
  const titleY = slideUp(frame, 0);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      {/* Section title */}
      <div
        style={{
          position: "absolute",
          top: 140,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 24,
            color: COLORS.red400,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Sound familiar?
        </span>
      </div>

      {/* Problem cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 20,
          width: "100%",
          maxWidth: 900,
        }}
      >
        {problems.map((problem, i) => {
          const cardOpacity = fadeIn(frame, problem.delay, 12);
          const cardX = interpolate(
            frame,
            [problem.delay, problem.delay + 15],
            [-60, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }
          );

          // Red strike-through animation
          const strikeWidth = interpolate(
            frame,
            [problem.delay + 50, problem.delay + 65],
            [0, 100],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }
          );

          return (
            <div
              key={i}
              style={{
                opacity: cardOpacity,
                transform: `translateX(${cardX}px)`,
                display: "flex",
                alignItems: "center",
                gap: 24,
                padding: "24px 32px",
                borderRadius: 16,
                backgroundColor: COLORS.bgCard,
                border: `1px solid rgba(248, 113, 113, 0.1)`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span style={{ fontSize: 36 }}>{problem.icon}</span>
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 30,
                  color: COLORS.gray100,
                  fontWeight: 500,
                }}
              >
                {problem.text}
              </span>

              {/* Red strike-through line */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "50%",
                  height: 3,
                  width: `${strikeWidth}%`,
                  backgroundColor: COLORS.red400,
                  opacity: 0.6,
                  transform: "translateY(-50%)",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// SCENE 3: THE SOLUTION DEMO (10s – 22s)
// Animated menu lifecycle: Create → Share → Order → Expire
// ═══════════════════════════════════════════════

const SceneSolution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = fadeIn(frame, 0, 15);
  const titleY = slideUp(frame, 0);
  const titleFadeOut = fadeOut(frame, 25, 10);

  // Stage indicators
  const stages = [
    { label: "Create", start: 30, color: COLORS.emerald },
    { label: "Share", start: 90, color: COLORS.emerald },
    { label: "Order", start: 150, color: COLORS.emerald },
    { label: "Expire", start: 230, color: COLORS.red400 },
  ];

  // Menu creation animation
  const menuOpacity = fadeIn(frame, 30, 15);
  const menuScale = spring({ frame: Math.max(0, frame - 30), fps, from: 0.9, to: 1, config: { stiffness: 120, damping: 14 } });

  // Products appearing one by one
  const products = [
    { name: "Runtz — 1oz", price: "$280", thc: "29%", delay: 40 },
    { name: "Gelato #41 — 1oz", price: "$260", thc: "27%", delay: 50 },
    { name: "Zaza OG — QP", price: "$950", thc: "31%", delay: 60 },
    { name: "Blue Dream — HP", price: "$1,400", thc: "24%", delay: 70 },
  ];

  // Link shared
  const linkOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const linkUrl = "floraiq.co/m/x8k2jF9...";

  // Order placed notification
  const orderOpacity = interpolate(frame, [150, 165], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orderScale = spring({ frame: Math.max(0, frame - 150), fps, from: 0.8, to: 1, config: { stiffness: 200, damping: 12 } });

  // Link expiry + disintegrate
  const expireBlur = interpolate(frame, [250, 290], [0, 20], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const expireOpacity = interpolate(frame, [250, 290], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const expireRotate = interpolate(frame, [250, 290], [0, 5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // "That's it" finale
  const finaleOpacity = fadeIn(frame, 310, 20);
  const finaleScale = spring({ frame: Math.max(0, frame - 310), fps, from: 0.85, to: 1, config: { stiffness: 80, damping: 14 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${frame < 230 ? COLORS.emeraldGlow : COLORS.redGlow} 0%, transparent 70%)`,
          opacity: 0.3,
        }}
      />

      {/* Section title */}
      {frame < 35 && (
        <div
          style={{
            position: "absolute",
            opacity: titleOpacity * titleFadeOut,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 56,
              fontWeight: 700,
              color: COLORS.white,
            }}
          >
            Here's how it{" "}
            <span style={{ color: COLORS.emerald }}>actually</span> works.
          </span>
        </div>
      )}

      {/* Step indicator bar */}
      {frame >= 30 && frame < 310 && (
        <div
          style={{
            position: "absolute",
            top: 80,
            display: "flex",
            gap: 40,
          }}
        >
          {stages.map((stage, i) => {
            const isActive = frame >= stage.start;
            const dotScale = isActive
              ? spring({ frame: Math.max(0, frame - stage.start), fps, from: 0, to: 1, config: { stiffness: 200, damping: 10 } })
              : 0;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: isActive ? 1 : 0.3,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: stage.color,
                    transform: `scale(${dotScale})`,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 18,
                    color: isActive ? COLORS.white : COLORS.gray500,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MENU CARD ─── */}
      {frame >= 30 && frame < 290 && (
        <div
          style={{
            opacity: menuOpacity * expireOpacity,
            transform: `scale(${menuScale}) rotate(${expireRotate}deg)`,
            filter: `blur(${expireBlur}px)`,
            width: 700,
            borderRadius: 20,
            border: `1px solid ${frame >= 230 ? "rgba(248, 113, 113, 0.3)" : "rgba(255,255,255,0.1)"}`,
            backgroundColor: COLORS.bgCard,
            overflow: "hidden",
          }}
        >
          {/* Menu header */}
          <div
            style={{
              padding: "20px 28px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: frame >= 230 ? COLORS.red400 : COLORS.emerald,
                }}
              />
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 18,
                  color: COLORS.white,
                  fontWeight: 600,
                }}
              >
                {frame >= 230 ? "Menu Expired" : "Wholesale Menu — Brooklyn Collective"}
              </span>
            </div>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 13,
                color: COLORS.gray500,
              }}
            >
              {frame >= 230 ? "LINK DEAD" : "🔒 Encrypted"}
            </span>
          </div>

          {/* Product rows */}
          <div style={{ padding: "8px 0" }}>
            {products.map((product, i) => {
              const rowOpacity = fadeIn(frame, product.delay, 10);
              return (
                <div
                  key={i}
                  style={{
                    opacity: rowOpacity,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 28px",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                      }}
                    >
                      🌿
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: FONT.display,
                          fontSize: 17,
                          color: COLORS.white,
                          fontWeight: 500,
                        }}
                      >
                        {product.name}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 12,
                          color: COLORS.gray500,
                          marginTop: 2,
                        }}
                      >
                        THC: {product.thc}
                      </div>
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: FONT.display,
                      fontSize: 20,
                      color: COLORS.emerald,
                      fontWeight: 700,
                    }}
                  >
                    {product.price}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Link bar at bottom */}
          {frame >= 90 && (
            <div
              style={{
                opacity: linkOpacity,
                padding: "16px 28px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>🔗</span>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 14,
                  color: COLORS.emeraldDim,
                }}
              >
                {linkUrl}
              </span>
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 12,
                  color: COLORS.gray500,
                  marginLeft: "auto",
                }}
              >
                Expires after first order
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── ORDER NOTIFICATION ─── */}
      {frame >= 150 && frame < 230 && (
        <div
          style={{
            position: "absolute",
            top: 160,
            right: 200,
            opacity: orderOpacity,
            transform: `scale(${orderScale})`,
            padding: "20px 28px",
            borderRadius: 16,
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 14,
              color: COLORS.emerald,
              fontWeight: 600,
            }}
          >
            ✓ New Order Received
          </span>
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              color: COLORS.white,
              fontWeight: 700,
            }}
          >
            $2,890.00
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: COLORS.gray500,
            }}
          >
            Brooklyn Collective • just now
          </span>
        </div>
      )}

      {/* ─── PAYMENT NOTIFICATION ─── */}
      {frame >= 185 && frame < 230 && (
        <div
          style={{
            position: "absolute",
            top: 300,
            right: 160,
            opacity: fadeIn(frame, 185, 12),
            transform: `scale(${spring({ frame: Math.max(0, frame - 185), fps, from: 0.8, to: 1, config: { stiffness: 200, damping: 12 } })})`,
            padding: "16px 24px",
            borderRadius: 14,
            backgroundColor: "rgba(16, 185, 129, 0.05)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 15,
              color: COLORS.emerald,
              fontWeight: 500,
            }}
          >
            💳 Payment processed — $2,890.00
          </span>
        </div>
      )}

      {/* ─── "THAT'S IT" FINALE ─── */}
      {frame >= 310 && (
        <div
          style={{
            opacity: finaleOpacity,
            transform: `scale(${finaleScale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 64,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: -2,
            }}
          >
            That's it.
          </span>
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 24,
              color: COLORS.gray400,
            }}
          >
            Menu sent. Order placed. Link gone. Pricing protected.
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// SCENE 4: STATS (22s – 26s)
// Animated counters
// ═══════════════════════════════════════════════

const SceneStats: React.FC = () => {
  const frame = useCurrentFrame();

  const stats = [
    { value: 847, suffix: "+", label: "SKUs Tracked", delay: 10 },
    { value: 23, suffix: "", label: "NY Operators", delay: 20 },
    { value: 99, suffix: "%", label: "Uptime", delay: 30 },
    { value: 2, suffix: "min", label: "Setup Time", prefix: "<", delay: 40 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 80,
        }}
      >
        {stats.map((stat, i) => {
          const statOpacity = fadeIn(frame, stat.delay, 15);
          const statY = slideUp(frame, stat.delay, 30);

          // Animated counter
          const counterProgress = interpolate(
            frame,
            [stat.delay, stat.delay + 45],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
          );
          const displayValue = Math.floor(counterProgress * stat.value);

          return (
            <div
              key={i}
              style={{
                opacity: statOpacity,
                transform: `translateY(${statY}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 72,
                  fontWeight: 800,
                  color: COLORS.white,
                  letterSpacing: -3,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.prefix || ""}
                {displayValue.toLocaleString()}
                {stat.suffix}
              </span>
              <span
                style={{
                  fontFamily: FONT.display,
                  fontSize: 16,
                  color: COLORS.gray500,
                  fontWeight: 500,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {stat.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// SCENE 5: CTA (26s – 30s)
// Final call to action with pulsing button
// ═══════════════════════════════════════════════

const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineOpacity = fadeIn(frame, 5, 20);
  const headlineScale = spring({ frame: Math.max(0, frame - 5), fps, from: 0.9, to: 1, config: { stiffness: 80, damping: 14 } });

  const subtextOpacity = fadeIn(frame, 25, 15);
  const buttonOpacity = fadeIn(frame, 40, 15);

  // Button glow pulse
  const glowPulse = interpolate(frame, [50, 70, 90, 110], [0.3, 0.7, 0.3, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = fadeIn(frame, 60, 15);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Big glow */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.emeraldGlow} 0%, transparent 70%)`,
          opacity: 0.4,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          position: "relative",
        }}
      >
        {/* Headline */}
        <div
          style={{
            opacity: headlineOpacity,
            transform: `scale(${headlineScale})`,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 64,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: -2,
            }}
          >
            Stop texting menus.
          </span>
        </div>

        {/* Subtext */}
        <div style={{ opacity: subtextOpacity }}>
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 24,
              color: COLORS.gray400,
            }}
          >
            Free forever for small operations. Setup takes 2 minutes.
          </span>
        </div>

        {/* CTA Button */}
        <div
          style={{
            opacity: buttonOpacity,
            marginTop: 16,
            position: "relative",
          }}
        >
          {/* Button glow */}
          <div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 20,
              background: COLORS.emerald,
              filter: "blur(20px)",
              opacity: glowPulse,
            }}
          />
          <div
            style={{
              position: "relative",
              padding: "20px 48px",
              borderRadius: 16,
              backgroundColor: COLORS.emerald,
              fontFamily: FONT.display,
              fontSize: 24,
              fontWeight: 700,
              color: COLORS.white,
            }}
          >
            Create Your First Menu →
          </div>
        </div>

        {/* URL */}
        <div style={{ opacity: urlOpacity, marginTop: 8 }}>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 18,
              color: COLORS.gray500,
            }}
          >
            floraiqcrm.com
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════
// MAIN COMPOSITION — Stitch all scenes together
// ═══════════════════════════════════════════════

export const FloraIQPromo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* Scene 1: Brand Intro — 0s to 4s (frames 0–120) */}
      <Sequence from={0} durationInFrames={120}>
        <SceneIntro />
      </Sequence>

      {/* Scene 2: The Problem — 4s to 10s (frames 120–300) */}
      <Sequence from={120} durationInFrames={180}>
        <SceneProblem />
      </Sequence>

      {/* Scene 3: The Solution — 10s to 22s (frames 300–660) */}
      <Sequence from={300} durationInFrames={360}>
        <SceneSolution />
      </Sequence>

      {/* Scene 4: Stats — 22s to 26s (frames 660–780) */}
      <Sequence from={660} durationInFrames={120}>
        <SceneStats />
      </Sequence>

      {/* Scene 5: CTA — 26s to 30s (frames 780–900) */}
      <Sequence from={780} durationInFrames={120}>
        <SceneCTA />
      </Sequence>
    </AbsoluteFill>
  );
};
