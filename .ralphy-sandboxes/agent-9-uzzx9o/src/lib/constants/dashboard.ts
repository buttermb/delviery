/**
 * Dashboard Constants
 * 
 * Centralized constants for dashboard components to avoid magic numbers
 * and enable easy configuration changes.
 */

// Timing constants (in milliseconds)
export const DASHBOARD_CONSTANTS = {
  // Auth loading timeout before showing error
  AUTH_LOADING_TIMEOUT_MS: 15000,
  
  // Welcome modal display delay
  WELCOME_MODAL_DELAY_MS: 500,
  
  // Quick start display delay for empty accounts
  QUICK_START_DELAY_MS: 3000,
  
  // Onboarding wizard display delay
  ONBOARDING_WIZARD_DELAY_MS: 1000,
  
  // Query retry delay
  QUERY_RETRY_DELAY_MS: 1000,
  
  // Maximum query retries
  QUERY_MAX_RETRIES: 1,
} as const;

// Business metrics constants
export const METRICS_CONSTANTS = {
  // Default profit margin for estimates (25%)
  ESTIMATED_PROFIT_MARGIN: 0.25,
  
  // Commission rate for platform (3%)
  PLATFORM_COMMISSION_RATE: 0.03,
  
  // Low stock threshold when product doesn't have one set
  DEFAULT_LOW_STOCK_THRESHOLD: 10,
  
  // Number of low stock items to display
  LOW_STOCK_DISPLAY_LIMIT: 5,
  
  // Number of recent activities to display
  RECENT_ACTIVITY_LIMIT: 5,
} as const;

// Tier-related constants
export const TIER_CONSTANTS = {
  // Tier progression order
  TIER_ORDER: ['street', 'trap', 'block', 'hood', 'empire'] as const,
  
  // Tier emoji mapping
  TIER_EMOJIS: {
    street: '🌱',
    trap: '🏪',
    block: '🏢',
    hood: '🌆',
    empire: '👑',
  } as const,
  
  // Tier display names
  TIER_DISPLAY_NAMES: {
    street: 'Street',
    trap: 'Trap',
    block: 'Block',
    hood: 'Hood',
    empire: 'Empire',
  } as const,
  
  // Tier colors for UI
  TIER_COLORS: {
    street: 'text-green-500',
    trap: 'text-blue-500',
    block: 'text-purple-500',
    hood: 'text-orange-500',
    empire: 'text-yellow-500',
  } as const,
} as const;

// Attention queue constants
export const ATTENTION_CONSTANTS = {
  // Base score for attention item urgency
  BASE_URGENCY_SCORE: 100,
  
  // Score multipliers by priority
  PRIORITY_MULTIPLIERS: {
    critical: 3,
    important: 2,
    info: 1,
  } as const,
  
  // Maximum items to show in quick view
  QUICK_VIEW_LIMIT: 5,
} as const;

// Export all for convenience
export const CONSTANTS = {
  dashboard: DASHBOARD_CONSTANTS,
  metrics: METRICS_CONSTANTS,
  tier: TIER_CONSTANTS,
  attention: ATTENTION_CONSTANTS,
} as const;
