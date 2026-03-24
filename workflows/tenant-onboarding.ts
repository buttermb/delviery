import { callEdgeFunction } from "./lib/call-edge-function";

/**
 * Tenant Onboarding Workflow
 *
 * Durable workflow that sends welcome emails and trial reminders.
 * Originally used the Vercel Workflow SDK (sleep, "use workflow" directive).
 *
 * TODO: Re-integrate with Vercel Workflow SDK once a SPA-compatible
 * integration approach is available (without the nitro Vite plugin).
 */
export async function tenantOnboardingWorkflow(input: {
  tenantId: string;
  userId: string;
  email: string;
  fullName: string;
  trialDays: number;
}) {
  const { tenantId, userId, email, fullName } = input;

  // Step 1: Send welcome email (immediate)
  await callEdgeFunction("send-welcome-email", {
    user_id: userId,
    email,
    full_name: fullName,
    tenant_id: tenantId,
  });

  // Steps 2-6 (trial reminders) require durable execution (sleep across days).
  // These are deferred until the Workflow SDK is re-integrated.

  return { tenantId, status: "welcome_sent" };
}
