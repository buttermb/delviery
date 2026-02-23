import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNavigateWithTransition } from '../useNavigateWithTransition';
import * as useViewTransitionSupportModule from '../useViewTransitionSupport';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useViewTransitionSupport
vi.mock('../useViewTransitionSupport', () => ({
  useViewTransitionSupport: vi.fn(),
}));

describe('useNavigateWithTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when View Transitions API is supported', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);
    });

    it('should navigate with viewTransition option enabled', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path');

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', { viewTransition: true });
    });

    it('should preserve existing options when navigating', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path', { replace: true, state: { test: true } });

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', {
        replace: true,
        state: { test: true },
        viewTransition: true,
      });
    });

    it('should handle navigation with query params', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path?foo=bar');

      expect(mockNavigate).toHaveBeenCalledWith('/test-path?foo=bar', { viewTransition: true });
    });

    it('should handle navigation with hash', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path#section');

      expect(mockNavigate).toHaveBeenCalledWith('/test-path#section', { viewTransition: true });
    });
  });

  describe('when View Transitions API is not supported', () => {
    beforeEach(() => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);
    });

    it('should navigate without viewTransition option', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path');

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', undefined);
    });

    it('should preserve existing options when navigating', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path', { replace: true, state: { test: true } });

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', {
        replace: true,
        state: { test: true },
      });
    });

    it('should not add viewTransition to options', () => {
      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/test-path', { replace: true });

      expect(mockNavigate).toHaveBeenCalledWith('/test-path', { replace: true });
      expect(mockNavigate).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ viewTransition: expect.anything() })
      );
    });
  });

  describe('numeric navigation (back/forward)', () => {
    it('should handle numeric navigation when View Transitions are supported', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current(-1);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should handle numeric navigation when View Transitions are not supported', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(false);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current(-1);

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should handle forward navigation', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current(1);

      expect(mockNavigate).toHaveBeenCalledWith(1);
    });
  });

  describe('stability', () => {
    it('should return stable function reference', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result, rerender } = renderHook(() => useNavigateWithTransition());

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      expect(firstRender).toBe(secondRender);
    });

    it('should update when support changes', () => {
      const spy = vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport');
      spy.mockReturnValue(true);

      const { result, rerender } = renderHook(() => useNavigateWithTransition());

      result.current('/test-1');
      expect(mockNavigate).toHaveBeenCalledWith('/test-1', { viewTransition: true });

      spy.mockReturnValue(false);
      rerender();

      result.current('/test-2');
      expect(mockNavigate).toHaveBeenCalledWith('/test-2', undefined);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string path', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('');

      expect(mockNavigate).toHaveBeenCalledWith('', { viewTransition: true });
    });

    it('should handle root path', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/');

      expect(mockNavigate).toHaveBeenCalledWith('/', { viewTransition: true });
    });

    it('should handle complex paths', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current('/tenant/admin/orders?status=pending&sort=date#top');

      expect(mockNavigate).toHaveBeenCalledWith(
        '/tenant/admin/orders?status=pending&sort=date#top',
        { viewTransition: true }
      );
    });

    it('should handle zero as navigation delta', () => {
      vi.spyOn(useViewTransitionSupportModule, 'useViewTransitionSupport').mockReturnValue(true);

      const { result } = renderHook(() => useNavigateWithTransition());

      result.current(0);

      expect(mockNavigate).toHaveBeenCalledWith(0);
    });
  });
});
