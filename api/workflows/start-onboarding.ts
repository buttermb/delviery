import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function: Start Onboarding Workflow
 *
 * Called from the tenant-signup edge function to kick off
 * the durable onboarding sequence (welcome email, trial reminders).
 *
 * Currently a stub — the Vercel Workflow SDK integration was removed
 * because the nitro Vite plugin broke the SPA deployment (converted
 * static output to server-rendered, causing 500s on every route).
 *
 * TODO: Re-integrate Vercel Workflow SDK using a standalone approach
 * that doesn't require the nitro Vite plugin.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate internal API key
  const apiKey = req.headers['x-internal-api-key'];
  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;

  // Log the request for now — workflow execution will be re-added
  // once the SDK is integrated without the nitro Vite plugin.
  console.log('[ONBOARDING] Workflow start requested', {
    tenantId: body?.tenantId,
    userId: body?.userId,
    email: body?.email,
  });

  return res.status(200).json({
    message: 'Onboarding workflow acknowledged',
    tenantId: body?.tenantId,
  });
}
