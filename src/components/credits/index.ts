/**
 * Credits Components
 * 
 * UI components for the freemium credit system
 */

export { CreditBalance } from './CreditBalance';

export { CreditPurchaseModal } from './CreditPurchaseModal';

export { LowCreditWarning } from './LowCreditWarning';

export { OutOfCreditsModal } from './OutOfCreditsModal';
export type { OutOfCreditsModalProps } from './OutOfCreditsModal';

export { CreditUsageChart } from './CreditUsageChart';
export type { CreditUsageChartProps } from './CreditUsageChart';

export { 
  CreditDeductionToast,
  CreditToastContainer,
  creditToastManager,
  showCreditDeductionToast,
} from './CreditDeductionToast';
export type { 
  CreditDeductionToastProps,
  CreditToastContainerProps,
} from './CreditDeductionToast';

export {
  CreditCostBadge,
  CreditCostButtonContent,
  CreditCostIndicator,
} from './CreditCostBadge';
export type {
  CreditCostBadgeProps,
  CreditCostIndicatorProps,
} from './CreditCostBadge';

export { CreditUsageStats } from './CreditUsageStats';
export type { CreditUsageStatsProps } from './CreditUsageStats';

export { CreditConfirmDialog, useCreditConfirm } from './CreditConfirmDialog';
export type {
  CreditConfirmDialogProps,
  UseCreditConfirmOptions,
  UseCreditConfirmReturn,
} from './CreditConfirmDialog';

export { CreditActivityFeed } from './CreditActivityFeed';
export type { CreditActivityFeedProps } from './CreditActivityFeed';

export { BulkCreditCalculator, useBulkCreditCalculator } from './BulkCreditCalculator';
export type {
  BulkCreditCalculatorProps,
  UseBulkCreditCalculatorOptions,
  UseBulkCreditCalculatorReturn,
} from './BulkCreditCalculator';

export { AutoTopUpSettings } from './AutoTopUpSettings';
export type { AutoTopUpSettingsProps } from './AutoTopUpSettings';

export { ReferralDashboard } from './ReferralDashboard';
export type { ReferralDashboardProps } from './ReferralDashboard';

export { PromoCodeInput } from './PromoCodeInput';
export type { PromoCodeInputProps } from './PromoCodeInput';

export { CreditOptimizationTips } from './CreditOptimizationTips';
export type { CreditOptimizationTipsProps } from './CreditOptimizationTips';

export { SubscriptionStatusBadge, TierIndicator } from './SubscriptionStatusBadge';
export type { SubscriptionStatusBadgeProps } from './SubscriptionStatusBadge';

export { LowCreditNudge } from './LowCreditNudge';
export type { LowCreditNudgeProps } from './LowCreditNudge';

export { CreditPurchaseCelebration, useCreditCelebration } from './CreditPurchaseCelebration';
export type { CreditPurchaseCelebrationProps, UseCreditCelebrationReturn } from './CreditPurchaseCelebration';

export { CreditBurnRateDisplay } from './CreditBurnRateDisplay';
export type { CreditBurnRateDisplayProps } from './CreditBurnRateDisplay';

export { GracePeriodBanner, useGracePeriod } from './GracePeriodBanner';
export type { GracePeriodBannerProps, UseGracePeriodReturn } from './GracePeriodBanner';

export { CreditAlertBanner } from './CreditAlertBanner';
export type { CreditAlertBannerProps } from './CreditAlertBanner';

export { CreditBalanceCard } from './CreditBalanceCard';
export type { CreditBalanceCardProps } from './CreditBalanceCard';

export { CreditPackageCard } from './CreditPackageCard';
export type { CreditPackageCardProps } from './CreditPackageCard';

export { CreditTransactionRow } from './CreditTransactionRow';
export type { CreditTransactionRowProps, CreditTransactionRowTransaction } from './CreditTransactionRow';

// Re-export hook from hooks directory
export { useCreditAlert } from '@/hooks/useCreditAlert';
export type { UseCreditAlertReturn } from '@/hooks/useCreditAlert';







