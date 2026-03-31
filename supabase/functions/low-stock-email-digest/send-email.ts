// Low Stock Email Digest — Email Delivery

import { createLogger } from '../_shared/logger.ts';
import { generateDigestEmailHtml } from './build-email.ts';
import type { TenantDigestData } from './types.ts';

const logger = createLogger('low-stock-email-digest');

/**
 * Send email digest to tenant admin(s)
 */
export async function sendDigestEmail(
  supabase: any,
  data: TenantDigestData,
  recipients: string[]
): Promise<{ success: boolean; error?: string }> {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.floraiq.com';
  const inventoryUrl = `${appUrl}/${data.tenant_slug}/admin/inventory`;

  const subject = `[${data.business_name}] Low Stock Alert: ${data.low_stock_products.length} products need attention`;
  const html = generateDigestEmailHtml(data, inventoryUrl);

  try {
    // Use the send-notification function for email delivery
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Create in-app notification
    await supabase
      .from('notifications')
      .insert({
        tenant_id: data.tenant_id,
        type: 'inventory',
        title: `${data.low_stock_products.length} products below reorder point`,
        message: `Daily low stock digest: ${data.low_stock_products.slice(0, 3).map(p => p.product_name).join(', ')}${data.low_stock_products.length > 3 ? ` and ${data.low_stock_products.length - 3} more` : ''}`,
        metadata: {
          digest_type: 'low_stock',
          products_count: data.low_stock_products.length,
          action_url: inventoryUrl,
        },
      });

    // Send email via internal function
    for (const recipient of recipients) {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          tenant_id: data.tenant_id,
          type: 'inventory',
          title: subject,
          message: html,
          channels: ['email'],
          metadata: {
            email_to: recipient,
            email_subject: subject,
            email_html: html,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('Email send failed', { recipient, status: response.status, error: errorText });
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
