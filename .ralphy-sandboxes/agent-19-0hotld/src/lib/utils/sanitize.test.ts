/**
 * Security tests for HTML sanitization utilities
 *
 * These tests verify that our DOMPurify-based sanitization functions properly
 * prevent XSS attacks and injection vulnerabilities.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeFormInput as sanitizeText,
  sanitizeWithLineBreaks,
  sanitizeUrlInput as sanitizeUrl,
  escapeHtml,
  sanitizeColor,
  safeJsonParse,
} from './sanitize';

describe('sanitizeHtml (DOMPurify)', () => {
  it('should allow safe HTML tags', () => {
    const input = '<p>Hello <b>world</b></p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<b>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('should remove script tags', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('should remove event handlers', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('should remove onclick handlers', () => {
    const input = '<button onclick="alert(1)">Click me</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
  });

  it('should remove javascript: URLs in href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('should remove iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
  });

  it('should remove object and embed tags', () => {
    const input = '<object data="x"></object><embed src="x">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('should remove form and input tags', () => {
    const input = '<form action="https://evil.com"><input type="text"></form>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('should handle empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('should handle nested malicious content', () => {
    const input = '<div><script>evil()</script><p>Safe content</p></div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('Safe content');
  });

  it('should remove style tags', () => {
    const input = '<style>body { background: url("javascript:alert(1)") }</style>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<style');
  });

  it('should handle SVG-based XSS', () => {
    const input = '<svg onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<svg');
  });

  it('should preserve allowed formatting tags', () => {
    const input = '<div><p>text</p><strong>bold</strong><em>italic</em><a href="https://example.com">link</a></div>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
  });

  it('should preserve img tags with safe attributes', () => {
    const input = '<img src="https://example.com/img.jpg" alt="test" width="100">';
    const result = sanitizeHtml(input);
    expect(result).toContain('<img');
    expect(result).toContain('src="https://example.com/img.jpg"');
    expect(result).toContain('alt="test"');
  });

  it('should strip data attributes', () => {
    const input = '<div data-evil="payload">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data-evil');
    expect(result).toContain('text');
  });
});

describe('sanitizeText', () => {
  it('should remove all HTML tags', () => {
    const input = '<p>Hello <b>world</b></p>';
    const result = sanitizeText(input);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('should limit length', () => {
    const input = 'a'.repeat(300);
    const result = sanitizeText(input, 100);
    expect(result.length).toBe(100);
  });

  it('should trim whitespace', () => {
    const input = '  hello world  ';
    const result = sanitizeText(input);
    expect(result).toBe('hello world');
  });

  it('should handle empty input', () => {
    expect(sanitizeText('')).toBe('');
  });
});

describe('sanitizeWithLineBreaks', () => {
  it('should preserve line breaks as br tags', () => {
    const input = 'Hello\nWorld';
    const result = sanitizeWithLineBreaks(input);
    expect(result).toContain('<br />');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should remove script tags', () => {
    const input = 'Hello<script>alert(1)</script>\nWorld';
    const result = sanitizeWithLineBreaks(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('Hello');
    expect(result).toContain('World');
  });

  it('should handle empty input', () => {
    expect(sanitizeWithLineBreaks('')).toBe('');
  });
});

describe('sanitizeUrl', () => {
  it('should allow https URLs', () => {
    const input = 'https://example.com/path';
    expect(sanitizeUrl(input)).toBe(input);
  });

  it('should allow http URLs', () => {
    const input = 'http://example.com/path';
    expect(sanitizeUrl(input)).toBe(input);
  });

  it('should allow relative URLs', () => {
    expect(sanitizeUrl('/path/to/page')).toBe('/path/to/page');
  });

  it('should block javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
  });

  it('should block data: URLs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('should block vbscript: URLs', () => {
    expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
  });

  it('should handle empty input', () => {
    expect(sanitizeUrl('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    const input = '<script>alert("test")</script>';
    const result = escapeHtml(input);
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it('should handle empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitizeColor', () => {
  it('should allow valid hex colors', () => {
    expect(sanitizeColor('#fff')).toBe('#fff');
    expect(sanitizeColor('#ffffff')).toBe('#ffffff');
  });

  it('should allow rgb colors', () => {
    expect(sanitizeColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
  });

  it('should allow rgba colors', () => {
    expect(sanitizeColor('rgba(255, 0, 0, 0.5)')).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('should allow named colors', () => {
    expect(sanitizeColor('red')).toBe('red');
    expect(sanitizeColor('transparent')).toBe('transparent');
  });

  it('should handle empty input', () => {
    expect(sanitizeColor('')).toBe('');
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"key": "value"}', {})).toEqual({ key: 'value' });
    expect(safeJsonParse('[1, 2, 3]', [])).toEqual([1, 2, 3]);
  });

  it('should return default for invalid JSON', () => {
    expect(safeJsonParse('invalid json', {})).toEqual({});
  });

  it('should return default for null input', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
  });

  it('should return default for empty string', () => {
    expect(safeJsonParse('', {})).toEqual({});
  });
});

describe('XSS Attack Vectors', () => {
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '<body onload=alert(1)>',
    '<iframe src="javascript:alert(1)">',
    '<input onfocus=alert(1) autofocus>',
    '<marquee onstart=alert(1)>',
    '<video><source onerror=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '"><script>alert(1)</script>',
    '<a href="javascript:alert(1)">click</a>',
    '<a href="data:text/html,<script>alert(1)</script>">click</a>',
    '<div style="background:url(javascript:alert(1))">',
    '<base href="javascript:alert(1)">',
    '<object data="javascript:alert(1)">',
    '<embed src="javascript:alert(1)">',
  ];

  it.each(xssPayloads)('should neutralize XSS payload: %s', (payload) => {
    const result = sanitizeHtml(payload);
    // No event handlers should survive
    expect(result).not.toMatch(/on\w+\s*=/i);
    // No script tags should survive
    expect(result).not.toContain('<script');
    // No javascript: protocol should survive
    expect(result).not.toContain('javascript:');
    // No dangerous tags should survive
    expect(result).not.toContain('<iframe');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
    expect(result).not.toContain('<svg');
  });

  it.each(xssPayloads)('sanitizeText should neutralize: %s', (payload) => {
    const result = sanitizeText(payload);
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
  });
});
