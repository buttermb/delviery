import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client before importing geofenceHelper
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { calculateDistance, formatDistance, getGeofenceStatus, GEOFENCE_RADIUS_MILES } from '../geofenceHelper';

describe('geofenceHelper', () => {
  describe('calculateDistance', () => {
    it('should return 0 for identical coordinates', () => {
      const distance = calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('should calculate distance between two NYC points correctly', () => {
      // Times Square to Central Park South (~0.5 miles)
      const distance = calculateDistance(40.758, -73.9855, 40.7658, -73.9768);
      expect(distance).toBeGreaterThan(0.3);
      expect(distance).toBeLessThan(1.0);
    });

    it('should calculate distance between distant points', () => {
      // NYC to LA (~2450 miles)
      const distance = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it('should be symmetric (A->B = B->A)', () => {
      const ab = calculateDistance(40.7128, -74.006, 40.758, -73.9855);
      const ba = calculateDistance(40.758, -73.9855, 40.7128, -74.006);
      expect(Math.abs(ab - ba)).toBeLessThan(0.001);
    });

    it('should handle negative coordinates', () => {
      const distance = calculateDistance(-33.8688, 151.2093, -37.8136, 144.9631);
      expect(distance).toBeGreaterThan(0);
    });

    it('should handle equator crossings', () => {
      const distance = calculateDistance(1, 0, -1, 0);
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('GEOFENCE_RADIUS_MILES', () => {
    it('should be 0.5 miles', () => {
      expect(GEOFENCE_RADIUS_MILES).toBe(0.5);
    });
  });

  describe('formatDistance', () => {
    it('should format small distances in feet', () => {
      expect(formatDistance(0.05)).toMatch(/\d+ ft/);
    });

    it('should format larger distances in miles', () => {
      expect(formatDistance(1.5)).toBe('1.50 mi');
    });

    it('should show miles for distances >= 0.1', () => {
      expect(formatDistance(0.1)).toBe('0.10 mi');
    });

    it('should convert to feet correctly for very small distances', () => {
      // 0.01 miles = ~53 feet
      const result = formatDistance(0.01);
      expect(result).toMatch(/^\d+ ft$/);
      const feet = parseInt(result);
      expect(feet).toBeGreaterThan(40);
      expect(feet).toBeLessThan(60);
    });
  });

  describe('getGeofenceStatus', () => {
    it('should return "Location unavailable" when distance is null', () => {
      const status = getGeofenceStatus(null);
      expect(status.canComplete).toBe(false);
      expect(status.statusText).toBe('Location unavailable');
      expect(status.statusColor).toBe('text-gray-500');
    });

    it('should allow completion within geofence radius', () => {
      const status = getGeofenceStatus(0.3);
      expect(status.canComplete).toBe(true);
      expect(status.statusColor).toBe('text-green-600');
      expect(status.statusText).toBe('In delivery range');
    });

    it('should allow completion at exact radius boundary', () => {
      const status = getGeofenceStatus(GEOFENCE_RADIUS_MILES);
      expect(status.canComplete).toBe(true);
    });

    it('should show "Getting close" for distances <= 2 miles', () => {
      const status = getGeofenceStatus(1.5);
      expect(status.canComplete).toBe(false);
      expect(status.statusColor).toBe('text-yellow-600');
      expect(status.statusText).toBe('Getting close');
    });

    it('should show "Not in delivery range" for far distances', () => {
      const status = getGeofenceStatus(5.0);
      expect(status.canComplete).toBe(false);
      expect(status.statusColor).toBe('text-red-600');
      expect(status.statusText).toBe('Not in delivery range');
    });

    it('should not allow completion just outside radius', () => {
      const status = getGeofenceStatus(0.51);
      expect(status.canComplete).toBe(false);
    });

    it('should allow completion at 0 distance', () => {
      const status = getGeofenceStatus(0);
      expect(status.canComplete).toBe(true);
    });
  });
});
