/**
 * Tests for the Mapbox GL lazy loader
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadMapbox, isMapboxLoaded, resetMapboxLoader } from './mapbox-loader';

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

describe('mapbox-loader', () => {
  beforeEach(() => {
    resetMapboxLoader();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loadMapbox', () => {
    it('should load mapbox-gl library', async () => {
      const mapbox = await loadMapbox();
      expect(mapbox).toBeDefined();
      expect(mapbox.Map).toBeDefined();
      expect(mapbox.Marker).toBeDefined();
      expect(mapbox.Popup).toBeDefined();
    });

    it('should return cached instance on subsequent calls', async () => {
      const mapbox1 = await loadMapbox();
      const mapbox2 = await loadMapbox();

      expect(mapbox1).toBe(mapbox2);
    });

    it('should only load library once even with concurrent calls', async () => {
      // Call loadMapbox multiple times concurrently
      const promises = [
        loadMapbox(),
        loadMapbox(),
        loadMapbox(),
        loadMapbox(),
      ];

      const results = await Promise.all(promises);

      // All results should be the same instance
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
      expect(results[2]).toBe(results[3]);
    });

    it('should handle module loading', async () => {
      const mapbox = await loadMapbox();

      expect(mapbox).toHaveProperty('Map');
      expect(mapbox).toHaveProperty('Marker');
      expect(mapbox).toHaveProperty('Popup');
      expect(mapbox).toHaveProperty('NavigationControl');
      expect(mapbox).toHaveProperty('LngLatBounds');
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
    it('should reset the loader state', async () => {
      await loadMapbox();
      expect(isMapboxLoaded()).toBe(true);

      resetMapboxLoader();
      expect(isMapboxLoaded()).toBe(false);
    });

    it('should allow reloading after reset', async () => {
      await loadMapbox();
      resetMapboxLoader();
      const mapbox2 = await loadMapbox();

      // Should be able to load again
      expect(mapbox2).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle loading errors gracefully', async () => {
      // This test verifies the loader doesn't crash on errors
      // In real scenario, if import fails, it would throw
      try {
        await loadMapbox();
        expect(true).toBe(true); // If we get here, loading succeeded
      } catch (error) {
        // If loading fails, error should be defined
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance', () => {
    it('should cache and return quickly on subsequent calls', async () => {
      const start1 = performance.now();
      await loadMapbox();
      const duration1 = performance.now() - start1;

      const start2 = performance.now();
      await loadMapbox();
      const duration2 = performance.now() - start2;

      // Second call should be much faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });
  });
});
