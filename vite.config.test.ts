/**
 * Tests for Vite Configuration
 * Validates chunk splitting logic for vendor dependencies
 */

import { describe, it, expect } from 'vitest';

describe('Vite Config - Manual Chunks', () => {
  // Simulate the manualChunks function from vite.config.ts
  const manualChunks = (id: string): string | undefined => {
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
  };

  describe('React dependencies', () => {
    it('should put react in vendor chunk', () => {
      expect(manualChunks('/path/to/node_modules/react/index.js')).toBe('vendor');
    });

    it('should put react-dom in vendor chunk', () => {
      expect(manualChunks('/path/to/node_modules/react-dom/index.js')).toBe('vendor');
    });

    it('should put scheduler in vendor chunk', () => {
      expect(manualChunks('/path/to/node_modules/scheduler/index.js')).toBe('vendor');
    });
  });

  describe('Form libraries - vendor-forms chunk', () => {
    it('should put react-hook-form in vendor-forms chunk', () => {
      expect(manualChunks('/path/to/node_modules/react-hook-form/dist/index.js')).toBe('vendor-forms');
    });

    it('should put zod in vendor-forms chunk', () => {
      expect(manualChunks('/path/to/node_modules/zod/lib/index.js')).toBe('vendor-forms');
    });

    it('should put @hookform/resolvers in vendor-forms chunk', () => {
      expect(manualChunks('/path/to/node_modules/@hookform/resolvers/dist/index.js')).toBe('vendor-forms');
    });

    it('should handle nested paths in react-hook-form', () => {
      expect(manualChunks('/project/node_modules/react-hook-form/dist/utils/createSubject.js')).toBe('vendor-forms');
    });

    it('should handle nested paths in zod', () => {
      expect(manualChunks('/project/node_modules/zod/lib/types.js')).toBe('vendor-forms');
    });
  });

  describe('Query libraries', () => {
    it('should put @tanstack packages in vendor-query chunk', () => {
      expect(manualChunks('/path/to/node_modules/@tanstack/react-query/index.js')).toBe('vendor-query');
    });
  });

  describe('Animation libraries', () => {
    it('should put framer-motion in vendor-motion chunk', () => {
      expect(manualChunks('/path/to/node_modules/framer-motion/index.js')).toBe('vendor-motion');
    });
  });

  describe('Map libraries', () => {
    it('should put mapbox in vendor-maps chunk', () => {
      expect(manualChunks('/path/to/node_modules/mapbox-gl/index.js')).toBe('vendor-maps');
    });

    it('should put leaflet in vendor-maps chunk', () => {
      expect(manualChunks('/path/to/node_modules/leaflet/index.js')).toBe('vendor-maps');
    });
  });

  describe('UI libraries', () => {
    it('should put @radix-ui packages in vendor-ui chunk', () => {
      expect(manualChunks('/path/to/node_modules/@radix-ui/react-dialog/index.js')).toBe('vendor-ui');
    });
  });

  describe('Chart libraries', () => {
    it('should put recharts in vendor-charts chunk', () => {
      expect(manualChunks('/path/to/node_modules/recharts/index.js')).toBe('vendor-charts');
    });

    it('should put @tremor packages in vendor-charts chunk', () => {
      expect(manualChunks('/path/to/node_modules/@tremor/react/index.js')).toBe('vendor-charts');
    });

    it('should put d3 packages in vendor-charts chunk', () => {
      expect(manualChunks('/path/to/node_modules/d3-scale/index.js')).toBe('vendor-charts');
    });

    it('should put victory-vendor in vendor-charts chunk', () => {
      expect(manualChunks('/path/to/node_modules/victory-vendor/index.js')).toBe('vendor-charts');
    });
  });

  describe('PDF libraries', () => {
    it('should put react-pdf in vendor-pdf chunk', () => {
      expect(manualChunks('/path/to/node_modules/react-pdf/index.js')).toBe('vendor-pdf');
    });

    it('should put jspdf in vendor-pdf chunk', () => {
      expect(manualChunks('/path/to/node_modules/jspdf/index.js')).toBe('vendor-pdf');
    });

    it('should put html2canvas in vendor-pdf chunk', () => {
      expect(manualChunks('/path/to/node_modules/html2canvas/index.js')).toBe('vendor-pdf');
    });
  });

  describe('Default vendor chunk', () => {
    it('should put other node_modules in default vendor chunk', () => {
      expect(manualChunks('/path/to/node_modules/some-other-package/index.js')).toBe('vendor');
    });
  });

  describe('Non-node_modules files', () => {
    it('should return undefined for application code', () => {
      expect(manualChunks('/path/to/src/components/MyComponent.tsx')).toBeUndefined();
    });

    it('should return undefined for lib code', () => {
      expect(manualChunks('/path/to/src/lib/utils.ts')).toBeUndefined();
    });
  });

  describe('Priority order', () => {
    it('should prioritize React over default vendor', () => {
      // React should be checked before falling back to default vendor
      expect(manualChunks('/path/to/node_modules/react/jsx-runtime.js')).toBe('vendor');
    });

    it('should check form libraries before default vendor', () => {
      // Form libraries should be checked and return vendor-forms, not default vendor
      expect(manualChunks('/path/to/node_modules/react-hook-form/dist/index.esm.js')).toBe('vendor-forms');
      expect(manualChunks('/path/to/node_modules/zod/index.js')).toBe('vendor-forms');
    });
  });
});
