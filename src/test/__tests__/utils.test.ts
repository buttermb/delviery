/**
 * Utility Functions Tests
 * Example tests for utility functions
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should handle empty strings', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });
});




