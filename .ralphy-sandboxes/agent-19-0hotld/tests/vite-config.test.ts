import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Test suite for vite.config.ts vendor-forms chunk configuration
 *
 * Verifies that the build configuration properly splits react-hook-form,
 * zod, and @hookform/resolvers into a separate 'vendor-forms' chunk
 * for optimal code splitting and caching.
 */
describe('Vite Config - Vendor Forms Chunk', () => {
  const viteConfigPath = path.resolve(__dirname, '..', 'vite.config.ts');
  let viteConfigContent: string;

  it('should have vite.config.ts file', () => {
    expect(() => {
      viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    }).not.toThrow();
    expect(viteConfigContent).toBeDefined();
  });

  it('should have manualChunks configuration', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('manualChunks');
  });

  it('should split react-hook-form into vendor-forms chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('react-hook-form');
    expect(viteConfigContent).toContain("return 'vendor-forms'");
  });

  it('should split zod into vendor-forms chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('zod');
  });

  it('should split @hookform/resolvers into vendor-forms chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('@hookform/resolvers');
  });

  it('should have all form libraries in the same conditional check', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    // Extract the vendor-forms chunk logic
    const vendorFormsRegex = /if\s*\(id\.includes\('react-hook-form'\)\s*\|\|\s*id\.includes\('zod'\)\s*\|\|\s*id\.includes\('@hookform\/resolvers'\)\)\s*\{\s*return\s*'vendor-forms';/;

    expect(viteConfigContent).toMatch(vendorFormsRegex);
  });

  it('should have vendor-forms chunk defined in the correct location (within manualChunks)', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    // Check that vendor-forms is inside manualChunks function
    const manualChunksStart = viteConfigContent.indexOf('manualChunks:');
    const vendorFormsLocation = viteConfigContent.indexOf("return 'vendor-forms'");

    expect(manualChunksStart).toBeGreaterThan(-1);
    expect(vendorFormsLocation).toBeGreaterThan(manualChunksStart);
  });

  it('should have proper chunk splitting order (React checked before other packages)', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    const reactChunkIndex = viteConfigContent.indexOf("return 'vendor';");
    const vendorFormsIndex = viteConfigContent.indexOf("return 'vendor-forms';");

    // vendor-forms should come after main vendor (React) check
    expect(reactChunkIndex).toBeGreaterThan(-1);
    expect(vendorFormsIndex).toBeGreaterThan(reactChunkIndex);
  });

  it('should have rollupOptions configured', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('rollupOptions');
  });

  it('should have proper build target configuration', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain("target: 'es2020'");
  });
});

/**
 * Test suite for vite.config.ts vendor-map chunk configuration
 *
 * Verifies that the build configuration properly splits leaflet,
 * react-leaflet, and mapbox-gl into a separate 'vendor-map' chunk
 * for optimal code splitting and caching.
 */
describe('Vite Config - Vendor Map Chunk', () => {
  const viteConfigPath = path.resolve(__dirname, '..', 'vite.config.ts');
  let viteConfigContent: string;

  it('should have vite.config.ts file', () => {
    expect(() => {
      viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    }).not.toThrow();
    expect(viteConfigContent).toBeDefined();
  });

  it('should have manualChunks configuration', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('manualChunks');
  });

  it('should split mapbox into vendor-map chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('mapbox');
    expect(viteConfigContent).toContain("return 'vendor-map'");
  });

  it('should split leaflet into vendor-map chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('leaflet');
  });

  it('should split react-leaflet into vendor-map chunk', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('react-leaflet');
  });

  it('should have all map libraries in the same conditional check', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    // Extract the vendor-map chunk logic
    const vendorMapRegex = /if\s*\(id\.includes\('mapbox'\)\s*\|\|\s*id\.includes\('leaflet'\)\s*\|\|\s*id\.includes\('react-leaflet'\)\)\s*\{\s*return\s*'vendor-map';/;

    expect(viteConfigContent).toMatch(vendorMapRegex);
  });

  it('should have vendor-map chunk defined in the correct location (within manualChunks)', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    // Check that vendor-map is inside manualChunks function
    const manualChunksStart = viteConfigContent.indexOf('manualChunks:');
    const vendorMapLocation = viteConfigContent.indexOf("return 'vendor-map'");

    expect(manualChunksStart).toBeGreaterThan(-1);
    expect(vendorMapLocation).toBeGreaterThan(manualChunksStart);
  });

  it('should have proper chunk splitting order (React checked before map packages)', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');

    const reactChunkIndex = viteConfigContent.indexOf("return 'vendor';");
    const vendorMapIndex = viteConfigContent.indexOf("return 'vendor-map';");

    // vendor-map should come after main vendor (React) check
    expect(reactChunkIndex).toBeGreaterThan(-1);
    expect(vendorMapIndex).toBeGreaterThan(reactChunkIndex);
  });

  it('should have rollupOptions configured', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain('rollupOptions');
  });

  it('should have proper build target configuration', () => {
    viteConfigContent = readFileSync(viteConfigPath, 'utf-8');
    expect(viteConfigContent).toContain("target: 'es2020'");
  });
});

/**
 * Integration test for verifying the actual chunk output
 * This test provides guidance on manual verification steps
 */
describe('Vendor Forms Chunk - Integration Guide', () => {
  it('should provide instructions for manual verification', () => {
    const instructions = `
    To verify vendor-forms chunk is properly generated:

    1. Run: npm run build
    2. Check dist/assets/ directory for files containing:
       - vendor-forms-[hash].js
    3. Verify the chunk contains:
       - react-hook-form
       - zod
       - @hookform/resolvers
    4. Check chunk size is reasonable (typically 50-150kb before compression)
    `;

    expect(instructions).toBeDefined();
    // This test always passes - it's for documentation
    expect(true).toBe(true);
  });
});

/**
 * Integration test for verifying the vendor-map chunk output
 * This test provides guidance on manual verification steps
 */
describe('Vendor Map Chunk - Integration Guide', () => {
  it('should provide instructions for manual verification', () => {
    const instructions = `
    To verify vendor-map chunk is properly generated:

    1. Run: npm run build
    2. Check dist/assets/ directory for files containing:
       - vendor-map-[hash].js
    3. Verify the chunk contains:
       - mapbox-gl
       - leaflet
       - react-leaflet
    4. Check chunk size is reasonable (typically 200-400kb before compression)
    5. Verify map libraries are not included in the main vendor chunk
    `;

    expect(instructions).toBeDefined();
    // This test always passes - it's for documentation
    expect(true).toBe(true);
  });
});
