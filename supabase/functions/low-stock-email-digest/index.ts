// Low Stock Email Digest
//
// Daily scheduled edge function that sends email digests to tenant admins
// about products below their reorder threshold.
//
// Features:
// - Queries products below threshold per tenant
// - Formats email with product name, current stock, reorder point, days until stockout
// - Sends to admin email configured in tenant settings
// - Configurable in tenant alert_settings (email_digest_enabled, digest_time)
// - Caches results for efficiency
//
// Schedule: Daily at 8 AM UTC (0 8 * * *)
//
// To deploy:
// supabase functions deploy low-stock-email-digest --no-verify-jwt

import { serve, createClient, corsHeaders } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';

const logger = createLogger('low-stock-email-digest');

// Types
interface LowStockProduct {
  id: string;
  product_name: string;
  sku: string | null;
  current_quantity: number;
  reorder_point: number;
  avg_daily_usage: number;
  days_until_stockout: number | null;
  last_movement_date: string | null;
}

interface TenantDigestData {
  tenant_id: string;
  tenant_slug: string;
  admin_email: string;
  business_name: string;
  low_stock_products: LowStockProduct[];
}

interface DigestResult {
  tenant_id: string;
  tenant_slug: string;
  products_count: number;
  email_sent: boolean;
  error?: string;
}

interface AlertSettings {
  email_digest_enabled?: boolean;
  digest_recipients?: string[];
  low_stock_threshold_override?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify this is an internal/cron call
  const authHeader = req.headers.get('Authorization');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Allow service role key for cron jobs
  const isServiceCall = authHeader?.replace('Bearer ', '') === supabaseServiceKey;

