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
      // Split map libraries (mapbox, leaflet, react-leaflet)
      if (id.includes('mapbox') || id.includes('leaflet') || id.includes('react-leaflet')) {
        return 'vendor-map';
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

  describe('Map chunks', () => {
    it('should put mapbox in vendor-map chunk', () => {
      const id = 'node_modules/mapbox-gl/index.js';
      expect(getChunkName(id)).toBe('vendor-map');
    });

    it('should put leaflet in vendor-map chunk', () => {
      const id = 'node_modules/leaflet/index.js';
      expect(getChunkName(id)).toBe('vendor-map');
    });

    it('should put react-leaflet in vendor-map chunk', () => {
      const id = 'node_modules/react-leaflet/index.js';
      expect(getChunkName(id)).toBe('vendor-map');
    });

    it('should put @react-leaflet packages in vendor-map chunk', () => {
      const id = 'node_modules/@react-leaflet/core/index.js';
      expect(getChunkName(id)).toBe('vendor-map');
    });

    it('should put mapbox-gl with different path in vendor-map chunk', () => {
      const id = '/path/to/project/node_modules/mapbox-gl/dist/mapbox-gl.js';
      expect(getChunkName(id)).toBe('vendor-map');
    });

    it('should put nested leaflet paths in vendor-map chunk', () => {
      const id = 'node_modules/leaflet/dist/leaflet-src.js';
      expect(getChunkName(id)).toBe('vendor-map');
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

    it('should put victory-vendor in vendor-charts chunk', () => {
      const id = 'node_modules/victory-vendor/index.js';
      expect(getChunkName(id)).toBe('vendor-charts');
    });
  });

  describe('PDF chunks', () => {
    it('should put @react-pdf/renderer in vendor-pdf chunk', () => {
      const id = 'node_modules/@react-pdf/renderer/index.js';
      expect(getChunkName(id)).toBe('vendor-pdf');
    });

    it('should put jspdf in vendor-pdf chunk', () => {
      const id = 'node_modules/jspdf/index.js';
      expect(getChunkName(id)).toBe('vendor-pdf');
    });

    it('should put html2canvas in vendor-pdf chunk', () => {
      const id = 'node_modules/html2canvas/index.js';
      expect(getChunkName(id)).toBe('vendor-pdf');
    });

    it('should put @react-pdf sub-packages in vendor-pdf chunk', () => {
      const id = 'node_modules/@react-pdf/pdfkit/index.js';
      expect(getChunkName(id)).toBe('vendor-pdf');
    });
  });

  describe('Form chunks', () => {
    it('should put react-hook-form in vendor-forms chunk', () => {
      const id = 'node_modules/react-hook-form/dist/index.esm.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put react-hook-form with different path in vendor-forms chunk', () => {
      const id = '/path/to/project/node_modules/react-hook-form/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put zod in vendor-forms chunk', () => {
      const id = 'node_modules/zod/lib/index.mjs';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put zod with different path in vendor-forms chunk', () => {
      const id = '/path/to/project/node_modules/zod/lib/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put @hookform/resolvers in vendor-forms chunk', () => {
      const id = 'node_modules/@hookform/resolvers/zod/dist/zod.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put @hookform/resolvers with different path in vendor-forms chunk', () => {
      const id = '/path/to/project/node_modules/@hookform/resolvers/dist/index.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put nested react-hook-form paths in vendor-forms chunk', () => {
      const id = 'node_modules/react-hook-form/dist/utils/createFormControl.js';
      expect(getChunkName(id)).toBe('vendor-forms');
    });

    it('should put nested zod paths in vendor-forms chunk', () => {
      const id = 'node_modules/zod/lib/helpers/util.js';
      expect(getChunkName(id)).toBe('vendor-forms');
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
