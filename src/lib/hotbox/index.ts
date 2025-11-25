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
  calculateRevenueScore,
  calculateLocationsScore,
  calculateEmployeesScore,
  calculateTierScoring,
  getTierFromScore,
  getNextTier,
  calculateConfidence,
  fetchTenantMetrics,
  detectBusinessTier,
  detectTierFromMetrics,
} from './tierDetection';

// Attention Queue
export {
  calculateItemScore,
  sortByScore,
  createAttentionItem,
  fetchAttentionItems,
  buildAttentionQueue,
  getTopAttentionItems,
  buildQueueFromItems,
} from './attentionQueue';

