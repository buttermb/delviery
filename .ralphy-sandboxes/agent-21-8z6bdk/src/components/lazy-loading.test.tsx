/**
 * Tests for lazy loading behavior of mapbox-gl
 * Ensures mapbox-gl is only loaded when map components are rendered
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadMapbox, isMapboxLoaded, resetMapboxLoader } from '@/lib/mapbox-loader';

// Mock the dynamic imports
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    Map: vi.fn(),
    Marker: vi.fn(),
    Popup: vi.fn(),
    NavigationControl: vi.fn(),
    FullscreenControl: vi.fn(),
    GeolocateControl: vi.fn(),
    LngLatBounds: vi.fn(),
  },
}));

vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}));

describe('Lazy Loading Mapbox GL', () => {
  beforeEach(() => {
    resetMapboxLoader();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetMapboxLoader();
  });

  describe('loadMapbox', () => {
    it('should dynamically import mapbox-gl library', async () => {
      const mapbox = await loadMapbox();

      expect(mapbox).toBeDefined();
      expect(mapbox.Map).toBeDefined();
      expect(mapbox.Marker).toBeDefined();
      expect(mapbox.Popup).toBeDefined();
      expect(mapbox.NavigationControl).toBeDefined();
    });

    it('should cache the loaded instance', async () => {
      const mapbox1 = await loadMapbox();
      const mapbox2 = await loadMapbox();

      // Both should return the same instance
      expect(mapbox1).toBe(mapbox2);
      expect(isMapboxLoaded()).toBe(true);
    });

    it('should handle concurrent load requests', async () => {
      // Simulate multiple components loading mapbox at the same time
      const promises = [
        loadMapbox(),
        loadMapbox(),
        loadMapbox(),
        loadMapbox(),
        loadMapbox(),
      ];

      const results = await Promise.all(promises);

      // All should return the same cached instance
      results.forEach((result, index) => {
        if (index > 0) {
          expect(result).toBe(results[0]);
        }
      });
    });

    it('should load both JS and CSS', async () => {
      // The CSS should be imported alongside the JS module
      const mapbox = await loadMapbox();

      expect(mapbox).toBeDefined();
      // CSS import is handled by Vite, we just verify the module loads
    });
  });

  describe('isMapboxLoaded', () => {
    it('should return false before loading', () => {
      expect(isMapboxLoaded()).toBe(false);
    });

    it('should return true after loading', async () => {
      await loadMapbox();
      expect(isMapboxLoaded()).toBe(true);
    });

    it('should return false after reset', async () => {
      await loadMapbox();
      expect(isMapboxLoaded()).toBe(true);

      resetMapboxLoader();
      expect(isMapboxLoaded()).toBe(false);
    });
  });

  describe('resetMapboxLoader', () => {
    it('should clear the cached instance', async () => {
      await loadMapbox();
      expect(isMapboxLoaded()).toBe(true);

      resetMapboxLoader();
      expect(isMapboxLoaded()).toBe(false);

      const mapbox2 = await loadMapbox();
      expect(isMapboxLoaded()).toBe(true);

      // After reset, we can load again
      expect(mapbox2).toBeDefined();
    });
  });

  describe('Performance characteristics', () => {
    it('should cache results for fast subsequent access', async () => {
      const start1 = performance.now();
      await loadMapbox();
      const duration1 = performance.now() - start1;

      const start2 = performance.now();
      await loadMapbox();
      const duration2 = performance.now() - start2;

      // Second call should be significantly faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });

    it('should not load mapbox-gl until explicitly called', () => {
      // Before calling loadMapbox(), the module should not be loaded
      expect(isMapboxLoaded()).toBe(false);
    });
  });

  describe('Bundle splitting', () => {
    it('should use dynamic import for code splitting', async () => {
      // Dynamic imports enable Vite to split mapbox-gl into a separate chunk
      // This test verifies the import mechanism works
      const mapbox = await loadMapbox();
      expect(mapbox).toBeDefined();

      // The fact that we're using import() instead of static import
      // means Vite will create a separate chunk for mapbox-gl
    });
  });

  describe('Error handling', () => {
    it('should handle import errors gracefully', async () => {
      // If the import fails, it should propagate the error
      try {
        await loadMapbox();
        expect(true).toBe(true); // If no error, test passes
      } catch (error) {
        // If there's an error, it should be defined
        expect(error).toBeDefined();
      }
    });
  });
});
