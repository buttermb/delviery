/**
 * Error Handling Utilities Tests
 * Tests for error parsing and handling utilities
 */

import { describe, it, expect } from 'vitest';
import { parseError } from '@/utils/errorHandling';

describe('parseError', () => {
  it('should handle network errors', () => {
    const error = new TypeError('Failed to fetch');
    const result = parseError(error);

    expect(result.title).toBe('Connection Error');
    expect(result.description).toBeTruthy();
  });

  it('should handle JWT errors', () => {
    const error = { message: 'JWT expired' };
    const result = parseError(error);

    expect(result.title).toBe('Session Expired');
    expect(result.action).toBeDefined();
  });

  it('should handle duplicate errors', () => {
    const error = { message: 'duplicate key value violates unique constraint' };
    const result = parseError(error);

    expect(result.title).toBe('Duplicate Entry');
  });

  it('should handle foreign key errors', () => {
    const error = { message: 'violates foreign key constraint' };
    const result = parseError(error);

    expect(result.title).toBe('Invalid Reference');
  });

  it('should handle unknown errors', () => {
    const error = { message: 'Unknown error occurred' };
    const result = parseError(error);

    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });

  it('should handle Error objects', () => {
    const error = new Error('Test error');
    const result = parseError(error);

    expect(result.title).toBeTruthy();
  });
});










