export const REMOTION_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
};

export const SCENE_DURATIONS = {
  dashboard: 180,    // 6 seconds
  orders: 180,       // 6 seconds
  inventory: 180,    // 6 seconds
  fleet: 180,        // 6 seconds
  menus: 180,        // 6 seconds
  total: 900,        // 30 seconds
  featureDemo: 300,  // 10 seconds
  heroBackground: 600, // 20 seconds
  howItWorks: 450,   // 15 seconds
  securityExplainer: 360, // 12 seconds
  testimonialCard: 240, // 8 seconds
};

export const SPRING_PRESETS = {
  snappy: { damping: 20, mass: 0.8, stiffness: 200 },
  smooth: { damping: 30, mass: 1, stiffness: 120 },
  bouncy: { damping: 12, mass: 0.5, stiffness: 250 },
};
export const MOBILE_RESOLUTION = {
  width: 1080,
  height: 1920,
};
export const COLORS = {
  // Premium Layout Colors
  primary: '#2E1679', // Deep Indigo (Marketing Primary)
  secondary: '#4c32a0', // Lighter Indigo
  accent: '#F3A73D', // Gold (Marketing Accent)
  background: '#FFFFFF',

  // Text
  text: '#1e293b', // Slate 800
  textLight: '#64748b', // Slate 500

  // UI Elements
  border: '#e2e8f0',
  bgSubtle: '#f8fafc',

  // Functional Colors
  success: '#10B981', // Emerald 500
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Shadows (CSS values represented as strings for use in style objects)
  shadowElegant: '0 20px 60px -10px rgba(46, 22, 121, 0.15)',
  shadowGlass: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5)',
};

export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #2E1679 0%, #2E1679CC 50%, #F3A73D 100%)',
  subtle: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
  glass: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
};
