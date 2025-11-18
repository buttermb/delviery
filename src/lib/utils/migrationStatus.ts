// src/lib/utils/migrationStatus.ts
// Utilities for checking encryption migration status

import { supabase } from '@/integrations/supabase/client';
import { ENCRYPTED_TABLES } from '../encryption/constants';
import { logger } from '../logger';

export interface MigrationStatus {
  table: string;
  totalRecords: number;
  encryptedRecords: number;
  plaintextRecords: number;
  percentageEncrypted: number;
  status: 'not_started' | 'in_progress' | 'complete';
}

/**
 * Get migration status for a specific table
 */
export async function getTableMigrationStatus(tableName: string): Promise<MigrationStatus | null> {
  if (!ENCRYPTED_TABLES.includes(tableName as (typeof ENCRYPTED_TABLES)[number])) {
    return null;
  }

  try {
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from(tableName as any)
      .select('*', { count: 'exact', head: true });

    if (countError) {
      logger.error('Error getting table count', countError instanceof Error ? countError : new Error(String(countError)), { component: 'migrationStatus', table: tableName });
      return null;
    }

    // Get encrypted count (has encryption_metadata)
    const { count: encryptedCount, error: encryptedError } = await supabase
      .from(tableName as any)
      .select('*', { count: 'exact', head: true })
      .not('encryption_metadata', 'is', null);

    if (encryptedError) {
      logger.warn('Error getting encrypted count', encryptedError instanceof Error ? encryptedError : new Error(String(encryptedError)), { component: 'migrationStatus', table: tableName });
    }

    const total = totalCount || 0;
    const encrypted = encryptedCount || 0;
    const plaintext = total - encrypted;
    const percentage = total > 0 ? Math.round((encrypted / total) * 100) : 0;

    let status: 'not_started' | 'in_progress' | 'complete';
    if (percentage === 0) {
      status = 'not_started';
    } else if (percentage === 100) {
      status = 'complete';
    } else {
      status = 'in_progress';
    }

    return {
      table: tableName,
      totalRecords: total,
      encryptedRecords: encrypted,
      plaintextRecords: plaintext,
      percentageEncrypted: percentage,
      status,
    };
  } catch (error) {
    logger.error('Error getting migration status', error instanceof Error ? error : new Error(String(error)), { component: 'migrationStatus', table: tableName });
    return null;
  }
}

/**
 * Get migration status for all encrypted tables
 */
export async function getAllMigrationStatus(): Promise<MigrationStatus[]> {
  const statuses: MigrationStatus[] = [];

  for (const table of ENCRYPTED_TABLES) {
    const status = await getTableMigrationStatus(table);
    if (status) {
      statuses.push(status);
    }
  }

  return statuses;
}

/**
 * Get overall migration progress
 */
export async function getOverallMigrationProgress(): Promise<{
  totalRecords: number;
  encryptedRecords: number;
  plaintextRecords: number;
  percentageEncrypted: number;
  tablesStatus: MigrationStatus[];
}> {
  const tablesStatus = await getAllMigrationStatus();
  
  const totalRecords = tablesStatus.reduce((sum, s) => sum + s.totalRecords, 0);
  const encryptedRecords = tablesStatus.reduce((sum, s) => sum + s.encryptedRecords, 0);
  const plaintextRecords = tablesStatus.reduce((sum, s) => sum + s.plaintextRecords, 0);
  const percentageEncrypted = totalRecords > 0 ? Math.round((encryptedRecords / totalRecords) * 100) : 0;

  return {
    totalRecords,
    encryptedRecords,
    plaintextRecords,
    percentageEncrypted,
    tablesStatus,
  };
}

