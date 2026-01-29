/**
 * HTML sanitization utility
 * Strips potentially dangerous HTML tags and attributes to prevent XSS
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
  'pre', 'code', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'small', 'del', 'ins', 'mark',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id',
  'width', 'height', 'style',
]);

const DANGEROUS_PATTERNS = [
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /data\s*:/gi,
  /vbscript\s*:/gi,
];

/**
 * Sanitizes HTML content by removing dangerous tags and attributes.
 * Allows safe formatting tags while stripping script injection vectors.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let sanitized = html;

  // Remove script/style/iframe tags entirely (including content)
  sanitized = sanitized.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*>[\s\S]*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, '');

  // Remove event handler attributes (onclick, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: and vbscript: protocols from href/src
  sanitized = sanitized.replace(/(href|src)\s*=\s*(['"])\s*(javascript|vbscript)\s*:[^'"]*\2/gi, '$1=$2#$2');

  // Remove data: URIs from src (potential XSS vector)
  sanitized = sanitized.replace(/src\s*=\s*(['"])\s*data\s*:[^'"]*\1/gi, 'src=$1#$1');

  return sanitized;
}

/**
 * Alias for sanitizeHtml - sanitizes basic HTML content.
 */
export const sanitizeBasicHtml = sanitizeHtml;

/**
 * Sanitizes form input by stripping HTML tags and trimming whitespace.
 * Use for general text inputs that shouldn't contain HTML.
 */
export function sanitizeFormInput(input: string): string {
  if (!input) return '';
  // Strip all HTML tags and trim whitespace
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes and normalizes an email address.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Sanitizes phone input by removing non-digit characters except +, -, (, ), and space.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+\-() ]/g, '').trim();
}

/**
 * Sanitizes textarea input - allows newlines but strips HTML tags.
 */
export function sanitizeTextareaInput(input: string): string {
  if (!input) return '';
  // Strip all HTML tags but preserve newlines
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes coupon code - uppercase, alphanumeric and dashes only.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
}

/**
 * Sanitizes SKU input - alphanumeric, dashes, and underscores only.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku.toUpperCase().replace(/[^A-Z0-9\-_]/g, '').trim();
}

/**
 * Sanitizes color input - ensures valid hex color format.
 */
export function sanitizeColor(color: string): string {
  if (!color) return '';
  // Remove any non-hex characters and ensure it starts with #
  const cleaned = color.replace(/[^#0-9a-fA-F]/g, '');
  if (cleaned.startsWith('#')) {
    return cleaned.slice(0, 7); // #RRGGBB format
  }
  return '#' + cleaned.slice(0, 6);
}

/**
 * Sanitizes text while converting newlines to <br> tags for HTML display.
 * Strips all other HTML tags for safety.
 */
export function sanitizeWithLineBreaks(input: string): string {
  if (!input) return '';
  // First strip all HTML tags
  const stripped = input.replace(/<[^>]*>/g, '');
  // Then convert newlines to <br> tags
  return stripped.replace(/\n/g, '<br>');
}

/**
 * Sanitizes URL input - ensures valid URL format.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Remove javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Sanitizes slug input - lowercase, alphanumeric and dashes only.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

/**
 * Sanitizes error messages for display - strips sensitive info.
 */
export function sanitizeError(error: unknown): string {
  if (!error) return 'An unknown error occurred';
  if (typeof error === 'string') {
    // Strip any potential sensitive data patterns
    return error.replace(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi, '[id]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      .trim();
  }
  if (error instanceof Error) {
    return sanitizeError(error.message);
  }
  return 'An unknown error occurred';
}
