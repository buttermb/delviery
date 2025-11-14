/**
 * Sensitive Field Encryption Helpers
 * 
 * Utilities for encrypting/decrypting sensitive fields like lab results
 * Integrates with AES-256 encryption utilities
 */

import { encryptJSON, decryptJSON, generateEncryptionKey, isEncryptionSupported, EncryptionError } from './aes256';
import { logger } from '@/lib/logger';

/**
 * Lab Results Interface
 */
export interface LabResults {
  thc_percent?: number;
  cbd_percent?: number;
  terpenes?: Record<string, number>; // e.g., { "myrcene": 0.5, "limonene": 0.3 }
  batch_number?: string;
  lab_certificate_url?: string;
  test_date?: string;
  lab_name?: string;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Encrypt lab results before storing in database
 * 
 * @param labResults - Lab results object to encrypt
 * @param encryptionKey - Optional encryption key (will generate if not provided)
 * @returns Encrypted data as base64 string
 */
export async function encryptLabResults(
  labResults: LabResults,
  encryptionKey?: CryptoKey
): Promise<string> {
  if (!isEncryptionSupported()) {
    throw new EncryptionError('Web Crypto API not available');
  }

  try {
    const key = encryptionKey || await generateEncryptionKey();
    return await encryptJSON(labResults, key);
  } catch (error) {
    logger.error('Failed to encrypt lab results', error);
    throw new EncryptionError('Encryption failed', error);
  }
}

/**
 * Decrypt lab results from database
 * 
 * @param encryptedData - Base64 encrypted string
 * @param encryptionKey - Decryption key
 * @returns Decrypted lab results object
 */
export async function decryptLabResults(
  encryptedData: string,
  encryptionKey: CryptoKey
): Promise<LabResults> {
  if (!isEncryptionSupported()) {
    throw new EncryptionError('Web Crypto API not available');
  }

  try {
    return await decryptJSON<LabResults>(encryptedData, encryptionKey);
  } catch (error) {
    logger.error('Failed to decrypt lab results', error);
    throw new EncryptionError('Decryption failed', error);
  }
}

/**
 * Check if data is encrypted
 * Simple heuristic: encrypted data is base64 and longer than unencrypted would be
 */
export function isEncrypted(data: string): boolean {
  // Encrypted data is base64, typically longer than original
  // This is a simple check - in production, use a marker prefix
  try {
    // Try to decode as base64
    atob(data);
    // If it's valid base64 and reasonably long, assume encrypted
    return data.length > 50;
  } catch {
    return false;
  }
}

/**
 * Format lab results for display (decrypt if needed)
 * 
 * @param data - Encrypted or plain lab results
 * @param encryptionKey - Optional decryption key
 * @returns Formatted lab results string
 */
export async function formatLabResultsForDisplay(
  data: string | LabResults,
  encryptionKey?: CryptoKey
): Promise<string> {
  // If it's already an object, format it
  if (typeof data === 'object') {
    return formatLabResultsObject(data);
  }

  // If it's encrypted, decrypt first
  if (isEncrypted(data) && encryptionKey) {
    try {
      const decrypted = await decryptLabResults(data, encryptionKey);
      return formatLabResultsObject(decrypted);
    } catch (error) {
      logger.warn('Failed to decrypt lab results for display', error);
      return 'Lab results unavailable';
    }
  }

  // If it's a plain string, try to parse as JSON
  try {
    const parsed = JSON.parse(data) as LabResults;
    return formatLabResultsObject(parsed);
  } catch {
    return data; // Return as-is if not JSON
  }
}

/**
 * Format lab results object for display
 */
function formatLabResultsObject(results: LabResults): string {
  const parts: string[] = [];

  if (results.thc_percent !== undefined) {
    parts.push(`THC: ${results.thc_percent}%`);
  }
  if (results.cbd_percent !== undefined) {
    parts.push(`CBD: ${results.cbd_percent}%`);
  }
  if (results.terpenes && Object.keys(results.terpenes).length > 0) {
    const terpeneList = Object.entries(results.terpenes)
      .map(([name, value]) => `${name}: ${value}%`)
      .join(', ');
    parts.push(`Terpenes: ${terpeneList}`);
  }
  if (results.batch_number) {
    parts.push(`Batch: ${results.batch_number}`);
  }
  if (results.lab_name) {
    parts.push(`Lab: ${results.lab_name}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No lab results available';
}

/**
 * Validate lab results structure
 */
export function validateLabResults(data: unknown): data is LabResults {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const results = data as LabResults;

  // Check numeric fields
  if (results.thc_percent !== undefined && typeof results.thc_percent !== 'number') {
    return false;
  }
  if (results.cbd_percent !== undefined && typeof results.cbd_percent !== 'number') {
    return false;
  }

  // Check terpenes object
  if (results.terpenes !== undefined) {
    if (typeof results.terpenes !== 'object' || results.terpenes === null) {
      return false;
    }
    // All terpene values should be numbers
    for (const value of Object.values(results.terpenes)) {
      if (typeof value !== 'number') {
        return false;
      }
    }
  }

  return true;
}

