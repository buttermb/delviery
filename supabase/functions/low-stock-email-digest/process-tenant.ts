// Low Stock Email Digest — Per-Tenant Processing Pipeline

import { createClient } from '../_shared/deps.ts';
import { createLogger } from '../_shared/logger.ts';
import { getLowStockProducts } from './fetch-data.ts';
import { deductCredits, refundCredits } from './credits.ts';
import { sendDigestEmail } from './send-email.ts';
import type { AlertSettings, DigestResult } from './types.ts';

const logger = createLogger('low-stock-email-digest');

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  owner_email: string;
  alert_settings: unknown;
}

export interface DigestSummary {
  emails_sent: number;
  total_products_flagged: number;
  credits_deducted: number;
  skipped_insufficient_credits: number;
}

/**
 * Process a single tenant: check settings, fetch low stock products,
 * deduct credits, send email, and log the audit event.
 * Returns a DigestResult, or null if the tenant was skipped.
 */
export async function processTenant(
  supabase: ReturnType<typeof createClient>,
  tenant: TenantRow,
  summary: DigestSummary,
): Promise<DigestResult | null> {
  // Check if email digest is enabled for this tenant
  const alertSettings = (tenant.alert_settings as AlertSettings) || {};

  // Default to enabled if not explicitly disabled
  if (alertSettings.email_digest_enabled === false) {
    logger.info('Email digest disabled for tenant', {
      tenantId: tenant.id,
      slug: tenant.slug
    });
    return null;
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
    return null;
  }

  summary.total_products_flagged += lowStockProducts.length;

  // Get recipient email(s)
  const recipients = alertSettings.digest_recipients?.length
    ? alertSettings.digest_recipients
    : [tenant.owner_email];

  // Deduct credits before sending email
  const creditResult = await deductCredits(supabase, tenant.id);

  if (!creditResult.success) {
    logger.warn('Insufficient credits for low stock digest', {
      tenantId: tenant.id,
      slug: tenant.slug,
      errorMessage: creditResult.errorMessage,
    });
    summary.skipped_insufficient_credits++;

    return {
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      products_count: lowStockProducts.length,
      email_sent: false,
      error: `Insufficient credits: ${creditResult.errorMessage}`,
    };
  }

  summary.credits_deducted += creditResult.creditsCost;

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
          credits_deducted: creditResult.creditsCost,
          products: lowStockProducts.map(p => ({
            id: p.id,
            name: p.product_name,
            current: p.current_quantity,
            reorder: p.reorder_point,
          })),
        },
      });
  } else {
    // Email send failed — refund the credits
    await refundCredits(
      supabase,
      tenant.id,
      creditResult.creditsCost,
      `Low stock digest email failed: ${emailResult.error}`
    );
    summary.credits_deducted -= creditResult.creditsCost;
  }

  logger.info('Processed tenant digest', {
    tenantId: tenant.id,
    slug: tenant.slug,
    productsCount: lowStockProducts.length,
    emailSent: emailResult.success,
    creditsDeducted: creditResult.creditsCost,
  });

  return {
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    products_count: lowStockProducts.length,
    email_sent: emailResult.success,
    error: emailResult.error,
  };
}
