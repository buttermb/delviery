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
 * Sanitizes form input by trimming whitespace and escaping HTML entities.
 */
export function sanitizeFormInput(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitizes email input - trims and converts to lowercase.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

/**
 * Sanitizes phone input - removes non-digit characters except + for country code.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  // Keep only digits, +, -, (, ), and spaces
  return phone.trim().replace(/[^\d+\-() ]/g, '');
}

/**
 * Sanitizes textarea input - trims and escapes HTML entities.
 */
export function sanitizeTextareaInput(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Sanitizes coupon code - trims, converts to uppercase, removes special characters.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Sanitizes text while preserving line breaks as HTML.
 * Converts \n to <br> tags after sanitizing other HTML.
 */
export function sanitizeWithLineBreaks(text: string): string {
  if (!text) return '';
  const sanitized = sanitizeFormInput(text);
  return sanitized.replace(/\n/g, '<br>');
}

/**
 * Sanitizes URL input - validates and sanitizes URL format.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // Block javascript: and data: protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

/**
 * Sanitizes SKU input - trims, converts to uppercase, allows alphanumeric and dashes.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, '');
}

/**
 * Sanitizes slug input - trims, converts to lowercase, replaces spaces with dashes.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');
}

/**
 * Sanitizes color input - validates hex color format.
 */
export function sanitizeColor(color: string): string {
  if (!color) return '';
  const trimmed = color.trim();

  // Validate hex color format
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return trimmed;
}
