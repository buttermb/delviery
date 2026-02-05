/**
 * Remotion configuration — shared constants for all compositions.
 */

export const REMOTION_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
} as const;

/** Mobile resolution used when viewport < 768px */
export const MOBILE_RESOLUTION = {
  width: 960,
  height: 540,
} as const;

/** Scene durations (in frames at 30fps) */
export const SCENE_DURATIONS = {
  /** Product demo total = 900 frames = 30s */
  productDemo: 900,
  /** Each product demo scene = 180 frames = 6s */
  productDemoScene: 180,
  /** Hero background loop = 120 frames = 4s */
  heroBackground: 120,
  /** How It Works = 600 frames = 20s */
  howItWorks: 600,
  /** Security explainer = 450 frames = 15s */
  securityExplainer: 450,
  /** ROI animation = 360 frames = 12s */
  roiAnimation: 360,
  /** Testimonial card = 240 frames = 8s */
  testimonialCard: 240,
  /** Feature demo = 300 frames = 10s */
  featureDemo: 300,
  /** FloraIQ Promo = 900 frames = 30s */
  floraIQPromo: 900,
  /** FloraIQ Hero Loop = 300 frames = 10s */
  floraIQHeroLoop: 300,
} as const;

/** Reusable spring presets */
export const SPRING_PRESETS = {
  snappy: { damping: 20, mass: 0.8, stiffness: 200 },
  smooth: { damping: 30, mass: 1, stiffness: 120 },
  bouncy: { damping: 12, mass: 0.5, stiffness: 250 },
} as const;

/** Color palette (matches marketing CSS variables) */
export const COLORS = {
  primary: '#10B981',
  secondary: '#059669',
  accent: '#06B6D4',
  text: '#0f172a',
  textLight: '#64748b',
  bg: '#ffffff',
  bgSubtle: '#f8fafc',
  border: '#e2e8f0',
  emerald50: '#ecfdf5',
  blue500: '#3b82f6',
  amber500: '#f59e0b',
  purple500: '#a855f7',
  red500: '#ef4444',
} as const;
