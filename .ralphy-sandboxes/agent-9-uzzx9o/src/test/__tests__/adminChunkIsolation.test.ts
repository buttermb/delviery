/**
 * Admin Chunk Isolation Tests
 *
 * Verifies that admin JavaScript chunks never load on public shop pages.
 * This is a static analysis test that reads source files and checks for:
 * 1. All admin pages are lazy-loaded (dynamic import) in lazyImports.ts
 * 2. No shop/store/customer/public page files import from admin directories
 * 3. App.tsx doesn't eagerly import admin page modules
 * 4. The route structure keeps admin and shop chunks separate
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

describe('Admin chunk isolation', () => {
  describe('lazyImports.ts - all admin pages use lazy()', () => {
    const lazyImports = readSource('routes/lazyImports.ts');

    it('should not have any eager imports from admin page directories', () => {
      // Match lines like: import { Foo } from "@/pages/admin/..."
      // But NOT: lazy(() => import("@/pages/admin/..."))
      const eagerAdminImports = lazyImports
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          // Skip comments
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return false;
          // Must be a static import from admin paths
          const isStaticImport = /^import\s+/.test(trimmed) || /^export\s+\{.*\}\s+from/.test(trimmed);
          const targetsAdmin = /@\/pages\/admin\//.test(trimmed) || /@\/layouts\/Admin/.test(trimmed);
          return isStaticImport && targetsAdmin;
        });

      expect(eagerAdminImports).toEqual([]);
    });

    it('should use lazy() or lazyWithRetry() for AdminLayout', () => {
      expect(lazyImports).toMatch(/AdminLayout\s*=\s*(lazy|lazyWithRetry)\s*\(/);
    });

    it('should use lazy() or lazyWithRetry() for SuperAdminLayout', () => {
      expect(lazyImports).toMatch(/SuperAdminLayout\s*=\s*(lazy|lazyWithRetry)\s*\(/);
    });

    it('should use lazy() for all admin hub pages', () => {
      const hubExports = lazyImports.match(/export const \w+HubPage\s*=/g) ?? [];
      expect(hubExports.length).toBeGreaterThan(0);

      for (const hubExport of hubExports) {
        const varName = hubExport.match(/export const (\w+)/)?.[1];
        if (!varName) continue;
        const pattern = new RegExp(`${varName}\\s*=\\s*(lazy|lazyWithRetry)\\s*\\(`);
        expect(lazyImports).toMatch(pattern);
      }
    });
  });

  describe('App.tsx - no eager admin page imports', () => {
    const appTsx = readSource('App.tsx');

    it('should not eagerly import from @/pages/admin/', () => {
      const eagerAdminPageImports = appTsx
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
          // Check for static imports targeting admin pages
          return /^import\s+.*from\s+["'].*\/pages\/admin\//.test(trimmed);
        });

      expect(eagerAdminPageImports).toEqual([]);
    });

    it('should not eagerly import from @/pages/super-admin/', () => {
      const eagerSuperAdminImports = appTsx
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
          return /^import\s+.*from\s+["'].*\/pages\/super-admin\//.test(trimmed);
        });

      expect(eagerSuperAdminImports).toEqual([]);
    });

    it('should not eagerly import from @/pages/tenant-admin/', () => {
      const eagerTenantAdminImports = appTsx
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
          return /^import\s+.*from\s+["'].*\/pages\/tenant-admin\//.test(trimmed);
        });

      expect(eagerTenantAdminImports).toEqual([]);
    });

    it('should lazy-load AdminDebugPanel (not static import)', () => {
      // AdminDebugPanel must NOT be a static import
      const staticImport = /^import\s+\{[^}]*AdminDebugPanel[^}]*\}\s+from/m;
      expect(appTsx).not.toMatch(staticImport);

      // It should be lazy-loaded
      expect(appTsx).toMatch(/AdminDebugPanel\s*=\s*lazy\s*\(/);
    });
  });

  describe('shop pages do not import admin modules', () => {
    const publicDirs = [
      'pages/shop',
      'pages/store',
      'pages/public',
      'components/shop',
      'components/store',
    ];

    // Patterns that indicate admin-only code being pulled in
    const adminImportPatterns = [
      /@\/pages\/admin\//,
      /@\/pages\/super-admin\//,
      /@\/pages\/tenant-admin\//,
      /@\/components\/admin\//,
      /@\/layouts\/AdminLayout/,
      /@\/layouts\/SuperAdminLayout/,
    ];

    for (const dir of publicDirs) {
      it(`${dir}/ should not import from admin modules`, () => {
        let files: string[] = [];
        try {
          const { readdirSync, statSync } = require('fs');
          const fullDir = join(ROOT, dir);
          const walk = (d: string): string[] => {
            const entries = readdirSync(d) as string[];
            const result: string[] = [];
            for (const entry of entries) {
              const fullPath = join(d, entry);
              const stat = statSync(fullPath);
              if (stat.isDirectory()) {
                result.push(...walk(fullPath));
              } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.includes('.test.')) {
                result.push(fullPath);
              }
            }
            return result;
          };
          files = walk(fullDir);
        } catch {
          // Directory doesn't exist - that's fine
          return;
        }

        const violations: string[] = [];
        for (const file of files) {
          const content = readFileSync(file, 'utf8');
          for (const pattern of adminImportPatterns) {
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Skip type-only imports (erased at compile time)
              if (/import\s+type\s/.test(line)) continue;
              if (pattern.test(line)) {
                const relativePath = file.replace(ROOT + '/', '');
                violations.push(`${relativePath}:${i + 1} => ${line.trim()}`);
              }
            }
          }
        }

        expect(violations).toEqual([]);
      });
    }
  });

  describe('customer pages do not import admin modules', () => {
    it('pages/customer/ should not import from admin page/component modules', () => {
      let files: string[] = [];
      try {
        const { readdirSync, statSync } = require('fs');
        const fullDir = join(ROOT, 'pages/customer');
        const walk = (d: string): string[] => {
          const entries = readdirSync(d) as string[];
          const result: string[] = [];
          for (const entry of entries) {
            const fullPath = join(d, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              result.push(...walk(fullPath));
            } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.includes('.test.')) {
              result.push(fullPath);
            }
          }
          return result;
        };
        files = walk(fullDir);
      } catch {
        return;
      }

      const adminImportPatterns = [
        /@\/pages\/admin\//,
        /@\/pages\/super-admin\//,
        /@\/pages\/tenant-admin\//,
        /@\/components\/admin\//,
        /@\/layouts\/AdminLayout/,
      ];

      const violations: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const pattern of adminImportPatterns) {
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/import\s+type\s/.test(line)) continue;
            if (pattern.test(line)) {
              const relativePath = file.replace(ROOT + '/', '');
              violations.push(`${relativePath}:${i + 1} => ${line.trim()}`);
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('route boundary protection', () => {
    const appTsx = readSource('App.tsx');

    it('should wrap admin routes with TenantAdminProtectedRoute', () => {
      // The main admin layout route should be wrapped
      expect(appTsx).toContain('<TenantAdminProtectedRoute>');
    });

    it('should wrap super-admin routes with SuperAdminProtectedRouteNew', () => {
      expect(appTsx).toContain('<SuperAdminProtectedRouteNew>');
    });

    it('should use Suspense boundaries around admin layouts', () => {
      // Admin layout should be in a Suspense boundary
      expect(appTsx).toMatch(/Suspense.*AdminLayout/s);
    });

    it('should use separate skeleton fallbacks for admin and shop', () => {
      expect(appTsx).toContain('SkeletonAdminLayout');
      expect(appTsx).toContain('SkeletonStorefront');
    });
  });
});
