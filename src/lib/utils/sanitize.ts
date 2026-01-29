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
 * Sanitizes form input by escaping HTML entities and trimming whitespace.
 * Use for general text inputs that should not contain HTML.
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
 * Sanitizes email input by trimming, lowercasing, and removing invalid characters.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '');
}

/**
 * Sanitizes phone input by removing non-numeric characters except +, -, (, ), and space.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  return phone
    .trim()
    .replace(/[^0-9+\-() ]/g, '');
}

/**
 * Sanitizes textarea input by escaping HTML entities while preserving newlines.
 */
export function sanitizeTextareaInput(input: string): string {
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
 * Sanitizes coupon code by uppercasing and removing invalid characters.
 * Only allows alphanumeric characters and hyphens/underscores.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

/**
 * Sanitizes text while preserving line breaks.
 * Escapes HTML entities and converts newlines to <br> tags.
 */
export function sanitizeWithLineBreaks(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\n/g, '<br>');
}

/**
 * Sanitizes URL input by trimming whitespace and ensuring valid URL characters.
 * Removes javascript: and data: protocols.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Block dangerous protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Sanitizes SKU input by uppercasing and removing invalid characters.
 * Only allows alphanumeric characters, hyphens, and underscores.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

/**
 * Sanitizes slug input by lowercasing and replacing spaces with hyphens.
 * Only allows alphanumeric characters and hyphens.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
