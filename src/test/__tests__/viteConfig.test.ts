/**
 * Tests for Vite configuration manual chunks
 * Ensures that vendor chunks are correctly categorized
 */

import { describe, it, expect } from 'vitest';

describe('Vite Config Manual Chunks', () => {
  // Mock the manualChunks function logic
  const getChunkName = (id: string): string | undefined => {
    // Large deps into separate chunks
    if (id.includes('node_modules')) {
      // Exclude React from chunking - keep it in vendor (must check before other packages)
      if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
        return 'vendor';
      }
      if (id.includes('@tanstack')) {
        return 'vendor-query';
      }
      if (id.includes('framer-motion')) {
        return 'vendor-motion';
      }
      if (id.includes('mapbox') || id.includes('leaflet')) {
        return 'vendor-maps';
      }
      // Split Radix UI components into separate chunk
      if (id.includes('@radix-ui')) {
        return 'vendor-ui';
      }
      // Split chart libraries
      if (id.includes('recharts') || id.includes('@tremor') || id.includes('d3-')) {
        return 'vendor-charts';
      }
      return 'vendor';
    }
    return undefined;
  };

  describe('React chunks', () => {
    it('should put react in vendor chunk', () => {
      const id = '/path/to/project/node_modules/react/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });

    it('should put react-dom in vendor chunk', () => {
      const id = '/path/to/project/node_modules/react-dom/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });

    it('should put scheduler in vendor chunk', () => {
      const id = '/path/to/project/node_modules/scheduler/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });
  });

  describe('Query chunks', () => {
    it('should put @tanstack in vendor-query chunk', () => {
      const id = 'node_modules/@tanstack/react-query/index.js';
      expect(getChunkName(id)).toBe('vendor-query');
    });
  });

  describe('Motion chunks', () => {
    it('should put framer-motion in vendor-motion chunk', () => {
      const id = 'node_modules/framer-motion/index.js';
      expect(getChunkName(id)).toBe('vendor-motion');
    });
  });

  describe('Maps chunks', () => {
    it('should put mapbox in vendor-maps chunk', () => {
      const id = 'node_modules/mapbox-gl/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should put leaflet in vendor-maps chunk', () => {
      const id = 'node_modules/leaflet/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });
  });

  describe('UI chunks', () => {
    it('should put @radix-ui components in vendor-ui chunk', () => {
      const id = 'node_modules/@radix-ui/react-dialog/index.js';
      expect(getChunkName(id)).toBe('vendor-ui');
    });
  });

  describe('Charts chunks', () => {
    it('should put recharts in vendor-charts chunk', () => {
      const id = 'node_modules/recharts/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put @tremor in vendor-charts chunk', () => {
      const id = 'node_modules/@tremor/react/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-scale in vendor-charts chunk', () => {
      const id = 'node_modules/d3-scale/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-array in vendor-charts chunk', () => {
      const id = 'node_modules/d3-array/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-shape in vendor-charts chunk', () => {
      const id = 'node_modules/d3-shape/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-interpolate in vendor-charts chunk', () => {
      const id = 'node_modules/d3-interpolate/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-format in vendor-charts chunk', () => {
      const id = 'node_modules/d3-format/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-time in vendor-charts chunk', () => {
      const id = 'node_modules/d3-time/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should put d3-color in vendor-charts chunk', () => {
      const id = 'node_modules/d3-color/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });
  });

  describe('Default vendor chunk', () => {
    it('should put other node_modules in vendor chunk', () => {
      const id = 'node_modules/some-other-lib/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });
  });

  describe('Non node_modules', () => {
    it('should return undefined for non node_modules files', () => {
      const id = 'src/components/MyComponent.tsx';
      expect(getChunkName(id)).toBeUndefined();
    });
  });

  describe('Priority ordering', () => {
    it('should prioritize react core over other vendor checks', () => {
      // Even if a module has node_modules and other keywords, react should take precedence
      const id = '/path/to/project/node_modules/react/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });

    it('should check specific vendors before generic vendor', () => {
      const id = 'node_modules/@tanstack/react-query/index.js';
      expect(getChunkName(id)).toBe('vendor-query');
      expect(getChunkName(id)).not.toBe('vendor');
    });

    it('should allow react-related packages (not core react) to be in their own chunks', () => {
      // @tremor/react should go to vendor-charts, not vendor
      const id = 'node_modules/@tremor/react/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });
  });
});
