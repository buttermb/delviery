// Low Stock Email Digest — HTML Email Template

import type { TenantDigestData } from './types.ts';

/**
 * Generate HTML email content for the digest
 */
export function generateDigestEmailHtml(
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
