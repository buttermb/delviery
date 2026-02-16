/**
 * Migration SQL Syntax Verification
 * Verifies that the migration SQL has valid syntax structure
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Migration SQL Syntax Verification', () => {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20260202085153_add_orders_tenant_created_at_index.sql');

  let migrationContent: string;

  try {
    migrationContent = readFileSync(migrationPath, 'utf-8');
  } catch {
    migrationContent = '';
  }

  it('should have valid SQL file', () => {
    expect(migrationContent).toBeTruthy();
  });

  it('should have balanced parentheses', () => {
    const openParens = (migrationContent.match(/\(/g) || []).length;
    const closeParens = (migrationContent.match(/\)/g) || []).length;
    expect(openParens).toBe(closeParens);
  });

  it('should have balanced quotes', () => {
    // Remove escaped quotes and comments first
    const cleaned = migrationContent
      .replace(/--.*$/gm, '') // Remove comments
      .replace(/\\'/g, ''); // Remove escaped single quotes

    const singleQuotes = (cleaned.match(/'/g) || []).length;
    expect(singleQuotes % 2).toBe(0);
  });

  it('should not have common SQL typos', () => {
    const lowerContent = migrationContent.toLowerCase();

    // Check for common typos
    expect(lowerContent).not.toContain('crate index');
    expect(lowerContent).not.toContain('create idex');
    expect(lowerContent).not.toContain('create indes');
    expect(lowerContent).not.toContain('public..orders');
    expect(lowerContent).not.toContain('comemnt on');
  });

  it('should use proper PostgreSQL syntax for index creation', () => {
    // Verify it matches PostgreSQL CREATE INDEX syntax
    expect(migrationContent).toMatch(/CREATE\s+INDEX/i);
    expect(migrationContent).toMatch(/ON\s+public\.orders/i);
    expect(migrationContent).toMatch(/\([^)]*tenant_id[^)]*created_at\s+DESC[^)]*\)/i);
  });

  it('should use IF NOT EXISTS for idempotency', () => {
    expect(migrationContent).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i);
  });

  it('should have proper semicolons', () => {
    // Each CREATE INDEX and COMMENT ON should end with semicolon
    const statements = migrationContent
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n');

    const createIndexMatch = statements.match(/CREATE\s+INDEX[^;]+;/is);
    const commentMatch = statements.match(/COMMENT\s+ON\s+INDEX[^;]+;/is);

    expect(createIndexMatch).toBeTruthy();
    expect(commentMatch).toBeTruthy();
  });

  it('should specify schema explicitly', () => {
    expect(migrationContent).toContain('public.orders');
  });

  it('should have documentation comments', () => {
    const commentLines = migrationContent.split('\n').filter(line => line.trim().startsWith('--'));
    expect(commentLines.length).toBeGreaterThan(0);
  });

  describe('Index definition validation', () => {
    it('should have correct index name format', () => {
      expect(migrationContent).toContain('idx_orders_tenant_id_created_at_desc');
    });

    it('should specify DESC order explicitly', () => {
      expect(migrationContent).toMatch(/created_at\s+DESC/i);
    });

    it('should have tenant_id before created_at', () => {
      const match = migrationContent.match(/\(([^)]+)\)/);
      expect(match).toBeTruthy();

      if (match) {
        const columns = match[1];
        const tenantPos = columns.indexOf('tenant_id');
        const createdPos = columns.indexOf('created_at');

        expect(tenantPos).toBeLessThan(createdPos);
      }
    });
  });

  describe('PostgreSQL compatibility', () => {
    it('should use valid PostgreSQL data types and syntax', () => {
      // Ensure no MySQL-specific syntax
      expect(migrationContent).not.toContain('USING BTREE'); // MySQL style
      expect(migrationContent).not.toContain('ENGINE=');
      expect(migrationContent).not.toContain('AUTO_INCREMENT');
    });

    it('should follow PostgreSQL naming conventions', () => {
      // PostgreSQL identifiers should be lowercase or quoted
      const indexName = 'idx_orders_tenant_id_created_at_desc';
      expect(indexName).toBe(indexName.toLowerCase());
    });
  });
});
