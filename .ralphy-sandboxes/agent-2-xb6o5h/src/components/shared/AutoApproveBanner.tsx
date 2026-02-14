import React from 'react';
import { useFeatureFlags } from '@/config/featureFlags';

export const AutoApproveBanner: React.FC = () => {
  const { flags, shouldAutoApprove } = useFeatureFlags();
  const active = shouldAutoApprove() ||
    flags.AUTO_APPROVE_ORDERS ||
    flags.AUTO_APPROVE_LISTINGS ||
    flags.AUTO_APPROVE_SIGNUPS ||
    flags.AUTO_APPROVE_COURIERS ||
    flags.AUTO_APPROVE_REVIEWS;

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full z-[60] sticky top-0 bg-amber-500/95 text-black text-sm px-4 py-2 flex items-center justify-center shadow-sm"
      data-testid="auto-approve-banner"
    >
      <strong className="font-semibold mr-2">Auto‑Approve Mode:</strong>
      All pending approvals are automatically approved. Turn off in runtime-flags.json or env.
    </div>
  );
};

export default AutoApproveBanner;
