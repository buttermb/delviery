/**
 * HTML sanitization utility
 * Uses DOMPurify for robust XSS prevention on HTML content.
 * Regex-based helpers remain for plain-text escaping and form input.
 */

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
  'pre', 'code', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'small', 'del', 'ins', 'mark',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id',
  'width', 'height', 'style',
];

/**
 * Escapes special HTML characters in a string to prevent XSS.
 * Use this when injecting user-generated plain text into HTML templates
 * (e.g., map popup innerHTML / setHTML calls).
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Strip javascript:/vbscript:/data: from CSS url() values inside style attributes
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
  if (data.attrName === 'style' && data.attrValue) {
    data.attrValue = data.attrValue.replace(
      /url\s*\(\s*['"]?\s*(javascript|vbscript|data)\s*:/gi,
      'url(about:blank'
    );
  }
});

/**
 * Sanitizes HTML content using DOMPurify.
 * Strips dangerous tags (script, iframe, object, etc.), event handlers,
 * and javascript:/data: URIs while preserving safe formatting tags.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

/**
 * Alias for sanitizeHtml - sanitizes basic HTML content.
 */
export const sanitizeBasicHtml = sanitizeHtml;

/**
 * Sanitizes general form input by trimming whitespace and removing dangerous characters.
 * @param input - The string to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeFormInput(input: string, maxLength?: number): string {
  if (!input) return '';
  let result = input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript\s*:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers

  if (maxLength && result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  return result;
}

/**
 * Sanitizes email input.
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  return email
    .trim()
    .toLowerCase()
    .replace(/[<>'"]/g, ''); // Remove potentially dangerous characters
}

/**
 * Sanitizes phone number input.
 */
export function sanitizePhoneInput(phone: string): string {
  if (!phone) return '';
  // Allow only digits, spaces, parentheses, hyphens, and plus sign
  return phone.trim().replace(/[^0-9\s()\-+]/g, '');
}

/**
 * Sanitizes textarea input (multi-line text).
 * @param text - The text to sanitize
 * @param maxLength - Optional maximum length to truncate to
 */
export function sanitizeTextareaInput(text: string, maxLength?: number): string {
  if (!text) return '';
  let result = text
    .trim()
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, ''); // Remove event handlers

  if (maxLength && result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  return result;
}

/**
 * Sanitizes coupon code input - uppercase alphanumeric with limited special chars.
 */
export function sanitizeCouponCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, ''); // Only allow alphanumeric, dash, underscore
}

/**
 * Sanitizes SKU input - alphanumeric with limited special chars.
 */
export function sanitizeSkuInput(sku: string): string {
  if (!sku) return '';
  return sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_]/g, ''); // Only allow alphanumeric, dash, underscore
}

/**
 * Sanitizes slug input - lowercase alphanumeric with dashes.
 */
export function sanitizeSlugInput(slug: string): string {
  if (!slug) return '';
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '') // Only allow lowercase alphanumeric and dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading/trailing dashes
}

/**
 * Sanitizes color input - validates hex color format.
 */
export function sanitizeColor(color: string): string {
  if (!color) return '';
  const trimmed = color.trim();
  // Match hex colors with 3, 6, or 8 characters (with or without #)
  const hexMatch = trimmed.match(/^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
  if (hexMatch) {
    return `#${hexMatch[1].toLowerCase()}`;
  }
  // Match rgb/rgba format
  if (/^rgba?\s*\([^)]+\)$/i.test(trimmed)) {
    return trimmed;
  }
  // Match named colors (basic validation)
  if (/^[a-zA-Z]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return '';
}

/**
 * Sanitizes text and converts newlines to <br> tags for HTML display.
 * Removes dangerous HTML but preserves line breaks.
 */
export function sanitizeWithLineBreaks(text: string): string {
  if (!text) return '';
  // First sanitize the input
  const sanitized = sanitizeHtml(text);
  // Convert newlines to <br> tags
  return sanitized.replace(/\n/g, '<br />');
}

/**
 * Sanitizes URL input - removes dangerous protocols.
 */
export function sanitizeUrlInput(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  // Block dangerous protocols
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    return '';
  }
  // Ensure URL is properly formatted
  try {
    // If it starts with http/https, validate it
    if (/^https?:\/\//i.test(trimmed)) {
      new URL(trimmed);
      return trimmed;
    }
    // If it's a relative URL starting with /, allow it
    if (trimmed.startsWith('/')) {
      return trimmed.replace(/[<>"']/g, '');
    }
    // Otherwise, prepend https://
    const withProtocol = `https://${trimmed}`;
    new URL(withProtocol);
    return withProtocol;
  } catch {
    // If URL is invalid, remove dangerous characters and return
    return trimmed.replace(/[<>"']/g, '');
  }
}

/**
 * Safely parse JSON with a default fallback value.
 * Returns the parsed value or the default if parsing fails or input is null/empty.
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;

  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
