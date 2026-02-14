import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('warn', () => {
    it('should always log warning messages', () => {
      logger.warn('Test warning message', { reason: 'test' });

      expect(console.warn).toHaveBeenCalledWith(
        '[WARN] Test warning message',
        { reason: 'test' },
        ''
      );
    });

    it('should log warning messages with context', () => {
      logger.warn('Test warning', null, { component: 'Test' });

      expect(console.warn).toHaveBeenCalledWith(
        '[WARN] Test warning',
        null,
        { component: 'Test' }
      );
    });
  });

  describe('error', () => {
    it('should always log error messages', () => {
      const error = new Error('Test error');

      logger.error('Something went wrong', error);

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Something went wrong',
        { message: 'Test error', stack: error.stack, name: 'Error' },
        ''
      );
    });

    it('should handle non-Error objects', () => {
      logger.error('Something went wrong', { code: 500 });

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Something went wrong',
        { code: 500 },
        ''
      );
    });

    it('should handle null error gracefully', () => {
      logger.error('Error without details');

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Error without details',
        '',
        ''
      );
    });

    it('should log error messages with context', () => {
      logger.error('Failed operation', null, { userId: '123' });

      expect(console.error).toHaveBeenCalledWith(
        '[ERROR] Failed operation',
        null,
        { userId: '123' }
      );
    });
  });
});
