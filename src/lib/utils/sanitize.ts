/**
 * HTML Sanitization utilities using DOMPurify
 *
 * CRITICAL: Always sanitize user-generated or database content
 * before rendering with dangerouslySetInnerHTML
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for any content that will be rendered with dangerouslySetInnerHTML
 *
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string, options?: DOMPurify.Config): string {
  if (!html) return '';

  // Default configuration: allow safe HTML tags and attributes
  const defaultConfig: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'em', 'strong', 'u', 's', 'strike',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'blockquote', 'pre', 'code',
      'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id',
      'src', 'alt', 'width', 'height',
      // Note: 'style' is intentionally excluded to prevent CSS injection attacks
    ],
    // Prevent javascript: URLs
    ALLOW_DATA_ATTR: false,
    // Add rel="noopener noreferrer" to links
    ADD_ATTR: ['target'],
    // Remove script and event handler attributes
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur', 'style'],
  };

  return DOMPurify.sanitize(html, { ...defaultConfig, ...options });
}

/**
 * Sanitize simple text content (for single-line inputs without HTML)
 * Removes all HTML tags and limits length
 *
 * @param text - The text to sanitize
 * @param maxLength - Maximum allowed length (default 255)
 * @returns Plain text without HTML
 */
export function sanitizeText(text: string, maxLength: number = 255): string {
  if (!text) return '';

  // Remove all HTML tags
  const stripped = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });

  return stripped.trim().slice(0, maxLength);
}

/**
 * Sanitize content for basic formatting (only br and line breaks allowed)
 * Useful for text that should allow line breaks but no other formatting
 *
 * @param text - The text to sanitize
 * @returns Text with only br tags allowed
 */
export function sanitizeWithLineBreaks(text: string): string {
  if (!text) return '';

  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['br'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize URL to prevent javascript: and data: URL attacks
 *
 * @param url - The URL to validate
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim().toLowerCase();

  // Block dangerous URL schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '';
  }

  // Validate URL format
  try {
    const parsed = new URL(url, window.location.origin);
    // Only allow http, https, mailto, and tel protocols
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return '';
    }
    return url;
  } catch {
    // If URL parsing fails, it might be a relative URL
    // Check if it starts with / or is a valid relative path
    if (url.startsWith('/') || url.startsWith('#') || url.startsWith('.')) {
      return url;
    }
    return '';
  }
}

/**
 * Escape HTML entities for displaying as text
 * Use when you want to display HTML code as visible text
 *
 * @param text - Text potentially containing HTML
 * @returns Escaped text safe for display
 */
export function escapeHtml(text: string): string {
  if (!text) return '';

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Sanitize CSS color values to prevent CSS injection
 * Only allows valid hex colors, rgb/rgba values, and named colors
 *
 * @param color - The color value to validate
 * @returns Safe color value or default
 */
export function sanitizeColor(color: string, defaultColor: string = '#000000'): string {
  if (!color) return defaultColor;

  const trimmed = color.trim();

  // Allow hex colors
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return trimmed;
  }

  // Allow rgb/rgba
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed;
  }

  // Allow hsl/hsla
  if (/^hsla?\(\s*\d{1,3}\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+)?\s*\)$/.test(trimmed)) {
    return trimmed;
  }

  // Allow common named colors
  const namedColors = [
    'transparent', 'currentcolor', 'inherit',
    'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
    'gray', 'grey', 'pink', 'brown', 'cyan', 'magenta', 'lime', 'olive',
    'navy', 'teal', 'aqua', 'fuchsia', 'maroon', 'silver'
  ];

  if (namedColors.includes(trimmed.toLowerCase())) {
    return trimmed;
  }

  return defaultColor;
}

/**
 * Safe JSON parse with error handling
 * Returns default value if parsing fails
 *
 * @param json - JSON string to parse
 * @param defaultValue - Value to return if parsing fails
 * @returns Parsed value or default
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;

  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}
