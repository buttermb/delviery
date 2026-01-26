/**
 * HTML sanitization utility
 * Strips potentially dangerous HTML tags and attributes to prevent XSS
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
  'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'href', 'target', 'rel', 'class', 'id',
]);

/**
 * Sanitize HTML string by removing dangerous tags and attributes
 */
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';

  // Use DOMParser to parse the HTML safely
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Skip script, style, and other dangerous tags
    if (!ALLOWED_TAGS.has(tagName)) {
      // Still process children for non-allowed tags (strip the tag but keep content)
      let childContent = '';
      element.childNodes.forEach(child => {
        childContent += sanitizeNode(child);
      });
      return childContent;
    }

    // Build sanitized attributes
    const attrs: string[] = [];
    for (const attr of Array.from(element.attributes)) {
      if (ALLOWED_ATTRIBUTES.has(attr.name)) {
        // Special handling for href to prevent javascript: URLs
        if (attr.name === 'href') {
          const hrefValue = attr.value.trim().toLowerCase();
          if (hrefValue.startsWith('javascript:') || hrefValue.startsWith('data:')) {
            continue;
          }
        }
        attrs.push(`${attr.name}="${escapeAttr(attr.value)}"`);
      }
    }

    // Force target="_blank" links to have rel="noopener noreferrer"
    if (tagName === 'a') {
      if (!attrs.some(a => a.startsWith('rel='))) {
        attrs.push('rel="noopener noreferrer"');
      }
    }

    // Process children
    let childContent = '';
    element.childNodes.forEach(child => {
      childContent += sanitizeNode(child);
    });

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    // Self-closing tags
    if (tagName === 'br') {
      return `<br${attrStr} />`;
    }

    return `<${tagName}${attrStr}>${childContent}</${tagName}>`;
  };

  let result = '';
  doc.body.childNodes.forEach(child => {
    result += sanitizeNode(child);
  });

  return result;
};

/**
 * Escape attribute value to prevent XSS
 */
const escapeAttr = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};
