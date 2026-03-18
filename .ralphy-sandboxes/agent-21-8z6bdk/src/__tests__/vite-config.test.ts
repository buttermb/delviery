/**
 * Vite Configuration Tests
 * Tests for manual chunk splitting configuration
 */

import { describe, it, expect } from 'vitest';

describe('Vite Config - Manual Chunks', () => {
  // Mock function to simulate the manualChunks logic from vite.config.ts
  const getChunkName = (id: string): string | undefined => {
    if (id.includes('node_modules')) {
      // Exclude React from chunking - keep it in vendor
      if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
        return 'vendor';
      }
      if (id.includes('@tanstack')) {
        return 'vendor-query';
      }
      if (id.includes('framer-motion')) {
        return 'vendor-motion';
      }
      if (id.includes('mapbox') || id.includes('leaflet') || id.includes('react-leaflet')) {
        return 'vendor-maps';
      }
      // Split Radix UI components into separate chunk
      if (id.includes('@radix-ui')) {
        return 'vendor-ui';
      }
      // Split chart libraries (recharts, d3, tremor)
      if (id.includes('recharts') || id.includes('@tremor') || id.includes('d3-') || id.includes('victory-vendor')) {
        return 'vendor-charts';
      }
      // Split PDF libraries (react-pdf, jspdf, html2canvas)
      if (id.includes('react-pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
        return 'vendor-pdf';
      }
      // Split form libraries (react-hook-form, zod, @hookform/resolvers)
      if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform/resolvers')) {
        return 'vendor-forms';
      }
      return 'vendor';
    }
    return undefined;
  };

  describe('vendor-forms chunk', () => {
    it('should place react-hook-form in vendor-forms chunk', () => {
      const id = '/project/node_modules/react-hook-form/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should place zod in vendor-forms chunk', () => {
      const id = '/project/node_modules/zod/lib/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should place @hookform/resolvers in vendor-forms chunk', () => {
      const id = '/project/node_modules/@hookform/resolvers/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should handle nested paths for react-hook-form', () => {
      const id = '/project/node_modules/react-hook-form/dist/utils/createFormControl.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should handle nested paths for zod', () => {
      const id = '/project/node_modules/zod/lib/types/string.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });
  });

  describe('other vendor chunks', () => {
    it('should place React in vendor chunk', () => {
      const id = '/project/node_modules/react/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });

    it('should place @tanstack/react-query in vendor-query chunk', () => {
      const id = '/project/node_modules/@tanstack/react-query/build/index.js';
      expect(getChunkName(id)).toBe('vendor-query');
    });

    it('should place framer-motion in vendor-motion chunk', () => {
      const id = '/project/node_modules/framer-motion/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-motion');
    });

    it('should place mapbox in vendor-maps chunk', () => {
      const id = '/project/node_modules/mapbox-gl/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place leaflet in vendor-maps chunk', () => {
      const id = '/project/node_modules/leaflet/dist/leaflet.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place react-leaflet in vendor-maps chunk', () => {
      const id = '/project/node_modules/react-leaflet/lib/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place @radix-ui in vendor-ui chunk', () => {
      const id = '/project/node_modules/@radix-ui/react-dialog/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-ui');
    });

    it('should place recharts in vendor-charts chunk', () => {
      const id = '/project/node_modules/recharts/es6/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });

    it('should place jspdf in vendor-pdf chunk', () => {
      const id = '/project/node_modules/jspdf/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-pdf');
    });

    it('should place unknown node_modules in vendor chunk', () => {
      const id = '/project/node_modules/some-other-package/index.js';
      expect(getChunkName(id)).toBe('vendor');
    });

    it('should not chunk application code', () => {
      const id = '/project/src/components/MyComponent.tsx';
      expect(getChunkName(id)).toBeUndefined();
    });
  });

  describe('vendor-maps chunk', () => {
    it('should place mapbox-gl in vendor-maps chunk', () => {
      const id = '/project/node_modules/mapbox-gl/dist/mapbox-gl.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place leaflet in vendor-maps chunk', () => {
      const id = '/project/node_modules/leaflet/dist/leaflet-src.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place react-leaflet in vendor-maps chunk', () => {
      const id = '/project/node_modules/react-leaflet/lib/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should handle nested paths for mapbox', () => {
      const id = '/project/node_modules/mapbox-gl/src/ui/map.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should handle nested paths for leaflet', () => {
      const id = '/project/node_modules/leaflet/src/core/Browser.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should handle nested paths for react-leaflet', () => {
      const id = '/project/node_modules/react-leaflet/lib/MapContainer.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });

    it('should place @mapbox packages in vendor-maps chunk', () => {
      const id = '/project/node_modules/@mapbox/mapbox-gl-directions/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-maps');
    });
  });

  describe('chunk priority order', () => {
    it('should prioritize React over other rules', () => {
      const id = '/project/node_modules/react/index.js';
      // React should be in vendor, not in any other chunk
      expect(getChunkName(id)).toBe('vendor');
      expect(getChunkName(id)).not.toBe('vendor-forms');
    });

    it('should not place form libraries in vendor chunk', () => {
      const zodId = '/project/node_modules/zod/lib/index.js';
      const rhfId = '/project/node_modules/react-hook-form/dist/index.js';

      expect(getChunkName(zodId)).not.toBe('vendor');
      expect(getChunkName(rhfId)).not.toBe('vendor');

      expect(getChunkName(zodId)).toBe('vendor-forms');
      expect(getChunkName(rhfId)).toBe('vendor-forms');
    });
  });
});
