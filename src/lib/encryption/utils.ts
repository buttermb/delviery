// src/lib/encryption/utils.ts

import { ENCRYPTED_FIELDS, SEARCHABLE_FIELDS, ENCRYPTED_SUFFIX, SEARCH_INDEX_SUFFIX } from './constants';
import type { EncryptionMetadata } from './types';

/**
 * Get list of fields that should be encrypted for a table
 */
export function getEncryptedFields(tableName: string): readonly string[] {
  return ENCRYPTED_FIELDS[tableName as keyof typeof ENCRYPTED_FIELDS] ?? [];
}

/**
 * Get list of searchable fields for a table
 */
export function getSearchableFields(tableName: string): readonly string[] {
  return SEARCHABLE_FIELDS[tableName as keyof typeof SEARCHABLE_FIELDS] ?? [];
}

/**
 * Check if a field name indicates it's encrypted
 */
export function isEncryptedField(fieldName: string): boolean {
  return fieldName.endsWith(ENCRYPTED_SUFFIX);
}

/**
 * Check if a field name indicates it's a search index
 */
export function isSearchIndexField(fieldName: string): boolean {
  return fieldName.endsWith(SEARCH_INDEX_SUFFIX);
}

/**
 * Get original field name from encrypted field name
 */
export function getOriginalFieldName(encryptedFieldName: string): string {
  if (isEncryptedField(encryptedFieldName)) {
    return encryptedFieldName.replace(ENCRYPTED_SUFFIX, '');
  }
  if (isSearchIndexField(encryptedFieldName)) {
    return encryptedFieldName.replace(SEARCH_INDEX_SUFFIX, '');
  }
  return encryptedFieldName;
}

/**
 * Get encrypted field name from original field name
 */
export function getEncryptedFieldName(originalFieldName: string): string {
  return `${originalFieldName}${ENCRYPTED_SUFFIX}`;
}

/**
 * Get search index field name from original field name
 */
export function getSearchIndexFieldName(originalFieldName: string): string {
  return `${originalFieldName}${SEARCH_INDEX_SUFFIX}`;
}

/**
 * Validate encryption metadata
 */
export function validateEncryptionMetadata(metadata: unknown): metadata is EncryptionMetadata {
  if (typeof metadata !== 'object' || metadata === null) return false;
  const m = metadata as Record<string, unknown>;
  return (
    typeof m.version === 'number' &&
    typeof m.algorithm === 'string' &&
    typeof m.timestamp === 'string'
  );
}

/**
 * Check if a record has encrypted fields
 */
export function hasEncryptedFields(record: Record<string, unknown>): boolean {
  return Object.keys(record).some(key => isEncryptedField(key));
}

/**
 * Filter out encrypted fields from a record (for display purposes)
 */
export function filterEncryptedFields(record: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isEncryptedField(key) && !isSearchIndexField(key) && key !== 'encryption_metadata') {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Sanitize error messages to avoid leaking sensitive data
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Remove any potential sensitive data from error messages
    let message = error.message;
    // Remove potential encryption keys or passwords
    message = message.replace(/password|key|secret|token/gi, '[REDACTED]');
    return message;
  }
  return 'An unknown error occurred';
}

