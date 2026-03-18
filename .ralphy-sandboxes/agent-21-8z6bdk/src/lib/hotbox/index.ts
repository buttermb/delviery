/**
 * Hotbox Module - Centralized exports
 * 
 * This module provides:
 * - Multi-factor tier detection with scoring
 * - Weighted attention queue algorithm
 * - All hotbox types and constants
 */

// Types
export * from '@/types/hotbox';

// Tier Detection
export {
  calculateTierScore,
  determineTierFromScore,
  getNextTierProgress,
  fetchTenantMetrics,
  detectBusinessTier,
  TIER_SCORE_THRESHOLDS,
} from './tierDetection';

// Attention Queue
export {
  calculateAttentionScore,
  sortAttentionQueue,
  fetchAttentionItems,
  buildAttentionQueue,
  getTopAttentionItems,
  buildQueueFromItems,
  getCategoryColor,
  PRIORITY_WEIGHTS,
  CATEGORY_URGENCY,
} from './attentionQueue';