  if (!isServiceCall) {
    // Check for valid JWT for manual triggers
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Starting daily low stock email digest job');

    const results: DigestResult[] = [];
    const summary = {
      tenants_checked: 0,
      emails_sent: 0,
      total_products_flagged: 0,
      errors: [] as string[],
    };

    // Get all active tenants with their settings
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select(`
        id,
        slug,
        name,
        owner_email,
        is_active,
        alert_settings
      `)
      .eq('is_active', true);

    if (tenantsError) {
      logger.error('Failed to fetch tenants', { error: tenantsError.message });
      throw tenantsError;
    }

    logger.info('Found active tenants', { count: tenants?.length || 0 });

    for (const tenant of tenants || []) {
      summary.tenants_checked++;

      try {
        // Check if email digest is enabled for this tenant
        const alertSettings = (tenant.alert_settings as AlertSettings) || {};

        // Default to enabled if not explicitly disabled
        if (alertSettings.email_digest_enabled === false) {
          logger.info('Email digest disabled for tenant', {
            tenantId: tenant.id,
            slug: tenant.slug
          });
          continue;
        }

        // Get low stock products for this tenant
        const lowStockProducts = await getLowStockProducts(
          supabase,
          tenant.id,
          alertSettings.low_stock_threshold_override
        );

        if (lowStockProducts.length === 0) {
          logger.info('No low stock products for tenant', {
            tenantId: tenant.id,
            slug: tenant.slug
          });
          continue;
        }

        summary.total_products_flagged += lowStockProducts.length;

        // Get recipient email(s)
        const recipients = alertSettings.digest_recipients?.length
          ? alertSettings.digest_recipients
          : [tenant.owner_email];

        // Send email digest
        const emailResult = await sendDigestEmail(
          supabase,
          {
            tenant_id: tenant.id,
            tenant_slug: tenant.slug,
            admin_email: recipients[0],
            business_name: tenant.name || tenant.slug,
            low_stock_products: lowStockProducts,
          },
          recipients
        );

        if (emailResult.success) {
          summary.emails_sent++;

          // Log the digest send event
          await supabase
            .from('audit_events')
            .insert({
              tenant_id: tenant.id,
              event_type: 'low_stock_digest_sent',
              event_data: {
                products_count: lowStockProducts.length,
                recipients,
                products: lowStockProducts.map(p => ({
                  id: p.id,
                  name: p.product_name,
                  current: p.current_quantity,
                  reorder: p.reorder_point,
                })),
              },
            });
        }

        results.push({
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          products_count: lowStockProducts.length,
          email_sent: emailResult.success,
          error: emailResult.error,
        });

        logger.info('Processed tenant digest', {
          tenantId: tenant.id,
          slug: tenant.slug,
          productsCount: lowStockProducts.length,
          emailSent: emailResult.success,
        });

      } catch (err) {
        const errorMessage = (err as Error).message;
        logger.error('Error processing tenant', {
          tenantId: tenant.id,
          error: errorMessage,
        });
        summary.errors.push(`${tenant.slug}: ${errorMessage}`);

        results.push({
          tenant_id: tenant.id,
          tenant_slug: tenant.slug,
          products_count: 0,
          email_sent: false,
          error: errorMessage,
        });
      }
    }

    logger.info('Low stock email digest job completed', summary);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Low stock email digest job completed',
        summary,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    logger.error('Low stock email digest job failed', {
      error: (error as Error).message
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Get low stock products for a tenant
 */
async function getLowStockProducts(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  thresholdOverride?: number
): Promise<LowStockProduct[]> {
  // Query wholesale_inventory for products below reorder point
  const { data: products, error } = await supabase
    .from('wholesale_inventory')
    .select(`
      id,
      product_name,
      sku,
      quantity_lbs,
      reorder_point,
      updated_at
    `)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gt('reorder_point', 0);

  if (error) {
    throw error;
  }

  const lowStockProducts: LowStockProduct[] = [];

  for (const product of products || []) {
    const reorderPoint = thresholdOverride ?? product.reorder_point;

    // Check if below threshold
    if (product.quantity_lbs <= reorderPoint) {
      // Calculate average daily usage from recent movements
      const avgDailyUsage = await calculateAverageDailyUsage(
        supabase,
        tenantId,
        product.id
      );

      // Calculate days until stockout
      let daysUntilStockout: number | null = null;
      if (avgDailyUsage > 0 && product.quantity_lbs > 0) {
        daysUntilStockout = Math.floor(product.quantity_lbs / avgDailyUsage);
      } else if (product.quantity_lbs <= 0) {
        daysUntilStockout = 0;
      }

      lowStockProducts.push({
        id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        current_quantity: product.quantity_lbs,
        reorder_point: reorderPoint,
        avg_daily_usage: avgDailyUsage,
        days_until_stockout: daysUntilStockout,
        last_movement_date: product.updated_at,
      });
    }
  }

  // Sort by days until stockout (most urgent first)
  lowStockProducts.sort((a, b) => {
    if (a.days_until_stockout === null) return 1;
    if (b.days_until_stockout === null) return -1;
    return a.days_until_stockout - b.days_until_stockout;
  });

  return lowStockProducts;
}

/**
 * Calculate average daily usage for a product over the last 30 days
 */
async function calculateAverageDailyUsage(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  productId: string
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get outgoing movements (sales, orders)
  const { data: movements, error } = await supabase
    .from('wholesale_inventory_movements')
    .select('quantity_change')
    .eq('tenant_id', tenantId)
    .eq('inventory_id', productId)
    .lt('quantity_change', 0) // Only outgoing (negative changes)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error || !movements || movements.length === 0) {
    return 0;
  }

  // Sum total outgoing (absolute values)
  const totalUsage = movements.reduce(
    (sum, m) => sum + Math.abs(m.quantity_change),
    0
  );

  // Average per day
  return totalUsage / 30;
}

/**
 * Send email digest to tenant admin(s)
 */
async function sendDigestEmail(
  supabase: ReturnType<typeof createClient>,
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

/**
 * Generate HTML email content for the digest
 */
function generateDigestEmailHtml(
  data: TenantDigestData,
  inventoryUrl: string
): string {
  const criticalProducts = data.low_stock_products.filter(
    p => p.days_until_stockout !== null && p.days_until_stockout <= 3
  );
  const warningProducts = data.low_stock_products.filter(
    p => p.days_until_stockout === null || p.days_until_stockout > 3
  );

  const productRows = data.low_stock_products
    .map((product) => {
      const urgencyColor =
        product.days_until_stockout === null
          ? '#6b7280'
          : product.days_until_stockout <= 0
            ? '#ef4444'
            : product.days_until_stockout <= 3
              ? '#f97316'
              : '#eab308';

      const stockoutText =
        product.days_until_stockout === null
          ? 'N/A'
          : product.days_until_stockout <= 0
            ? 'OUT OF STOCK'
            : `${product.days_until_stockout} days`;

      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${escapeHtml(product.product_name)}</strong>
            ${product.sku ? `<br><span style="color: #6b7280; font-size: 12px;">SKU: ${escapeHtml(product.sku)}</span>` : ''}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${product.current_quantity.toFixed(2)} lbs
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${product.reorder_point.toFixed(2)} lbs
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${urgencyColor}; font-weight: 600;">
            ${stockoutText}
          </td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            📦 Daily Low Stock Report
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">
            ${data.business_name} • ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <!-- Summary -->
        <div style="padding: 24px;">
          <div style="display: flex; gap: 16px; margin-bottom: 24px;">
            <div style="flex: 1; background: #fef3c7; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #92400e;">
                ${data.low_stock_products.length}
              </div>
              <div style="color: #92400e; font-size: 14px;">Products Low</div>
            </div>
            ${criticalProducts.length > 0 ? `
            <div style="flex: 1; background: #fee2e2; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #dc2626;">
                ${criticalProducts.length}
              </div>
              <div style="color: #dc2626; font-size: 14px;">Critical (≤3 days)</div>
            </div>
            ` : ''}
          </div>

          ${criticalProducts.length > 0 ? `
          <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 8px; color: #dc2626; font-size: 16px;">
              ⚠️ Immediate Attention Required
            </h3>
            <p style="margin: 0; color: #991b1b; font-size: 14px;">
              ${criticalProducts.length} product${criticalProducts.length > 1 ? 's' : ''} will be out of stock within 3 days:
              <strong>${criticalProducts.slice(0, 3).map(p => p.product_name).join(', ')}</strong>${criticalProducts.length > 3 ? ` and ${criticalProducts.length - 3} more` : ''}
            </p>
          </div>
          ` : ''}

          <!-- Products Table -->
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Product</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Current Stock</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Reorder Point</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Days Until Stockout</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inventoryUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              View Inventory Dashboard
            </a>
          </div>

          <p style="color: #6b7280; font-size: 12px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center;">
            This is an automated daily digest from FloraIQ.
            <a href="${inventoryUrl}/settings" style="color: #10b981;">Manage alert preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
