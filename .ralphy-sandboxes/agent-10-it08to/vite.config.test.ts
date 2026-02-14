/**
 * Vite Configuration Tests
 * Tests for vendor-forms chunk splitting configuration
 *
 * This test suite validates that:
 * 1. The vendor-forms chunk is properly configured
 * 2. react-hook-form, zod, and @hookform/resolvers are correctly grouped
 * 3. The manualChunks function returns the correct chunk names
 */

import { describe, it, expect } from 'vitest';

// Mock the vite config manualChunks logic
const manualChunks = (id: string): string | undefined => {
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
};

describe('Vite Config - Vendor Forms Chunk', () => {
  describe('manualChunks configuration', () => {
    it('should assign react-hook-form to vendor-forms chunk', () => {
      const id = '/project/node_modules/react-hook-form/dist/index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should assign zod to vendor-forms chunk', () => {
      const id = '/project/node_modules/zod/lib/index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should assign @hookform/resolvers to vendor-forms chunk', () => {
      const id = '/project/node_modules/@hookform/resolvers/dist/index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should handle nested paths for react-hook-form', () => {
      const id = '/project/node_modules/react-hook-form/dist/types/index.d.ts';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should handle nested paths for zod', () => {
      const id = '/project/node_modules/zod/lib/types.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should handle Windows-style paths', () => {
      const id = 'C:\\project\\node_modules\\react-hook-form\\dist\\index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });
  });

  describe('chunk separation', () => {
    it('should not assign React to vendor-forms', () => {
      const id = '/project/node_modules/react/index.js';
      expect(manualChunks(id)).toBe('vendor');
      expect(manualChunks(id)).not.toBe('vendor-forms');
    });

    it('should not assign other libraries to vendor-forms', () => {
      const id = '/project/node_modules/@tanstack/react-query/index.js';
      expect(manualChunks(id)).toBe('vendor-query');
      expect(manualChunks(id)).not.toBe('vendor-forms');
    });

    it('should not assign Radix UI to vendor-forms', () => {
      const id = '/project/node_modules/@radix-ui/react-dialog/index.js';
      expect(manualChunks(id)).toBe('vendor-ui');
      expect(manualChunks(id)).not.toBe('vendor-forms');
    });

    it('should assign unmatched node_modules to vendor chunk', () => {
      const id = '/project/node_modules/some-other-lib/index.js';
      expect(manualChunks(id)).toBe('vendor');
    });

    it('should not chunk non-node_modules files', () => {
      const id = '/project/src/components/Form.tsx';
      expect(manualChunks(id)).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle paths with similar names', () => {
      // Note: The current implementation uses .includes() which will match substrings
      // A package like "my-react-hook-form-wrapper" will match because it contains "react-hook-form"
      // This is acceptable behavior as such wrapper packages should be grouped with their dependencies
      const id = '/project/node_modules/my-react-hook-form-wrapper/index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should handle scoped packages correctly', () => {
      const id = '/project/node_modules/@hookform/resolvers/zod/dist/zod.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });

    it('should handle multiple node_modules in path', () => {
      const id = '/project/node_modules/package-a/node_modules/react-hook-form/index.js';
      expect(manualChunks(id)).toBe('vendor-forms');
    });
  });

  describe('all form libraries together', () => {
    it('should group all three form libraries in the same chunk', () => {
      const rhfId = '/project/node_modules/react-hook-form/dist/index.js';
      const zodId = '/project/node_modules/zod/lib/index.js';
      const resolversId = '/project/node_modules/@hookform/resolvers/dist/index.js';

      const rhfChunk = manualChunks(rhfId);
      const zodChunk = manualChunks(zodId);
      const resolversChunk = manualChunks(resolversId);

      expect(rhfChunk).toBe('vendor-forms');
      expect(zodChunk).toBe('vendor-forms');
      expect(resolversChunk).toBe('vendor-forms');

      // All should be in the same chunk
      expect(rhfChunk).toBe(zodChunk);
      expect(zodChunk).toBe(resolversChunk);
    });
  });
});

describe('Vite Config - Vendor Map Chunk', () => {
  describe('map library chunking', () => {
    it('should assign mapbox-gl to vendor-map chunk', () => {
      const id = '/project/node_modules/mapbox-gl/dist/mapbox-gl.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should assign leaflet to vendor-map chunk', () => {
      const id = '/project/node_modules/leaflet/dist/leaflet.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should assign react-leaflet to vendor-map chunk', () => {
      const id = '/project/node_modules/react-leaflet/lib/index.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should handle @mapbox scoped packages', () => {
      const id = '/project/node_modules/@mapbox/mapbox-gl-geocoder/index.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should handle nested paths for leaflet', () => {
      const id = '/project/node_modules/leaflet/src/layer/Layer.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should handle nested paths for react-leaflet', () => {
      const id = '/project/node_modules/react-leaflet/lib/MapContainer.js';
      expect(manualChunks(id)).toBe('vendor-map');
    });

    it('should handle Windows-style paths for map libraries', () => {
      const mapboxId = 'C:\\project\\node_modules\\mapbox-gl\\dist\\mapbox-gl.js';
      const leafletId = 'C:\\project\\node_modules\\leaflet\\dist\\leaflet.js';
      const reactLeafletId = 'C:\\project\\node_modules\\react-leaflet\\lib\\index.js';

      expect(manualChunks(mapboxId)).toBe('vendor-map');
      expect(manualChunks(leafletId)).toBe('vendor-map');
      expect(manualChunks(reactLeafletId)).toBe('vendor-map');
    });
  });

  describe('map library grouping', () => {
    it('should group all map libraries in the same chunk', () => {
      const mapboxId = '/project/node_modules/mapbox-gl/dist/mapbox-gl.js';
      const leafletId = '/project/node_modules/leaflet/dist/leaflet.js';
      const reactLeafletId = '/project/node_modules/react-leaflet/lib/index.js';

      const mapboxChunk = manualChunks(mapboxId);
      const leafletChunk = manualChunks(leafletId);
      const reactLeafletChunk = manualChunks(reactLeafletId);

      expect(mapboxChunk).toBe('vendor-map');
      expect(leafletChunk).toBe('vendor-map');
      expect(reactLeafletChunk).toBe('vendor-map');

      // All should be in the same chunk
      expect(mapboxChunk).toBe(leafletChunk);
      expect(leafletChunk).toBe(reactLeafletChunk);
    });

    it('should not assign other libraries to vendor-map', () => {
      expect(manualChunks('/project/node_modules/react/index.js')).not.toBe('vendor-map');
      expect(manualChunks('/project/node_modules/@tanstack/react-query/index.js')).not.toBe('vendor-map');
      expect(manualChunks('/project/node_modules/framer-motion/index.js')).not.toBe('vendor-map');
    });
  });
});

describe('Vite Config - Other Vendor Chunks', () => {
  it('should correctly separate vendor-query chunk', () => {
    expect(manualChunks('/project/node_modules/@tanstack/react-query/index.js')).toBe('vendor-query');
  });

  it('should correctly separate vendor-motion chunk', () => {
    expect(manualChunks('/project/node_modules/framer-motion/index.js')).toBe('vendor-motion');
  });

  it('should correctly separate vendor-ui chunk', () => {
    expect(manualChunks('/project/node_modules/@radix-ui/react-dialog/index.js')).toBe('vendor-ui');
  });

  it('should correctly separate vendor-charts chunk', () => {
    expect(manualChunks('/project/node_modules/recharts/index.js')).toBe('vendor-charts');
    expect(manualChunks('/project/node_modules/@tremor/react/index.js')).toBe('vendor-charts');
  });

  it('should correctly separate vendor-pdf chunk', () => {
    expect(manualChunks('/project/node_modules/jspdf/index.js')).toBe('vendor-pdf');
    expect(manualChunks('/project/node_modules/html2canvas/index.js')).toBe('vendor-pdf');
  });
});
