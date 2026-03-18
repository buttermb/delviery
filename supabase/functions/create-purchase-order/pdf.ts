/**
 * Generate an HTML document for a Purchase Order.
 * This HTML is uploaded to Supabase Storage and can be printed/downloaded as a PDF.
 */

interface PurchaseOrderPdfData {
  poNumber: string;
  businessName: string;
  supplierName: string;
  supplierContact: string;
  supplierAddress: string;
  items: Array<{
    product_name: string;
    quantity_lbs: number;
    quantity_units: number;
    price_per_lb: number;
    subtotal: number;
  }>;
  totalAmount: number;
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function generatePurchaseOrderHtml(data: PurchaseOrderPdfData): string {
  const {
    poNumber,
    businessName,
    supplierName,
    supplierContact,
    supplierAddress,
    items,
    totalAmount,
    deliveryDate,
    notes,
    createdAt,
  } = data;

  const itemRows = items
    .map(
      (item, idx) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${item.product_name}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity_lbs.toFixed(2)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${item.quantity_units}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.price_per_lb)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatCurrency(item.subtotal)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Purchase Order ${poNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 20px; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: #fff;
    }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">
    <div>
      <h1 style="margin: 0 0 4px 0; font-size: 28px; color: #111827;">PURCHASE ORDER</h1>
      <p style="margin: 0; font-size: 16px; color: #6b7280;">${poNumber}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 0; font-weight: 600; font-size: 18px; color: #111827;">${businessName}</p>
      <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">Date: ${formatDate(createdAt)}</p>
    </div>
  </div>

  <div style="display: flex; gap: 40px; margin-bottom: 32px; padding: 20px; background: #f9fafb; border-radius: 8px;">
    <div>
      <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; font-weight: 600;">Supplier</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${supplierName}</p>
      ${supplierContact ? `<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 14px;">${supplierContact}</p>` : ''}
      ${supplierAddress ? `<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 14px;">${supplierAddress}</p>` : ''}
    </div>
    ${deliveryDate ? `
    <div>
      <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; font-weight: 600;">Expected Delivery</p>
      <p style="margin: 0; font-weight: 600; color: #111827;">${formatDate(deliveryDate)}</p>
    </div>` : ''}
    <div>
      <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; font-weight: 600;">Status</p>
      <p style="margin: 0; font-weight: 600; color: #f59e0b;">Pending</p>
    </div>
  </div>

  <table style="margin-bottom: 24px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600;">#</th>
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600;">Product</th>
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; text-align: right;">Qty (lbs)</th>
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; text-align: right;">Units</th>
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; text-align: right;">Price/lb</th>
        <th style="padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; text-align: right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 32px;">
    <div style="width: 280px; border-top: 2px solid #111827; padding-top: 12px;">
      <div style="display: flex; justify-content: space-between; padding: 4px 0;">
        <span style="color: #6b7280;">Items:</span>
        <span>${items.length}</span>
      </div>
      <div style="display: flex; justify-content: space-between; padding: 8px 0; font-size: 20px; font-weight: 700; color: #111827;">
        <span>Total:</span>
        <span>${formatCurrency(totalAmount)}</span>
      </div>
    </div>
  </div>

  ${notes ? `
  <div style="margin-bottom: 32px; padding: 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0;">
    <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #92400e; font-weight: 600;">Notes</p>
    <p style="margin: 0; color: #78350f;">${notes}</p>
  </div>` : ''}

  <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center;">
    Generated by ${businessName} &middot; ${formatDate(createdAt)}
  </div>
</body>
</html>`;
}
