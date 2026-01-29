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
 * Sanitizes form input by trimming whitespace and removing dangerous characters.
 */
export function sanitizeFormInput(input: string): string {
  if (!input) return '';
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Sanitizes email input by trimming and lowercasing.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Sanitizes phone number input by removing non-numeric characters except + and -.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  return phone.trim().replace(/[^0-9+\-\s()]/g, '');
}

/**
 * Sanitizes textarea input by trimming and removing HTML tags.
 */
export function sanitizeTextareaInput(text: string): string {
  if (!text) return '';
  return text.trim().replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes coupon codes by trimming, uppercasing, and removing invalid characters.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
}

/**
 * Sanitizes text while preserving line breaks - useful for display content.
 */
export function sanitizeWithLineBreaks(text: string): string {
  if (!text) return '';
  // Remove dangerous HTML but preserve newlines
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Sanitizes URL input by trimming and validating URL format.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Basic URL validation - must start with http:// or https://
  if (trimmed && !trimmed.match(/^https?:\/\//i)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Sanitizes slug input for use in URLs.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Sanitizes SKU input by trimming and uppercasing.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku.trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '');
}

/**
 * Sanitizes color input to ensure valid hex or CSS color values.
 */
export function sanitizeColor(color: string): string {
  if (!color) return '';
  const trimmed = color.trim();
  // Check for valid hex color
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) {
    return trimmed;
  }
  // Check for valid rgb/rgba/hsl/hsla
  if (/^(rgb|rgba|hsl|hsla)\([^)]+\)$/i.test(trimmed)) {
    return trimmed;
  }
  // Check for valid CSS color name (basic validation)
  if (/^[a-z]+$/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}
