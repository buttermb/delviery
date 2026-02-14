/**
 * Tests for useRealtimeSync hook
 * Verifies that payments table has been removed from DEFAULT_TABLES
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Since we can't directly export DEFAULT_TABLES and getInvalidationEvent,
// we'll test the behavior through the public API and verify the implementation indirectly

describe('useRealtimeSync - Payments Removal', () => {
  it('should not include payments in the default tables list', () => {
    // Read the file content to verify DEFAULT_TABLES doesn't include 'payments'
    const fileContent = readFileSync(
      join(__dirname, 'useRealtimeSync.ts'),
      'utf-8'
    );

    // Verify DEFAULT_TABLES section doesn't include 'payments'
    const defaultTablesMatch = fileContent.match(/const DEFAULT_TABLES = \[([\s\S]*?)\]/);
    expect(defaultTablesMatch).toBeTruthy();

    if (defaultTablesMatch) {
      const defaultTablesContent = defaultTablesMatch[1];
      // Check that 'payments' is NOT in the active list
      expect(defaultTablesContent).not.toMatch(/'payments'/);
      expect(defaultTablesContent).not.toMatch(/"payments"/);

      // Verify it includes the expected tables
      expect(defaultTablesContent).toMatch(/'orders'/);
      expect(defaultTablesContent).toMatch(/'wholesale_orders'/);
      expect(defaultTablesContent).toMatch(/'products'/);
      expect(defaultTablesContent).toMatch(/'menu_orders'/);
    }
  });

  it('should not have a payments case in getInvalidationEvent function', () => {
    // Read the file content to verify getInvalidationEvent doesn't handle payments
    const fileContent = readFileSync(
      join(__dirname, 'useRealtimeSync.ts'),
      'utf-8'
    );

    // Find the getInvalidationEvent function
    const functionMatch = fileContent.match(
      /function getInvalidationEvent\(([\s\S]*?)\n\s*return null;\s*\n}/
    );
    expect(functionMatch).toBeTruthy();

    if (functionMatch) {
      const functionBody = functionMatch[1];

      // Verify there's no case 'payments': in the switch statement
      expect(functionBody).not.toMatch(/case ['"]payments['"]/);

      // Verify there IS a case for 'refunds' (which comes after in the PAYMENTS & FINANCE section)
      expect(functionBody).toMatch(/case ['"]refunds['"]/);

      // Verify there are no PAYMENT_RECEIVED events
      expect(functionBody).not.toMatch(/PAYMENT_RECEIVED/);
    }
  });

  it('should have payments listed in the removed tables comment', () => {
    // Verify that payments is documented as removed in the comment
    const fileContent = readFileSync(
      join(__dirname, 'useRealtimeSync.ts'),
      'utf-8'
    );

    // Check the comment mentions payments as removed
    expect(fileContent).toMatch(/Removed for performance:.*payments/i);
  });

  it('should still include critical tables in DEFAULT_TABLES', () => {
    const fileContent = readFileSync(
      join(__dirname, 'useRealtimeSync.ts'),
      'utf-8'
    );

    const defaultTablesMatch = fileContent.match(/const DEFAULT_TABLES = \[([\s\S]*?)\]/);
    expect(defaultTablesMatch).toBeTruthy();

    if (defaultTablesMatch) {
      const defaultTablesContent = defaultTablesMatch[1];

      // Verify critical tables are still present
      const criticalTables = ['orders', 'wholesale_orders', 'products', 'menu_orders'];
      criticalTables.forEach(table => {
        expect(defaultTablesContent).toMatch(new RegExp(`['"]${table}['"]`));
      });
    }
  });
});
