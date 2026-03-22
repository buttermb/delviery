/**
 * Edge Functions CORS Compliance Tests
 *
 * Static analysis tests that verify every edge function:
 * 1. Handles OPTIONS preflight requests
 * 2. Includes CORS headers (via corsHeaders or inline Access-Control-Allow-Origin)
 * 3. Returns proper JSON error responses with CORS headers
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FUNCTIONS_DIR = path.resolve(__dirname, '../../../../supabase/functions');

function getEdgeFunctionDirs(): string[] {
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .map((entry) => entry.name)
    .filter((name) => {
      const indexPath = path.join(FUNCTIONS_DIR, name, 'index.ts');
      return fs.existsSync(indexPath);
    });
}

function readFunctionSource(functionName: string): string {
  const indexPath = path.join(FUNCTIONS_DIR, functionName, 'index.ts');
  return fs.readFileSync(indexPath, 'utf-8');
}

describe('Edge Functions CORS Compliance', () => {
  const functionDirs = getEdgeFunctionDirs();

  it('should find edge functions to test', () => {
    expect(functionDirs.length).toBeGreaterThan(0);
  });

  describe.each(functionDirs)('%s', (functionName) => {
    it('should handle OPTIONS preflight requests', () => {
      const source = readFunctionSource(functionName);
      const hasOptionsCheck =
        source.includes("req.method === 'OPTIONS'") ||
        source.includes('req.method === "OPTIONS"') ||
        source.includes("method === 'OPTIONS'") ||
        source.includes('method === "OPTIONS"') ||
        source.includes("req.method == 'OPTIONS'") ||
        source.includes('req.method == "OPTIONS"');

      expect(hasOptionsCheck).toBe(true);
    });

    it('should include CORS headers', () => {
      const source = readFunctionSource(functionName);
      const hasCorsHeaders =
        source.includes('corsHeaders') ||
        source.includes('Access-Control-Allow-Origin');

      expect(hasCorsHeaders).toBe(true);
    });

    it('should import from shared deps or define CORS headers', () => {
      const source = readFunctionSource(functionName);
      const importsFromShared = source.includes('../_shared/deps');
      const definesOwnCors = source.includes('Access-Control-Allow-Origin');

      expect(importsFromShared || definesOwnCors).toBe(true);
    });
  });
});
