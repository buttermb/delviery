/**
 * Invoice Credit Notes RLS Policy and Migration Tests
 *
 * Verifies the invoice_credit_notes table migration has:
 * 1. Correct table structure with all required columns
 * 2. RLS enabled with tenant isolation
 * 3. Proper indexes for performance
 * 4. Valid SQL syntax
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260318000000_create_invoice_credit_notes.sql'
);

let migrationContent: string;

try {
  migrationContent = readFileSync(migrationPath, 'utf-8');
} catch {
  migrationContent = '';
}

describe('Invoice Credit Notes Migration', () => {
  it('should have a valid SQL migration file', () => {
    expect(migrationContent).toBeTruthy();
    expect(migrationContent.length).toBeGreaterThan(100);
  });

  it('should have balanced parentheses', () => {
    const openParens = (migrationContent.match(/\(/g) ?? []).length;
    const closeParens = (migrationContent.match(/\)/g) ?? []).length;
    expect(openParens).toBe(closeParens);
  });

  it('should have balanced quotes', () => {
    const cleaned = migrationContent
      .replace(/--.*$/gm, '')
      .replace(/\\'/g, '');
    const singleQuotes = (cleaned.match(/'/g) ?? []).length;
    expect(singleQuotes % 2).toBe(0);
  });
});

describe('Table Structure', () => {
  it('should create invoice_credit_notes table', () => {
    expect(migrationContent).toMatch(/CREATE\s+TABLE.*invoice_credit_notes/i);
  });

  it('should have id as UUID primary key', () => {
    expect(migrationContent).toMatch(/id\s+uuid\s+PRIMARY\s+KEY/i);
  });

  it('should have tenant_id with foreign key to tenants', () => {
    expect(migrationContent).toMatch(/tenant_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.tenants/i);
  });

  it('should have invoice_id with foreign key to crm_invoices', () => {
    expect(migrationContent).toMatch(/invoice_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.crm_invoices/i);
  });

  it('should have client_id with foreign key to crm_clients', () => {
    expect(migrationContent).toMatch(/client_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+public\.crm_clients/i);
  });

  it('should have credit_note_number column', () => {
    expect(migrationContent).toMatch(/credit_note_number\s+text\s+NOT\s+NULL/i);
  });

  it('should have amount with positive check constraint', () => {
    expect(migrationContent).toMatch(/amount\s+numeric\(10,2\)\s+NOT\s+NULL/i);
    expect(migrationContent).toMatch(/CHECK\s*\(\s*amount\s*>\s*0\s*\)/i);
  });

  it('should have reason with valid enum check', () => {
    expect(migrationContent).toContain("'return'");
    expect(migrationContent).toContain("'discount'");
    expect(migrationContent).toContain("'overpayment'");
    expect(migrationContent).toContain("'adjustment'");
    expect(migrationContent).toContain("'other'");
  });

  it('should have status with valid enum check', () => {
    expect(migrationContent).toContain("'draft'");
    expect(migrationContent).toContain("'issued'");
    expect(migrationContent).toContain("'applied'");
  });

  it('should have issued_date column', () => {
    expect(migrationContent).toMatch(/issued_date\s+timestamptz/i);
  });

  it('should have timestamps', () => {
    expect(migrationContent).toMatch(/created_at\s+timestamptz/i);
    expect(migrationContent).toMatch(/updated_at\s+timestamptz/i);
  });

  it('should have unique constraint on credit_note_number per tenant', () => {
    expect(migrationContent).toMatch(/UNIQUE\s*\(\s*tenant_id\s*,\s*credit_note_number\s*\)/i);
  });
});

describe('RLS and Security', () => {
  it('should enable row level security', () => {
    expect(migrationContent).toMatch(/ALTER\s+TABLE.*invoice_credit_notes\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('should create tenant isolation policy', () => {
    expect(migrationContent).toMatch(/CREATE\s+POLICY/i);
    expect(migrationContent).toContain('tenant_id');
    expect(migrationContent).toContain('auth.uid()');
  });

  it('should not allow wildcard access', () => {
    // Should not have USING (true) pattern
    expect(migrationContent).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it('should use SECURITY DEFINER with search_path for trigger function', () => {
    expect(migrationContent).toMatch(/SECURITY\s+DEFINER/i);
    expect(migrationContent).toMatch(/SET\s+search_path\s*=\s*public/i);
  });
});

describe('Indexes', () => {
  it('should create index on tenant_id', () => {
    expect(migrationContent).toMatch(/CREATE\s+INDEX.*tenant.*ON.*invoice_credit_notes\s*\(\s*tenant_id\s*\)/i);
  });

  it('should create index on invoice_id', () => {
    expect(migrationContent).toMatch(/CREATE\s+INDEX.*invoice.*ON.*invoice_credit_notes\s*\(\s*invoice_id\s*\)/i);
  });

  it('should create index on client_id', () => {
    expect(migrationContent).toMatch(/CREATE\s+INDEX.*client.*ON.*invoice_credit_notes\s*\(\s*client_id\s*\)/i);
  });
});

describe('Updated_at Trigger', () => {
  it('should create an updated_at trigger function', () => {
    expect(migrationContent).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION.*update_invoice_credit_notes_updated_at/i);
  });

  it('should create a BEFORE UPDATE trigger', () => {
    expect(migrationContent).toMatch(/CREATE\s+TRIGGER[\s\S]*BEFORE\s+UPDATE\s+ON[\s\S]*invoice_credit_notes/i);
  });

  it('should set NEW.updated_at = now()', () => {
    expect(migrationContent).toMatch(/NEW\.updated_at\s*=\s*now\(\)/i);
  });
});

describe('PostgreSQL Compatibility', () => {
  it('should use valid PostgreSQL syntax', () => {
    expect(migrationContent).not.toContain('ENGINE=');
    expect(migrationContent).not.toContain('AUTO_INCREMENT');
    expect(migrationContent).not.toContain('USING BTREE');
  });

  it('should use timestamptz not timestamp', () => {
    // All timestamp columns should use timestamptz
    const timestampMatches = migrationContent.match(/timestamp(?!tz)/gi) ?? [];
    // Filter out matches that are actually part of 'timestamptz'
    const bareTimestamps = timestampMatches.filter(
      (m) => !migrationContent.includes(m + 'z') && !migrationContent.includes(m + 'Z')
    );
    expect(bareTimestamps.length).toBe(0);
  });

  it('should use CASCADE on foreign key deletes', () => {
    expect(migrationContent).toMatch(/ON\s+DELETE\s+CASCADE/i);
  });
});
