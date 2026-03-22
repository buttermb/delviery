/**
 * Verifies that the stripe-customer-portal edge function uses .maybeSingle()
 * instead of .single() for Supabase queries, following FloraIQ conventions.
 *
 * .maybeSingle() returns null gracefully when no row is found, while .single()
 * throws a PGRST116 error. The project standard is to always use .maybeSingle().
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('stripe-customer-portal edge function', () => {
  const edgeFunctionPath = resolve(
    __dirname,
    '../../supabase/functions/stripe-customer-portal/index.ts'
  );

  let source: string;

  try {
    source = readFileSync(edgeFunctionPath, 'utf-8');
  } catch {
    source = '';
  }

  it('should have a readable source file', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('should NOT use .single() for Supabase queries', () => {
    // Match .single() but not .maybeSingle()
    const singleCallRegex = /(?<!maybe)\.single\(\)/g;
    const matches = source.match(singleCallRegex);

    expect(matches).toBeNull();
  });

  it('should use .maybeSingle() for tenant lookup query', () => {
    expect(source).toContain(".maybeSingle()");
  });

  it('should handle null tenant gracefully after .maybeSingle()', () => {
    // Verify there is a null/error check after the tenant query
    expect(source).toMatch(/tenantError\s*\|\|\s*!tenant/);
  });

  it('should use .maybeSingle() for tenant_users lookup query', () => {
    // The tenant_users query should also use .maybeSingle()
    const tenantUsersBlock = source.slice(
      source.indexOf("from('tenant_users')"),
      source.indexOf("from('tenant_users')") + 200
    );
    expect(tenantUsersBlock).toContain('.maybeSingle()');
  });
});
