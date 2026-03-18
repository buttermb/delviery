/**
 * Tests for report field constants
 * Verifies structure and completeness of REPORT_TYPES, REPORT_FIELDS,
 * DATE_RANGES, and SCHEDULE_OPTIONS
 */

import { describe, it, expect } from 'vitest';
import {
  REPORT_TYPES,
  REPORT_FIELDS,
  DATE_RANGES,
  SCHEDULE_OPTIONS,
  type ReportField,
} from '../reportFields';

describe('REPORT_TYPES', () => {
  it('contains all expected report types', () => {
    expect(REPORT_TYPES).toHaveProperty('pos');
    expect(REPORT_TYPES).toHaveProperty('inventory');
    expect(REPORT_TYPES).toHaveProperty('sales');
    expect(REPORT_TYPES).toHaveProperty('shifts');
    expect(REPORT_TYPES).toHaveProperty('customers');
    expect(REPORT_TYPES).toHaveProperty('products');
  });

  it('has human-readable labels', () => {
    expect(REPORT_TYPES.pos).toBe('POS Transactions');
    expect(REPORT_TYPES.sales).toBe('Sales & Orders');
    expect(REPORT_TYPES.inventory).toBe('Inventory');
  });
});

describe('REPORT_FIELDS', () => {
  it('has fields for every report type', () => {
    for (const key of Object.keys(REPORT_TYPES)) {
      expect(REPORT_FIELDS).toHaveProperty(key);
      expect(REPORT_FIELDS[key].length).toBeGreaterThan(0);
    }
  });

  it('every field has required properties', () => {
    for (const [type, fields] of Object.entries(REPORT_FIELDS)) {
      for (const field of fields) {
        expect(field).toHaveProperty('id');
        expect(field).toHaveProperty('label');
        expect(field).toHaveProperty('type');
        expect(field).toHaveProperty('category');

        expect(typeof field.id).toBe('string');
        expect(typeof field.label).toBe('string');
        expect(['text', 'number', 'date', 'currency', 'boolean']).toContain(field.type);
        expect(typeof field.category).toBe('string');
      }
    }
  });

  it('POS fields include financial fields', () => {
    const posFields = REPORT_FIELDS.pos;
    const financialFields = posFields.filter((f) => f.category === 'Financial');
    expect(financialFields.length).toBeGreaterThanOrEqual(3);

    const hasAmount = posFields.some((f) => f.id === 'total_amount');
    expect(hasAmount).toBe(true);
  });

  it('sales fields include customer and timing categories', () => {
    const salesFields = REPORT_FIELDS.sales;
    const hasCustomer = salesFields.some((f) => f.category === 'Customer');
    const hasTiming = salesFields.some((f) => f.category === 'Timing');
    expect(hasCustomer).toBe(true);
    expect(hasTiming).toBe(true);
  });

  it('field IDs are unique within each report type', () => {
    for (const [type, fields] of Object.entries(REPORT_FIELDS)) {
      const ids = fields.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

describe('DATE_RANGES', () => {
  it('contains expected presets', () => {
    const values = DATE_RANGES.map((r) => r.value);
    expect(values).toContain('today');
    expect(values).toContain('yesterday');
    expect(values).toContain('week');
    expect(values).toContain('month');
    expect(values).toContain('custom');
  });

  it('each range has value and label', () => {
    for (const range of DATE_RANGES) {
      expect(typeof range.value).toBe('string');
      expect(typeof range.label).toBe('string');
      expect(range.value.length).toBeGreaterThan(0);
      expect(range.label.length).toBeGreaterThan(0);
    }
  });
});

describe('SCHEDULE_OPTIONS', () => {
  it('includes manual and automatic options', () => {
    const values = SCHEDULE_OPTIONS.map((o) => o.value);
    expect(values).toContain('none');
    expect(values).toContain('daily');
    expect(values).toContain('weekly');
    expect(values).toContain('monthly');
  });

  it('none option has descriptive label', () => {
    const noneOption = SCHEDULE_OPTIONS.find((o) => o.value === 'none');
    expect(noneOption?.label).toContain('Manual');
  });
});
