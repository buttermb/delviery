/**
 * Message templates for credit threshold alert notifications:
 * in-app titles/messages, email subjects/HTML, and SMS messages.
 */

export function getNotificationTitle(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '🚨 Credits Depleted!';
    case 'urgent':
      return '⚠️ Credits Almost Gone!';
    case 'critical':
      return '⚠️ Credits Running Very Low';
    case 'warning':
      return '⚡ Credits Running Low';
    default:
      return '💡 Credit Balance Update';
  }
}

export function getNotificationMessage(severity: string, balance: number): string {
  switch (severity) {
    case 'depleted':
      return `You've run out of credits. Some features are now unavailable. Upgrade for unlimited access, or purchase more credits.`;
    case 'urgent':
      return `Only ${balance} credits left! Actions may be blocked soon. Upgrade now for unlimited access.`;
    case 'critical':
      return `You have ${balance} credits remaining. Consider upgrading to a subscription for unlimited access.`;
    case 'warning':
      return `You have ${balance} credits remaining. Your credits will refresh soon, or upgrade for unlimited access.`;
    default:
      return `You have ${balance} credits remaining.`;
  }
}

export function getEmailSubject(severity: string): string {
  switch (severity) {
    case 'depleted':
      return '[Action Required] Your credits have run out';
    case 'urgent':
      return '[Urgent] Almost out of credits!';
    case 'critical':
      return '[Warning] Your credits are almost gone';
    case 'warning':
      return 'Your credit balance is running low';
    default:
      return 'Credit balance update';
  }
}

export function getEmailHtml(severity: string, balance: number, tenantSlug: string): string {
  const appUrl = Deno.env.get('APP_URL') || 'https://app.bigmikewholesale.com';
  const upgradeUrl = `${appUrl}/${tenantSlug}/admin/select-plan`;
  const billingUrl = `${appUrl}/${tenantSlug}/admin/settings/billing`;

  const urgencyColor = severity === 'depleted' || severity === 'urgent'
    ? '#ef4444'
    : severity === 'critical'
    ? '#f97316'
    : '#eab308';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background: ${urgencyColor}; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ${severity === 'depleted' ? '🚨' : '⚠️'} Credit Alert
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px;">
          <p style="font-size: 18px; color: #333; margin: 0 0 16px;">
            ${getNotificationMessage(severity, balance)}
          </p>

          <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <div style="text-align: center;">
              <span style="font-size: 48px; font-weight: bold; color: ${urgencyColor};">
                ${balance.toLocaleString()}
              </span>
              <p style="color: #666; margin: 8px 0 0;">credits remaining</p>
            </div>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${upgradeUrl}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Upgrade for Unlimited Access
            </a>
            <p style="margin: 16px 0 0;">
              <a href="${billingUrl}" style="color: #666; text-decoration: underline;">Or buy more credits</a>
            </p>
          </div>

          <p style="color: #666; font-size: 14px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #eee;">
            ${severity === 'depleted' || severity === 'urgent'
              ? 'Some features may be unavailable until you add more credits or upgrade your plan.'
              : 'Avoid interruptions by upgrading to a paid plan with unlimited usage.'}
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center;">
          <p style="color: #999; font-size: 12px; margin: 0;">
            You're receiving this because you're on the free tier of BigMike Wholesale.
            <br>
            <a href="${billingUrl}" style="color: #666;">Manage alert preferences</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function getSmsMessage(severity: string, balance: number): string {
  switch (severity) {
    case 'depleted':
      return `[BigMike] You're out of credits! Features are limited. Upgrade now: ${Deno.env.get('APP_URL')}/select-plan`;
    case 'urgent':
      return `[BigMike] Only ${balance} credits left! Upgrade for unlimited: ${Deno.env.get('APP_URL')}/select-plan`;
    default:
      return `[BigMike] Credit alert: ${balance} credits remaining. Top up: ${Deno.env.get('APP_URL')}/billing`;
  }
}
