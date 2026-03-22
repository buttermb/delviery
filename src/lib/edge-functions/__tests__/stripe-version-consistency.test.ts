/**
 * Stripe API Version Consistency Tests
 *
 * Ensures all edge functions use the shared Stripe configuration
 * from _shared/stripe.ts rather than importing Stripe directly
 * or hardcoding the API version.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_DIR = path.resolve(__dirname, '../../../../supabase/functions');
const SHARED_STRIPE_PATH = path.join(FUNCTIONS_DIR, '_shared', 'stripe.ts');

/** Recursively find all .ts files in edge function directories. */
function getEdgeFunctionFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getEdgeFunctionFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Stripe API Version Consistency', () => {
  it('shared stripe.ts module should exist', () => {
    expect(fs.existsSync(SHARED_STRIPE_PATH)).toBe(true);
  });

  it('shared stripe.ts should export STRIPE_API_VERSION constant', () => {
    const content = fs.readFileSync(SHARED_STRIPE_PATH, 'utf-8');
    expect(content).toContain('export const STRIPE_API_VERSION');
  });

  it('shared stripe.ts should export Stripe class', () => {
    const content = fs.readFileSync(SHARED_STRIPE_PATH, 'utf-8');
    expect(content).toMatch(/export.*Stripe.*from/);
  });

  it('shared stripe.ts should pin a single Stripe SDK version', () => {
    const content = fs.readFileSync(SHARED_STRIPE_PATH, 'utf-8');
    const versionMatches = content.match(/esm\.sh\/stripe@[\d.]+/g) ?? [];
    expect(versionMatches).toHaveLength(1);
  });

  it('no edge function should import Stripe directly from esm.sh', () => {
    const files = getEdgeFunctionFiles(FUNCTIONS_DIR);
    const violations: string[] = [];

    for (const file of files) {
      // Skip the shared module itself
      if (file === SHARED_STRIPE_PATH) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (/from\s+['"]https:\/\/esm\.sh\/stripe/.test(content)) {
        const relative = path.relative(FUNCTIONS_DIR, file);
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

  it('no edge function should hardcode the Stripe API version string', () => {
    const files = getEdgeFunctionFiles(FUNCTIONS_DIR);
    const violations: string[] = [];

    // Read the actual API version from the shared module
    const sharedContent = fs.readFileSync(SHARED_STRIPE_PATH, 'utf-8');
    const versionMatch = sharedContent.match(/STRIPE_API_VERSION\s*=\s*["']([^"']+)["']/);
    expect(versionMatch).not.toBeNull();
    const apiVersion = versionMatch![1];

    for (const file of files) {
      // Skip the shared module itself
      if (file === SHARED_STRIPE_PATH) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes(apiVersion)) {
        const relative = path.relative(FUNCTIONS_DIR, file);
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

  it('all edge functions using Stripe should import from _shared/stripe.ts', () => {
    const files = getEdgeFunctionFiles(FUNCTIONS_DIR);
    const missingImport: string[] = [];

    for (const file of files) {
      if (file === SHARED_STRIPE_PATH) continue;

      const content = fs.readFileSync(file, 'utf-8');

      // If the file uses Stripe (new Stripe or apiVersion), it must import from shared
      const usesStripe = /new Stripe\(/.test(content) || /STRIPE_API_VERSION/.test(content);
      const importsFromShared = /from\s+['"]\.\.?\/_shared\/stripe\.ts['"]/.test(content);

      if (usesStripe && !importsFromShared) {
        const relative = path.relative(FUNCTIONS_DIR, file);
        missingImport.push(relative);
      }
    }

    expect(missingImport).toEqual([]);
  });

  it('STRIPE_API_VERSION should be used consistently in all Stripe instantiations', () => {
    const files = getEdgeFunctionFiles(FUNCTIONS_DIR);
    const inconsistent: string[] = [];

    for (const file of files) {
      if (file === SHARED_STRIPE_PATH) continue;

      const content = fs.readFileSync(file, 'utf-8');

      // Check for apiVersion with a hardcoded string (not using the constant)
      const hardcodedVersionPattern = /apiVersion:\s*['"][^'"]+['"]/;
      if (hardcodedVersionPattern.test(content)) {
        const relative = path.relative(FUNCTIONS_DIR, file);
        inconsistent.push(relative);
      }
    }

    expect(inconsistent).toEqual([]);
  });
});
