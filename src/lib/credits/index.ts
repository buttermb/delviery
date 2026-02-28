/**
 * Credits Module
 * 
 * Exports all credit-related functionality
 */

// Credit costs and configuration
export {
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  FREE_TIER_MONTHLY_CREDITS,
  LOW_CREDIT_WARNING_THRESHOLD,
  CRITICAL_CREDIT_THRESHOLD,
  CREDIT_WARNING_THRESHOLDS,
  LOW_BALANCE_WARNING_LEVELS,
  BEHAVIORAL_TRIGGERS,
  HIGH_COST_THRESHOLD,
  GRACE_PERIOD,
  MIN_BALANCE_REQUIREMENTS,
  FREE_ACTIONS,
  WEEKLY_BURN_ESTIMATE,
  FREE_TIER_LIMITS,
  getCreditCost,
  getCreditCostInfo,
  getCreditCostsByCategory,
  getCategoryDisplayName,
  isActionFree,
  getPricePerCredit,
  type CreditCost,
  type CreditCategory,
  type CreditPackage,
  type BlockedFeature,
} from './creditCosts';

// Credit service functions
export {
  getCreditBalance,
  checkCredits,
  consumeCredits,
  grantFreeCredits,
  purchaseCredits,
  getCreditTransactions,
  trackCreditEvent,
  calculateCreditVsSubscription,
  estimateCreditDuration,
  getActionCreditInfo,
  type CreditBalance,
  type CreditTransaction,
  type ConsumeCreditsResult,
  type CheckCreditsResult,
} from './creditService';

// Credit projection functions
export {
  projectDepletion,
  getUsageStats,
  getPaceComparison,
  type CreditProjection,
  type UsageStats,
} from './creditProjection';

// Auto top-up functions
export {
  getAutoTopUpConfig,
  setupAutoTopUp,
  disableAutoTopUp,
  updateAutoTopUpPaymentMethod,
  checkAutoTopUp,
  triggerAutoTopUp,
  getAutoTopUpOptions,
  getThresholdOptions,
  getMaxPerMonthOptions,
  type AutoTopUpConfig,
  type SetupAutoTopUpRequest,
  type AutoTopUpResult,
  type TopUpCheckResult,
} from './autoTopUp';

// Referral functions
export {
  getOrCreateReferralCode,
  getReferralCode,
  validateReferralCode,
  redeemReferralCode,
  getReferralStats,
  getReferralLeaderboard,
  grantConversionBonus,
  getReferralLink,
  copyReferralLink,
  REFERRAL_REWARDS,
  type ReferralCode,
  type ReferralRedemption,
  type ReferralStats,
  type RedeemResult,
} from './referralService';

// Promo code functions
export {
  validatePromoCode,
  hasRedeemedPromoCode,
  redeemPromoCode,
  getTenantPromoRedemptions,
  createPromoCode,
  deactivatePromoCode,
  getAllPromoCodes,
  getPromoCodeStats,
  type PromoCode,
  type PromoRedemption,
  type RedeemPromoResult,
} from './promoCodeService';

// Super Admin credit management functions
export {
  getPlatformCreditStats,
  getTenantsWithCredits,
  getTenantCreditDetail,
  adjustTenantCredits,
  grantBulkCredits,
  refundTransaction,
  getAllTransactions,
  getCreditAnalytics,
  getAllPromoCodes as getAdminPromoCodes,
  createPromoCode as createAdminPromoCode,
  updatePromoCode,
  getPromoCodeRedemptions,
  getAllCreditPackages,
  upsertCreditPackage,
  getReferralStats as getAdminReferralStats,
  type TenantCreditInfo,
  type PlatformCreditStats,
  type CreditAdjustmentRequest,
  type AdjustmentReason,
  type TenantCreditDetail,
  type TenantsFilter,
  type BulkGrantRequest,
  type PromoCodeAdmin,
  type CreatePromoCodeRequest,
  type CreditPackageDB,
  type ReferralStats as AdminReferralStats,
} from './superAdminCreditService';







