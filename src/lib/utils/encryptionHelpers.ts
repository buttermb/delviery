// src/lib/utils/encryptionHelpers.ts
// Helper utilities for encryption operations

import { getEncryptedFields, getSearchableFields, isEncryptedField, getOriginalFieldName } from '../encryption/utils';
import { ENCRYPTED_TABLES } from '../encryption/constants';

/**
 * Check if a table requires encryption
 */
export function isEncryptedTable(tableName: string): boolean {
  return ENCRYPTED_TABLES.includes(tableName as (typeof ENCRYPTED_TABLES)[number]);
}

/**
 * Get fields that should be encrypted for a record
 */
export function getFieldsToEncrypt(tableName: string, record: Record<string, unknown>): string[] {
  const fieldsToEncrypt = getEncryptedFields(tableName);
  return fieldsToEncrypt.filter(field => record[field] !== undefined && record[field] !== null);
}

/**
 * Check if a record has encrypted data
 */
export function hasEncryptedData(record: Record<string, unknown>): boolean {
  return Object.keys(record).some(key => isEncryptedField(key));
}

/**
 * Merge encrypted and plaintext data (for hybrid migration)
 * Returns the best available value (encrypted decrypted > plaintext)
 */
export function mergeEncryptedPlaintext<T extends Record<string, unknown>>(
  record: T,
  decrypted: Partial<T>
): T {
  const merged = { ...record } as Record<string, unknown>;
  
  // For each field that could be encrypted
  Object.keys(decrypted).forEach(key => {
    // If we have decrypted value, use it (it's from encrypted field)
    if (decrypted[key] !== undefined && decrypted[key] !== null) {
      merged[key] = decrypted[key];
    }
    // Otherwise, keep original (plaintext) value
    else if (merged[key] === undefined && record[key] !== undefined) {
      merged[key] = record[key];
    }
  });
  
  return merged as T;
}

/**
 * Prepare data for display (handles both encrypted and plaintext)
 */
export function prepareDataForDisplay<T extends Record<string, unknown>>(
  record: T,
  decrypted?: Partial<T>
): T {
  if (decrypted) {
    return mergeEncryptedPlaintext(record, decrypted);
  }
  return record;
}

/**
 * Check if encryption is available for a table
 */
export function canEncryptTable(tableName: string): boolean {
  return isEncryptedTable(tableName);
}

/**
 * Get search index field name for a given field
 */
export function getSearchIndexForField(fieldName: string): string {
  return `${fieldName}_search_index`;
}

/**
 * Validate encrypted record structure
 */
export function validateEncryptedRecord(record: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check if record has encryption metadata
  if (!record.encryption_metadata) {
    errors.push('Missing encryption_metadata');
  } else {
    const metadata = record.encryption_metadata as any;
    if (typeof metadata !== 'object' || metadata === null) {
      errors.push('Invalid encryption_metadata format');
    } else {
      if (typeof metadata.version !== 'number') {
        errors.push('Missing or invalid encryption version');
      }
      if (typeof metadata.algorithm !== 'string') {
        errors.push('Missing or invalid encryption algorithm');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get encryption status for a record
 */
export function getEncryptionStatus(record: Record<string, unknown>): {
  isEncrypted: boolean;
  hasPlaintext: boolean;
  isHybrid: boolean;
} {
  const hasEncrypted = hasEncryptedData(record);
  const hasPlaintext = Object.keys(record).some(key => {
    if (isEncryptedField(key)) return false;
    if (key.includes('search_index')) return false;
    if (key === 'encryption_metadata') return false;
    // Check if there's a corresponding plaintext field
    const originalField = getOriginalFieldName(key);
    return record[originalField] !== undefined;
  });
  
  return {
    isEncrypted: hasEncrypted,
    hasPlaintext: hasPlaintext,
    isHybrid: hasEncrypted && hasPlaintext,
  };
}

