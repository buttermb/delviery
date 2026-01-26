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
 * Strips all HTML tags from a string, returning plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes a general form input string.
 * Trims whitespace and removes potentially dangerous characters.
 * @param input - The input string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeFormInput(input: string, maxLength?: number): string {
  if (!input) return '';
  let sanitized = input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes an email address.
 * Trims whitespace and converts to lowercase.
 * @param email - The email string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeEmail(email: string, maxLength?: number): string {
  if (!email) return '';
  let sanitized = email.trim().toLowerCase();
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a phone number input.
 * Keeps only digits, plus sign, parentheses, hyphens, and spaces.
 * @param phone - The phone string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizePhoneInput(phone: string, maxLength?: number): string {
  if (!phone) return '';
  let sanitized = phone.trim().replace(/[^\d+\-() ]/g, '');
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a textarea input.
 * Trims whitespace and removes dangerous HTML/script patterns.
 * @param text - The textarea content to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeTextareaInput(text: string, maxLength?: number): string {
  if (!text) return '';
  let sanitized = text
    .trim()
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a URL slug input.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 * @param slug - The slug string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeSlugInput(slug: string, maxLength?: number): string {
  if (!slug) return '';
  let sanitized = slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a coupon code input.
 * Converts to uppercase, removes special characters except hyphens.
 * @param code - The coupon code to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeCouponCode(code: string, maxLength?: number): string {
  if (!code) return '';
  let sanitized = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a SKU input.
 * Converts to uppercase, keeps alphanumeric and hyphens.
 * @param sku - The SKU string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeSkuInput(sku: string, maxLength?: number): string {
  if (!sku) return '';
  let sanitized = sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a URL input.
 * Trims whitespace and removes dangerous protocols.
 * @param url - The URL string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeUrlInput(url: string, maxLength?: number): string {
  if (!url) return '';
  let sanitized = url
    .trim()
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes text while preserving line breaks.
 * @param text - The text to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeWithLineBreaks(text: string, maxLength?: number): string {
  if (!text) return '';
  let sanitized = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
    .replace(/[<>]/g, '');
  
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}

/**
 * Sanitizes a color value (hex or hsl).
 * @param color - The color string to sanitize
 */
export function sanitizeColor(color: string): string {
  if (!color) return '';
  // Allow hex colors (#fff, #ffffff) and hsl/hsla
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  const hslPattern = /^hsla?\(\s*\d+\s*,\s*\d+%?\s*,\s*\d+%?\s*(,\s*[\d.]+)?\s*\)$/;
  
  const trimmed = color.trim();
  if (hexPattern.test(trimmed) || hslPattern.test(trimmed)) {
    return trimmed;
  }
  // Return empty for invalid colors
  return '';
}

/**
 * Safely parses a JSON string with a fallback value.
 * @param json - The JSON string to parse
 * @param fallback - The fallback value if parsing fails
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
