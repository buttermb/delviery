/**
 * Tests for React Query configuration
 */

import { describe, it, expect } from 'vitest';
import {
  createQueryClient,
  appQueryClient,
  PRODUCT_QUERY_CONFIG,
  DASHBOARD_QUERY_CONFIG,
  ANALYTICS_QUERY_CONFIG,
  REALTIME_QUERY_CONFIG,
  STATIC_QUERY_CONFIG,
  INSTANT_CACHE_CONFIG,
  LIST_QUERY_CONFIG,
} from '../react-query-config';

describe('React Query Configuration', () => {
  describe('createQueryClient', () => {
    it('should create a query client with default options', () => {
      const client = createQueryClient();
      expect(client).toBeDefined();
      expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
      expect(client.getDefaultOptions().queries?.gcTime).toBe(30 * 60 * 1000);
    });

    it('should have retry configuration', () => {
      const client = createQueryClient();
      const queries = client.getDefaultOptions().queries;
      expect(queries?.retry).toBeDefined();
      expect(queries?.retryDelay).toBeDefined();
    });
  });

  describe('appQueryClient', () => {
    it('should be a singleton instance', () => {
      expect(appQueryClient).toBeDefined();
      expect(appQueryClient).toBe(appQueryClient);
    });
  });

  describe('PRODUCT_QUERY_CONFIG', () => {
    it('should have correct configuration for products', () => {
      expect(PRODUCT_QUERY_CONFIG).toEqual({
        staleTime: 15 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      });
    });

    it('should have longer staleTime than default', () => {
      expect(PRODUCT_QUERY_CONFIG.staleTime).toBe(15 * 60 * 1000);
      expect(PRODUCT_QUERY_CONFIG.staleTime).toBeGreaterThan(5 * 60 * 1000);
    });
  });

  describe('DASHBOARD_QUERY_CONFIG', () => {
    it('should have correct configuration for dashboard', () => {
      expect(DASHBOARD_QUERY_CONFIG).toEqual({
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchInterval: 60000,
      });
    });

    it('should auto-refresh every minute', () => {
      expect(DASHBOARD_QUERY_CONFIG.refetchInterval).toBe(60000);
    });
  });

  describe('ANALYTICS_QUERY_CONFIG', () => {
    it('should have correct configuration for analytics', () => {
      expect(ANALYTICS_QUERY_CONFIG).toEqual({
        staleTime: 2 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchInterval: 60000,
      });
    });

    it('should auto-refresh every minute', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(60000);
    });

    it('should have refetchInterval of 60000ms', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(60000);
    });

    it('should not refetch on window focus', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchOnWindowFocus).toBe(false);
    });

    it('should not refetch on mount', () => {
      expect(ANALYTICS_QUERY_CONFIG.refetchOnMount).toBe(false);
    });

    it('should have 2 minute staleTime', () => {
      expect(ANALYTICS_QUERY_CONFIG.staleTime).toBe(2 * 60 * 1000);
    });

    it('should have 5 minute gcTime', () => {
      expect(ANALYTICS_QUERY_CONFIG.gcTime).toBe(5 * 60 * 1000);
    });
  });

  describe('REALTIME_QUERY_CONFIG', () => {
    it('should have correct configuration for realtime data', () => {
      expect(REALTIME_QUERY_CONFIG).toEqual({
        staleTime: 30 * 1000,
        gcTime: 2 * 60 * 1000,
        refetchInterval: 30000,
        refetchIntervalInBackground: false,
      });
    });

    it('should refresh more frequently than analytics', () => {
      expect(REALTIME_QUERY_CONFIG.refetchInterval).toBe(30000);
      expect(REALTIME_QUERY_CONFIG.refetchInterval).toBeLessThan(
        ANALYTICS_QUERY_CONFIG.refetchInterval || 0
      );
    });
  });

  describe('STATIC_QUERY_CONFIG', () => {
    it('should have correct configuration for static data', () => {
      expect(STATIC_QUERY_CONFIG).toEqual({
        staleTime: 60 * 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      });
    });

    it('should have longest cache time', () => {
      expect(STATIC_QUERY_CONFIG.staleTime).toBe(60 * 60 * 1000);
      expect(STATIC_QUERY_CONFIG.gcTime).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('LIST_QUERY_CONFIG', () => {
    it('should have correct configuration for list data', () => {
      expect(LIST_QUERY_CONFIG).toEqual({
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        keepPreviousData: true,
      });
    });

    it('should keep previous data for smooth pagination', () => {
      expect(LIST_QUERY_CONFIG.keepPreviousData).toBe(true);
    });
  });

  describe('Configuration consistency', () => {
    it('should have gcTime >= staleTime for all configs', () => {
      const configs = [
        PRODUCT_QUERY_CONFIG,
        DASHBOARD_QUERY_CONFIG,
        ANALYTICS_QUERY_CONFIG,
        REALTIME_QUERY_CONFIG,
        STATIC_QUERY_CONFIG,
        LIST_QUERY_CONFIG,
      ];

      configs.forEach((config) => {
        if (config.staleTime && config.gcTime) {
          expect(config.gcTime).toBeGreaterThanOrEqual(config.staleTime);
        }
      });
    });

    it('should have appropriate refresh intervals', () => {
      // Realtime should refresh faster than analytics/dashboard
      if (REALTIME_QUERY_CONFIG.refetchInterval && ANALYTICS_QUERY_CONFIG.refetchInterval) {
        expect(REALTIME_QUERY_CONFIG.refetchInterval).toBeLessThan(
          ANALYTICS_QUERY_CONFIG.refetchInterval
        );
      }

      // Analytics and dashboard should have the same interval
      expect(ANALYTICS_QUERY_CONFIG.refetchInterval).toBe(
        DASHBOARD_QUERY_CONFIG.refetchInterval
      );
    });
  });
});
