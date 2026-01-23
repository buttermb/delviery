/**
 * HTML Sanitization Utility
 *
 * Provides safe HTML rendering by stripping dangerous tags and attributes
 * while preserving safe formatting elements.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
  'pre', 'code', 'hr', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'sup', 'sub', 'del', 'ins', 'mark', 'small', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'section', 'article', 'header', 'footer',
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  span: new Set(['class', 'style']),
  div: new Set(['class', 'style']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  '*': new Set(['class', 'id']),
};

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

/**
 * Sanitize HTML string by removing dangerous elements and attributes.
 * This is a lightweight sanitizer for user-provided HTML content.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  // Create a DOM parser to parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function sanitizeNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Remove disallowed tags but keep their text content
    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(element.childNodes)) {
        const sanitized = sanitizeNode(child);
        if (sanitized) {
          fragment.appendChild(sanitized);
        }
      }
      return fragment;
    }

    // Clone the element without attributes
    const cleanElement = document.createElement(tagName);

    // Copy only allowed attributes
    const allowedForTag = ALLOWED_ATTRIBUTES[tagName] || new Set<string>();
    const globalAllowed = ALLOWED_ATTRIBUTES['*'] || new Set<string>();

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (allowedForTag.has(attrName) || globalAllowed.has(attrName)) {
        let value = attr.value;

        // Check for dangerous protocols in href/src
        if ((attrName === 'href' || attrName === 'src') && DANGEROUS_PROTOCOLS.test(value.trim())) {
          continue;
        }

        // Force safe target/rel for links
        if (tagName === 'a' && attrName === 'href') {
          cleanElement.setAttribute('rel', 'noopener noreferrer');
          cleanElement.setAttribute('target', '_blank');
        }

        // Strip style attributes that could be dangerous
        if (attrName === 'style') {
          value = sanitizeStyle(value);
        }

        cleanElement.setAttribute(attrName, value);
      }
    }

    // Recursively sanitize children
    for (const child of Array.from(element.childNodes)) {
      const sanitized = sanitizeNode(child);
      if (sanitized) {
        cleanElement.appendChild(sanitized);
      }
    }

    return cleanElement;
  }

  const fragment = document.createDocumentFragment();
  for (const child of Array.from(doc.body.childNodes)) {
    const sanitized = sanitizeNode(child);
    if (sanitized) {
      fragment.appendChild(sanitized);
    }
  }

  const div = document.createElement('div');
  div.appendChild(fragment);
  return div.innerHTML;
}

/**
 * Sanitize inline CSS style values, removing potentially dangerous properties.
 */
function sanitizeStyle(style: string): string {
  const dangerousProperties = /expression|url|import|@/gi;
  if (dangerousProperties.test(style)) {
    return '';
  }

  const allowedProperties = new Set([
    'color', 'background-color', 'font-size', 'font-weight', 'font-style',
    'text-align', 'text-decoration', 'margin', 'padding', 'border',
    'width', 'height', 'max-width', 'max-height', 'display',
    'line-height', 'letter-spacing', 'opacity',
  ]);

  return style
    .split(';')
    .filter(rule => {
      const property = rule.split(':')[0]?.trim().toLowerCase();
      return property && allowedProperties.has(property);
    })
    .join(';');
}
