/**
 * Test for sync_credit_costs_all_action_keys migration
 *
 * Verifies:
 * 1. All action keys from CREDIT_COSTS in creditCosts.ts are present in the migration SQL
 * 2. Credit costs in the migration match the TypeScript definitions
 * 3. Categories in the migration match the TypeScript definitions
 * 4. Migration uses proper ON CONFLICT upsert pattern
 * 5. No duplicate action keys in the migration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CREDIT_COSTS } from '@/lib/credits/creditCosts';

const MIGRATION_PATH = resolve(
  __dirname,
  '../20260321100000_sync_credit_costs_all_action_keys.sql'
);

let migrationSql: string;

/** Parse INSERT VALUES from migration SQL into a map of action_key -> { cost, category, description } */
function parseMigrationValues(sql: string): Map<string, { cost: number; category: string; description: string }> {
  const result = new Map<string, { cost: number; category: string; description: string }>();

  // Match all value tuples: ('action_key', cost, 'category', 'description', true/false)
  const valueRegex = /\('([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']*)',\s*(true|false)\)/g;
  let match: RegExpExecArray | null;

  while ((match = valueRegex.exec(sql)) !== null) {
    const [, actionKey, costStr, category, description] = match;
    result.set(actionKey, {
      cost: parseInt(costStr, 10),
      category,
      description,
    });
  }

  return result;
}

