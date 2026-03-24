import { sleep } from "workflow";
import { callEdgeFunction } from "./lib/call-edge-function";

export async function tenantOnboardingWorkflow(input: {
  tenantId: string;
  userId: string;
  email: string;
  fullName: string;
  trialDays: number;
}) {
  "use workflow";

  const { tenantId, userId, email, fullName, trialDays } = input;

  // Step 1: Send welcome email (immediate)
  await callEdgeFunction("send-welcome-email", {
    user_id: userId,
    email,
    full_name: fullName,
    tenant_id: tenantId,
  });

  // Step 2: Send onboarding tip email (5 minutes after signup)
  await sleep("5m");
  // Could add a "tips" email edge function here later

  // Step 3: Trial reminder at 7 days remaining
  if (trialDays >= 7) {
    await sleep(`${trialDays - 7}d`);
    await callEdgeFunction("send-trial-reminder", {
      tenant_id: tenantId,
      days_remaining: 7,
      has_payment_method: false,
    });
  }

  // Step 4: Trial reminder at 3 days remaining
  await sleep(`${Math.max(trialDays >= 7 ? 4 : trialDays - 3, 0)}d`);
  await callEdgeFunction("send-trial-reminder", {
    tenant_id: tenantId,
    days_remaining: 3,
    has_payment_method: false,
  });

  // Step 5: Trial reminder at 1 day remaining
  await sleep("2d");
  await callEdgeFunction("send-trial-reminder", {
    tenant_id: tenantId,
    days_remaining: 1,
    has_payment_method: false,
  });

  // Step 6: Trial expired
  await sleep("1d");
  await callEdgeFunction("send-trial-expired-notice", {
    tenant_id: tenantId,
  });

  return { tenantId, status: "trial_expired" };
}
