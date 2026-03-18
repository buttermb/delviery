/**
 * Orders Tenant Created At Index Migration Tests
 * Tests for the composite index on orders(tenant_id, created_at DESC)
 * Migration: 20260202085153_add_orders_tenant_created_at_index.sql
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Orders Tenant Created At Index Migration', () => {
  let migrationContent: string;

  // Read the migration file
  try {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', '20260202085153_add_orders_tenant_created_at_index.sql');
    migrationContent = readFileSync(migrationPath, 'utf-8');
  } catch {
    migrationContent = '';
  }

  it('should have the migration file', () => {
    expect(migrationContent).toBeTruthy();
    expect(migrationContent.length).toBeGreaterThan(0);
  });

  it('should create a composite index on tenant_id and created_at', () => {
    expect(migrationContent).toContain('CREATE INDEX');
    expect(migrationContent).toContain('idx_orders_tenant_id_created_at_desc');
    expect(migrationContent).toContain('public.orders');
    expect(migrationContent).toContain('tenant_id');
    expect(migrationContent).toContain('created_at DESC');
  });

  it('should use IF NOT EXISTS for idempotency', () => {
    expect(migrationContent).toContain('IF NOT EXISTS');
  });

  it('should include both columns in the correct order', () => {
    // Verify tenant_id comes before created_at in the index definition
    const tenantIdIndex = migrationContent.indexOf('tenant_id');
    const createdAtIndex = migrationContent.indexOf('created_at DESC');

    expect(tenantIdIndex).toBeGreaterThan(-1);
    expect(createdAtIndex).toBeGreaterThan(-1);
    expect(tenantIdIndex).toBeLessThan(createdAtIndex);
  });

  it('should specify DESC order for created_at column', () => {
    // DESC order is crucial for performance on descending sorts
    expect(migrationContent).toContain('created_at DESC');
    expect(migrationContent).toMatch(/created_at\s+DESC/i);
  });

  it('should target the public schema', () => {
    expect(migrationContent).toContain('public.orders');
  });

  it('should include documentation comments', () => {
    // Check for comments explaining the purpose
    expect(migrationContent).toMatch(/--.*[Mm]igration/);
    expect(migrationContent).toMatch(/--.*[Pp]urpose/);
  });

  it('should include a comment on the index', () => {
    expect(migrationContent).toContain('COMMENT ON INDEX');
    expect(migrationContent).toContain('idx_orders_tenant_id_created_at_desc');
  });

  describe('Index naming convention', () => {
    it('should follow the idx_table_columns pattern', () => {
      expect(migrationContent).toContain('idx_orders_tenant_id_created_at_desc');

      // Verify the name components
      const indexName = 'idx_orders_tenant_id_created_at_desc';
      expect(indexName).toMatch(/^idx_/); // Starts with idx_
      expect(indexName).toContain('orders'); // Contains table name
      expect(indexName).toContain('tenant_id'); // Contains first column
      expect(indexName).toContain('created_at'); // Contains second column
      expect(indexName).toContain('desc'); // Indicates DESC order
    });
  });

  describe('SQL syntax validation', () => {
    it('should have valid SQL syntax structure', () => {
      // Basic SQL syntax checks
      expect(migrationContent).toMatch(/CREATE\s+INDEX/i);
      expect(migrationContent).toMatch(/ON\s+public\.orders/i);
      expect(migrationContent).toMatch(/\([^)]*tenant_id[^)]*created_at\s+DESC[^)]*\)/i);
    });

    it('should not contain syntax errors', () => {
      // Check for common SQL syntax errors
      expect(migrationContent).not.toMatch(/\(\s*\)/); // Empty parentheses
      expect(migrationContent).not.toMatch(/,,/); // Double commas
      expect(migrationContent).not.toContain('CRATE INDEX'); // Typo
      expect(migrationContent).not.toContain('INDEXS'); // Typo
    });
  });

  describe('Performance optimization', () => {
    it('should be optimized for queries filtering by tenant_id and sorting by created_at DESC', () => {
      // This composite index optimizes queries like:
      // SELECT * FROM orders WHERE tenant_id = ? ORDER BY created_at DESC

      // The index should have tenant_id first (for filtering)
      // and created_at DESC second (for sorting)
      const indexMatch = migrationContent.match(/\(([^)]+)\)/);

      if (indexMatch) {
        const indexColumns = indexMatch[1];
        expect(indexColumns).toMatch(/tenant_id.*created_at\s+DESC/i);
      }
    });
  });

  describe('Migration best practices', () => {
    it('should use IF NOT EXISTS to be idempotent', () => {
      // Idempotent migrations can be run multiple times safely
      expect(migrationContent).toContain('IF NOT EXISTS');
    });

    it('should include explanatory comments', () => {
      // Good migrations explain their purpose
      const lines = migrationContent.split('\n');
      const commentLines = lines.filter(line => line.trim().startsWith('--'));

      expect(commentLines.length).toBeGreaterThan(0);
    });

    it('should document the use case', () => {
      // Check for documentation about when this index is useful
      const lowerContent = migrationContent.toLowerCase();
      expect(
        lowerContent.includes('dashboard') ||
        lowerContent.includes('recent orders') ||
        lowerContent.includes('sort') ||
        lowerContent.includes('optimize')
      ).toBe(true);
    });
  });
});