describe('sync_credit_costs_all_action_keys migration', () => {
  beforeAll(() => {
    migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('should be a valid SQL file', () => {
    expect(migrationSql).toBeTruthy();
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  it('should use ON CONFLICT upsert pattern', () => {
    expect(migrationSql).toContain('ON CONFLICT (action_key) DO UPDATE SET');
    expect(migrationSql).toContain('credit_cost = EXCLUDED.credit_cost');
    expect(migrationSql).toContain('category = EXCLUDED.category');
    expect(migrationSql).toContain('is_active = EXCLUDED.is_active');
  });

  describe('action key completeness', () => {
    let migrationKeys: Map<string, { cost: number; category: string; description: string }>;
    let tsKeys: string[];

    beforeAll(() => {
      migrationKeys = parseMigrationValues(migrationSql);
      tsKeys = Object.keys(CREDIT_COSTS);
    });

    it('should contain all action keys from CREDIT_COSTS', () => {
      const missingKeys: string[] = [];

      for (const key of tsKeys) {
        if (!migrationKeys.has(key)) {
          missingKeys.push(key);
        }
      }

      expect(missingKeys).toEqual([]);
    });

    it('should have at least 140 action keys in the migration', () => {
      // CREDIT_COSTS has 170+ keys; migration may have a few extra (notification-specific)
      expect(migrationKeys.size).toBeGreaterThanOrEqual(140);
    });

    it('should have the correct number of action keys matching CREDIT_COSTS', () => {
      // All TS keys should be present
      const tsKeyCount = tsKeys.length;
      expect(tsKeyCount).toBeGreaterThanOrEqual(140);
      // Migration may have extra keys beyond what's in CREDIT_COSTS (e.g. notification-specific)
      expect(migrationKeys.size).toBeGreaterThanOrEqual(tsKeyCount);
    });
  });

  describe('credit cost consistency', () => {
    let migrationKeys: Map<string, { cost: number; category: string; description: string }>;

    beforeAll(() => {
      migrationKeys = parseMigrationValues(migrationSql);
    });

    it('should have matching credit costs for all action keys', () => {
      const mismatches: Array<{ key: string; tsCost: number; sqlCost: number }> = [];

      for (const [key, costInfo] of Object.entries(CREDIT_COSTS)) {
        const sqlEntry = migrationKeys.get(key);
        if (sqlEntry && sqlEntry.cost !== costInfo.credits) {
          mismatches.push({
            key,
            tsCost: costInfo.credits,
            sqlCost: sqlEntry.cost,
          });
        }
      }

      expect(mismatches).toEqual([]);
    });

    it('should have matching categories for all action keys', () => {
      const mismatches: Array<{ key: string; tsCategory: string; sqlCategory: string }> = [];

      for (const [key, costInfo] of Object.entries(CREDIT_COSTS)) {
        const sqlEntry = migrationKeys.get(key);
        if (sqlEntry && sqlEntry.category !== costInfo.category) {
          mismatches.push({
            key,
            tsCategory: costInfo.category,
            sqlCategory: sqlEntry.category,
          });
        }
      }

      expect(mismatches).toEqual([]);
    });
  });

  describe('no duplicate action keys', () => {
    it('should not have duplicate action keys in the migration', () => {
      const keyRegex = /\('([^']+)',\s*\d+,\s*'[^']+',\s*'[^']*',\s*(?:true|false)\)/g;
      const keys: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = keyRegex.exec(migrationSql)) !== null) {
        keys.push(match[1]);
      }

      const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
      expect(duplicates).toEqual([]);
    });
  });

  describe('specific high-value action keys', () => {
    let migrationKeys: Map<string, { cost: number; category: string; description: string }>;

    beforeAll(() => {
      migrationKeys = parseMigrationValues(migrationSql);
    });

    it.each([
      ['menu_create', 100, 'menus'],
      ['menu_ocr', 250, 'ai'],
      ['storefront_create', 500, 'marketplace'],
      ['order_create_manual', 50, 'orders'],
      ['pos_process_sale', 25, 'pos'],
      ['send_sms', 25, 'crm'],
      ['send_email', 10, 'crm'],
      ['invoice_create', 50, 'invoices'],
      ['route_optimize', 50, 'fleet'],
      ['ai_suggestions', 100, 'ai'],
      ['data_warehouse_export', 200, 'exports'],
      ['report_advanced_generate', 100, 'reports'],
      ['wholesale_order_place', 100, 'wholesale'],
      ['compliance_report_generate', 100, 'compliance'],
    ] as const)('should have %s at %d credits in %s category', (key, expectedCost, expectedCategory) => {
      const entry = migrationKeys.get(key);
      expect(entry).toBeDefined();
      expect(entry!.cost).toBe(expectedCost);
      expect(entry!.category).toBe(expectedCategory);
    });
  });

  describe('free actions', () => {
    let migrationKeys: Map<string, { cost: number; category: string; description: string }>;

    beforeAll(() => {
      migrationKeys = parseMigrationValues(migrationSql);
    });

    it.each([
      'dashboard_view',
      'orders_view',
      'settings_view',
      'team_manage',
      'batch_recall_initiate',
      'export_csv',
      'export_pdf',
      'customer_view',
      'delivery_mark_complete',
    ])('should have %s as free (0 credits)', (key) => {
      const entry = migrationKeys.get(key);
      expect(entry).toBeDefined();
      expect(entry!.cost).toBe(0);
    });
  });

  describe('legacy aliases', () => {
    let migrationKeys: Map<string, { cost: number; category: string; description: string }>;

    beforeAll(() => {
      migrationKeys = parseMigrationValues(migrationSql);
    });

    it.each([
      ['create_order', 50],
      ['add_product', 10],
      ['add_customer', 5],
      ['generate_invoice', 50],
      ['send_menu_link', 0],
      ['update_inventory', 3],
      ['create_delivery_route', 50],
    ] as const)('should include legacy alias %s at %d credits', (key, expectedCost) => {
      const entry = migrationKeys.get(key);
      expect(entry).toBeDefined();
      expect(entry!.cost).toBe(expectedCost);
    });
  });

  describe('deactivation of old dot-notation keys', () => {
    it('should include UPDATE to deactivate old dot-notation keys', () => {
      expect(migrationSql).toContain("action_key LIKE '%.%'");
      expect(migrationSql).toContain('is_active = false');
    });
  });
});
