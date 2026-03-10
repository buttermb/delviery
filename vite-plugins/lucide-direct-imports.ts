/**
 * Vite plugin to transform lucide-react barrel imports into direct icon imports.
 *
 * Before: import { Home, Settings, User } from 'lucide-react'
 * After:  import Home from 'lucide-react/dist/esm/icons/house.js'
 *         import Settings from 'lucide-react/dist/esm/icons/settings.js'
 *         import User from 'lucide-react/dist/esm/icons/user.js'
 *
 * This avoids parsing the full barrel (1,583 icons) on every import,
 * improving dev HMR speed and reducing production parse overhead.
 *
 * The mapping is extracted from the barrel file at plugin init time.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

/**
 * Build a mapping of { ComponentName → icon-file-stem } from the barrel.
 */
function buildIconMapping(root: string): Map<string, string> {
  const barrelPath = resolve(root, 'node_modules/lucide-react/dist/esm/lucide-react.js');
  let barrelContent: string;
  try {
    barrelContent = readFileSync(barrelPath, 'utf8');
  } catch {
    return new Map();
  }

  const map = new Map<string, string>();
  // Match: export { default as SomeName, ... } from './icons/some-name.js'
  // The barrel line may list several aliases — capture each named export individually.
  const lineRe = /export \{([^}]+)\} from '\.\/icons\/([\w-]+)\.js'/g;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineRe.exec(barrelContent)) !== null) {
    const names = lineMatch[1];
    const file = lineMatch[2];
    // Split "default as Foo, default as FooIcon, default as LucideFoo"
    for (const part of names.split(',')) {
      const asMatch = part.trim().match(/default as (\w+)/);
      if (asMatch) {
        const name = asMatch[1];
        // Skip LucideXxx and XxxIcon aliases — they're never used in our codebase
        if (!name.startsWith('Lucide') && !name.endsWith('Icon')) {
          map.set(name, file);
        }
      }
    }
  }

  return map;
}

/**
 * Match `import { ... } from 'lucide-react'` statements.
 * Captures the import specifiers block (everything between { and }).
 * Handles multi-line imports and type imports.
 */
const IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;

/**
 * Match `import type { ... } from 'lucide-react'` separately so we can
 * preserve the `type` keyword (these are erased at compile time anyway,
 * but keeping them avoids TS errors).
 */
const TYPE_IMPORT_RE = /import\s+type\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g;

export function lucideDirectImportsPlugin(): Plugin {
  let iconMap: Map<string, string>;

  return {
    name: 'vite-plugin-lucide-direct-imports',
    enforce: 'pre',

    configResolved(config) {
      iconMap = buildIconMapping(config.root);
    },

    transform(code, id) {
      // Only process project source files (not node_modules, not virtual modules)
      if (!id.includes('/src/') || id.includes('node_modules')) return null;
      if (!code.includes('lucide-react')) return null;

      let transformed = code;
      let hasChanges = false;

      // Handle type imports — keep as-is (they're erased at compile time and
      // don't cause runtime barrel loading)
      // We skip them so the value-import regex below doesn't match them.

      // Handle value imports
      transformed = transformed.replace(IMPORT_RE, (fullMatch, specifiers: string) => {
        // Skip if this is actually a type import (already handled)
        if (fullMatch.includes('import type')) return fullMatch;

        const names = specifiers
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        // Check if ALL names can be resolved to direct imports
        const resolved: Array<{ name: string; alias: string; file: string }> = [];
        const unresolved: string[] = [];

        for (const spec of names) {
          // Handle `Foo as Bar` aliases
          const aliasMatch = spec.match(/^(\w+)\s+as\s+(\w+)$/);
          const originalName = aliasMatch ? aliasMatch[1] : spec;
          const localName = aliasMatch ? aliasMatch[2] : spec;

          // Skip type-only specifiers like `type LucideIcon`
          if (spec.startsWith('type ')) {
            unresolved.push(spec);
            continue;
          }

          const file = iconMap.get(originalName);
          if (file) {
            resolved.push({ name: originalName, alias: localName, file });
          } else {
            // Could be a non-icon export (e.g., createLucideIcon, LucideProps)
            unresolved.push(spec);
          }
        }

        // If nothing could be resolved, leave unchanged
        if (resolved.length === 0) return fullMatch;

        hasChanges = true;

        // Build direct imports for resolved icons
        const directImports = resolved.map(({ name, alias, file }) => {
          const importName = name === alias ? alias : `${name} as ${alias}`;
          // Use named re-export from individual icon file — each file
          // does `export { default }` so we import the default and alias it
          return `import ${alias} from 'lucide-react/dist/esm/icons/${file}.js'`;
        });

        // Keep barrel import for unresolved exports (non-icon things like types, utils)
        if (unresolved.length > 0) {
          directImports.push(`import { ${unresolved.join(', ')} } from 'lucide-react'`);
        }

        return directImports.join(';\n');
      });

      if (!hasChanges) return null;

      return { code: transformed, map: null };
    },
  };
}
