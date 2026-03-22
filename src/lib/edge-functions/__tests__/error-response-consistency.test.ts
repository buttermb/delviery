/**
 * Edge Function Error Response Consistency Tests
 *
 * Verifies that all edge functions return errors in the standard format:
 *   { error: string, code?: string, details?: unknown }
 *
 * Does NOT include `success: false` in error responses (the dominant pattern
 * before standardisation mixed `{ error }` and `{ success: false, error }`).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const FUNCTIONS_DIR = path.resolve(__dirname, '../../../../supabase/functions');

/** Directories to skip (shared code, not edge functions). */
const SKIP_DIRS = new Set(['_shared']);

/**
 * Get all edge function index.ts files.
 */
function getEdgeFunctionFiles(): string[] {
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
    const indexPath = path.join(FUNCTIONS_DIR, entry.name, 'index.ts');
    if (fs.existsSync(indexPath)) {
      files.push(indexPath);
    }
  }

  return files;
}

describe('Edge Function Error Response Consistency', () => {
  const edgeFunctionFiles = getEdgeFunctionFiles();

  it('should find edge function files to test', () => {
    expect(edgeFunctionFiles.length).toBeGreaterThan(0);
  });

  describe('No success: false in HTTP error responses', () => {
    /**
     * Matches `JSON.stringify({ success: false, error:` — the old pattern.
     * We allow `success: false` inside type assertions (e.g.,
     * `as { success: false; error: ... }`) since those are TypeScript
     * type casts, not actual response bodies.
     */
    const BAD_PATTERN = /JSON\.stringify\(\{\s*success:\s*false/;

    for (const filePath of edgeFunctionFiles) {
      const functionName = path.basename(path.dirname(filePath));

      it(`${functionName} should not include success: false in JSON.stringify`, () => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const violations: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (BAD_PATTERN.test(lines[i])) {
            violations.push(`  line ${i + 1}: ${lines[i].trim()}`);
          }
        }

        expect(
          violations,
          `${functionName}/index.ts has ${violations.length} error responses using { success: false, error } instead of { error }:\n${violations.join('\n')}`,
        ).toHaveLength(0);
      });
    }
  });

  describe('Error responses use the { error: string } envelope', () => {
    /**
     * Find lines that return a non-2xx Response with JSON.stringify but
     * do NOT include an `error` field. We look for status >= 400 responses.
     */
    const ERROR_RESPONSE_PATTERN =
      /new Response\(\s*JSON\.stringify\(/;
    const HAS_ERROR_FIELD = /\berror['":\s]/;
    const STATUS_ERROR = /status:\s*(4\d\d|5\d\d)/;

    for (const filePath of edgeFunctionFiles) {
      const functionName = path.basename(path.dirname(filePath));

      it(`${functionName} error responses should contain an "error" field`, () => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const violations: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check if this line creates a Response with JSON.stringify
          if (!ERROR_RESPONSE_PATTERN.test(line)) continue;

          // Look ahead up to 5 lines for the status code
          const chunk = lines.slice(i, i + 6).join(' ');

          // Only check error responses (4xx/5xx)
          if (!STATUS_ERROR.test(chunk)) continue;

          // The JSON.stringify content should contain an "error" key
          // Look at the stringify argument (up to the closing paren)
          const stringifyChunk = lines.slice(i, i + 4).join(' ');
          if (!HAS_ERROR_FIELD.test(stringifyChunk)) {
            violations.push(`  line ${i + 1}: ${line.trim()}`);
          }
        }

        // Allow up to 0 violations — strict consistency
        expect(
          violations,
          `${functionName}/index.ts has error responses without an "error" field:\n${violations.join('\n')}`,
        ).toHaveLength(0);
      });
    }
  });

  describe('Shared error-response helper exports correct format', () => {
    it('should exist in _shared directory', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      expect(fs.existsSync(helperPath)).toBe(true);
    });

    it('should export errorResponse function', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      const content = fs.readFileSync(helperPath, 'utf-8');
      expect(content).toContain('export function errorResponse');
    });

    it('should export errorJson function', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      const content = fs.readFileSync(helperPath, 'utf-8');
      expect(content).toContain('export function errorJson');
    });

    it('should NOT include success: false in error format', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      const content = fs.readFileSync(helperPath, 'utf-8');
      expect(content).not.toContain('success: false');
      expect(content).not.toContain("success: 'false'");
    });

    it('should include CORS headers', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      const content = fs.readFileSync(helperPath, 'utf-8');
      expect(content).toContain('corsHeaders');
    });

    it('should include Content-Type header', () => {
      const helperPath = path.join(FUNCTIONS_DIR, '_shared', 'error-response.ts');
      const content = fs.readFileSync(helperPath, 'utf-8');
      expect(content).toContain("'Content-Type': 'application/json'");
    });
  });
});
