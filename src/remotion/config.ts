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
  // ProductDemo scenes (6s each)
  dashboard: 180,
  orders: 180,
  inventory: 180,
  fleet: 180,
  menus: 180,
  total: 900,
  // Composition totals
  productDemo: 900,
  productDemoScene: 180,
  heroBackground: 120,
  howItWorks: 600,
  securityExplainer: 450,
  roiAnimation: 360,
  testimonialCard: 240,
  featureDemo: 300,
  floraIQPromo: 900,
  floraIQHeroLoop: 300,
} as const;

export const SCENE_OFFSETS = {
  dashboard: 0,
  orders: 180,
  inventory: 360,
  fleet: 540,
  menus: 720,
} as const;

/** Reusable spring presets */
export const SPRING_PRESETS = {
  snappy: { damping: 20, mass: 0.8, stiffness: 200 },
  smooth: { damping: 30, mass: 1, stiffness: 120 },
  bouncy: { damping: 12, mass: 0.5, stiffness: 250 },
  gentle: { damping: 25, mass: 1.2, stiffness: 100 },
} as const;

/** Color palette (matches marketing CSS variables) */
export const COLORS = {
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#34D399',
  secondary: '#059669',
  accent: '#06B6D4',
  text: '#0f172a',
  textLight: '#64748b',
  textMuted: '#94a3b8',
  bg: '#ffffff',
  background: '#ffffff',
  bgSubtle: '#f8fafc',
  backgroundAlt: '#f8fafc',
  surface: '#f1f5f9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  emerald50: '#ecfdf5',
  blue500: '#3b82f6',
  amber500: '#f59e0b',
  purple500: '#a855f7',
  red500: '#ef4444',
  danger: '#ef4444',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  success: '#10B981',
  purple: '#8b5cf6',
} as const;
