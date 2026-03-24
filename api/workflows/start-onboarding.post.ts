import { start } from "workflow/api";
import { defineEventHandler, readBody } from "nitro/h3";
import { tenantOnboardingWorkflow } from "../../workflows/tenant-onboarding";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Validate internal API key
  const apiKey = event.node.req.headers["x-internal-api-key"];
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return { error: "Unauthorized" };
  }

  await start(tenantOnboardingWorkflow, [body]);

  return { message: "Onboarding workflow started", tenantId: body.tenantId };
});
