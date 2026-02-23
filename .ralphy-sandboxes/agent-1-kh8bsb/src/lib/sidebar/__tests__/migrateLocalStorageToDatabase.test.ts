/**
 * Migration Utility Tests
 * Tests localStorage to database migration logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { migrateLocalStorageToDatabase, resetMigrationState } from '../migrateLocalStorageToDatabase';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: () => Promise.resolve({ error: null })
    })
  }
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

describe('migrateLocalStorageToDatabase', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should skip migration if already completed', async () => {
    localStorage.setItem('sidebar_migration_complete', 'true');

    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(false);
  });

  it('should migrate operation size', async () => {
    localStorage.setItem('sidebar_operation_size', 'medium');

    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(true);
  });

  it('should migrate favorites', async () => {
    localStorage.setItem('sidebar_favorites', JSON.stringify(['dashboard', 'products']));

    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(true);
  });

  it('should migrate collapsed sections', async () => {
    localStorage.setItem('sidebar_collapsed_sections', JSON.stringify(['reports']));

    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(true);
  });

  it('should handle empty localStorage gracefully', async () => {
    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(false);
  });

  it('should mark migration as complete', async () => {
    localStorage.setItem('sidebar_favorites', JSON.stringify(['dashboard']));

    await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(localStorage.getItem('sidebar_migration_complete')).toBe('true');
  });

  it('should clear legacy storage after migration', async () => {
    localStorage.setItem('sidebar_operation_size', 'medium');
    localStorage.setItem('sidebar_favorites', JSON.stringify(['dashboard']));

    await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(localStorage.getItem('sidebar_operation_size')).toBeNull();
    expect(localStorage.getItem('sidebar_favorites')).toBeNull();
  });

  it('should handle invalid JSON gracefully', async () => {
    localStorage.setItem('sidebar_favorites', 'invalid-json');

    const result = await migrateLocalStorageToDatabase('tenant-1', 'user-1');

    expect(result.success).toBe(true);
    expect(result.migrated).toBe(false);
  });

  it('should reset migration state', () => {
    localStorage.setItem('sidebar_migration_complete', 'true');

    resetMigrationState();

    expect(localStorage.getItem('sidebar_migration_complete')).toBeNull();
  });
});
