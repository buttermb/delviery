/**
 * HTML templates for error pages and access code prompt page.
 * The full menu page template lives in menu-page-template.ts.
 */

import { escapeHtml } from './utils.ts';

// Re-export buildMenuPage from its dedicated module
export { buildMenuPage } from './menu-page-template.ts';
export type { BuildMenuPageOptions } from './menu-page-template.ts';

/**
 * Build an access code prompt page for menus that require an access code.
 */
export function buildAccessCodePage(title: string, errorMessage?: string): string {
  const errorHtml = errorMessage
    ? `<p class="error-msg">${escapeHtml(errorMessage)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Access Code Required - ${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8f9fa; color: #374151;
    }
    .access-box { text-align: center; padding: 48px 24px; max-width: 400px; width: 100%; }
    .access-box h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .access-box p { font-size: 14px; color: #6b7280; margin-bottom: 20px; }
    .error-msg { color: #dc2626; font-size: 13px; margin-bottom: 12px; }
    form { display: flex; flex-direction: column; gap: 12px; align-items: center; }
    input[type="text"] {
      padding: 10px 14px; font-size: 16px; border: 1px solid #d1d5db;
      border-radius: 8px; width: 100%; max-width: 260px; text-align: center;
      letter-spacing: 0.1em;
    }
    button {
      padding: 10px 24px; font-size: 14px; font-weight: 600;
      background: #059669; color: #fff; border: none; border-radius: 8px;
      cursor: pointer;
    }
    button:hover { background: #047857; }
  </style>
</head>
<body>
  <div class="access-box">
    <h1>Access Code Required</h1>
    <p>Enter the access code to view this menu.</p>
    ${errorHtml}
    <form method="GET">
      <input type="text" name="code" placeholder="Enter access code" autocomplete="off" required />
      <input type="hidden" name="token" value="" id="tokenField" />
      <button type="submit">View Menu</button>
    </form>
    <script>
      (function() {
        var params = new URLSearchParams(window.location.search);
        document.getElementById('tokenField').value = params.get('token') || '';
      })();
    </script>
  </div>
</body>
</html>`;
}

export function buildErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; margin: 0; background: #f8f9fa; color: #374151;
    }
    .error-box { text-align: center; padding: 48px 24px; }
    .error-box h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #111827; }
    .error-box p { font-size: 15px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="error-box">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}
