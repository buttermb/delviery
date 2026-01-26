/**
 * HTML Sanitization Utility
 * Prevents XSS by stripping dangerous HTML content
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div',
  'blockquote', 'pre', 'code', 'hr',
]);

const ALLOWED_ATTRIBUTES = new Set(['href', 'target', 'rel', 'class']);

/**
 * Sanitize HTML string by removing dangerous tags and attributes.
 * Allows only safe formatting tags for rendering product descriptions.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="');

  // Remove data: URLs in href/src (potential XSS vector)
  sanitized = sanitized.replace(/(href|src)\s*=\s*["']?\s*data:/gi, '$1="');

  // Remove iframe, object, embed, form tags
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|form|input|textarea|button|select)\b[^>]*>/gi, '');

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove meta, link, base tags
  sanitized = sanitized.replace(/<\/?(meta|link|base)\b[^>]*>/gi, '');

  // Strip disallowed attributes from remaining tags
  sanitized = sanitized.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) {
      return '';
    }

    // Filter attributes
    const cleanAttrs = (attrs as string).replace(/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g, (attrMatch, name) => {
      if (ALLOWED_ATTRIBUTES.has(name.toLowerCase())) {
        return attrMatch;
      }
      return '';
    }).trim();

    return cleanAttrs ? `<${tag} ${cleanAttrs}>` : `<${tag}>`;
  });

  // Remove closing tags for disallowed elements
  sanitized = sanitized.replace(/<\/(\w+)>/g, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
  });

  return sanitized.trim();
}
