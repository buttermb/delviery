/**
 * Utility functions for HTML escaping, formatting, CSS sanitization,
 * and color detection used by the menu page renderer.
 */

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '';
  return `$${price.toFixed(2)}`;
}

/**
 * Sanitize a CSS value to prevent CSS injection and XSS.
 * Strips dangerous patterns: closing style tags, script injection,
 * expression(), javascript: urls, @import, behavior:, etc.
 */
export function sanitizeCssValue(value: string): string {
  if (typeof value !== 'string') return '';
  return value
    // Strip anything that could close a style tag or inject scripts
    .replace(/<\/?style[^>]*>/gi, '')
    .replace(/<\/?script[^>]*>/gi, '')
    // Remove expression() (IE CSS expression)
    .replace(/expression\s*\(/gi, '')
    // Remove javascript: and data: in url()
    .replace(/url\s*\(\s*['"]?\s*(?:javascript|data)\s*:/gi, 'url(blocked:')
    // Remove @import
    .replace(/@import/gi, '')
    // Remove behavior: (IE behavior property)
    .replace(/behavior\s*:/gi, '')
    // Remove -moz-binding (Firefox XBL)
    .replace(/-moz-binding\s*:/gi, '')
    // Strip any remaining angle brackets as safety net
    .replace(/[<>]/g, '');
}

/**
 * Sanitize a ColorConfig, ensuring each value is a safe CSS color string.
 * Only allows hex colors, rgb/rgba/hsl/hsla functions, and named colors.
 */
export function sanitizeColors(colors: ColorConfig): ColorConfig {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    sanitized[key] = sanitizeCssValue(value);
  }
  return sanitized as unknown as ColorConfig;
}

/**
 * Check if a menu is expired based on expiration_date and never_expires.
 */
export function isMenuExpired(expirationDate: string | null, neverExpires: boolean): boolean {
  if (neverExpires) return false;
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}

/** Simple check if a hex color is dark (for adaptive text colors). */
export function isColorDark(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return false;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
}

export interface ColorConfig {
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
  border: string;
}

export const DEFAULT_COLORS: ColorConfig = {
  bg: '#f8f9fa',
  text: '#1a1a2e',
  accent: '#059669',
  cardBg: '#ffffff',
  border: '#e5e7eb',
};

export interface AppearanceSettings {
  colors?: Partial<ColorConfig>;
  show_prices?: boolean;
  show_descriptions?: boolean;
  contact_info?: string;
}

export interface ProductData {
  name: string;
  price: number;
  description: string;
  image_url: string;
  category: string;
}
