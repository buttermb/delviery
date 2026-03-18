/**
 * Shared Encryption Utilities for Edge Functions
 * Provides AES-256-GCM encryption/decryption for customer PHI/PII
 */

import { createClient } from './deps.ts';

// Encryption constants
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(
  data: string,
  password: string
): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive key
  const key = await deriveKey(password, salt);
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    dataBuffer
  );
  
  // Combine salt + IV + encrypted data
  const combined = new Uint8Array(
    SALT_LENGTH + IV_LENGTH + encryptedBuffer.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(encryptedBuffer), SALT_LENGTH + IV_LENGTH);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(
  encryptedData: string,
  password: string
): Promise<string> {
  // Convert from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract salt, IV, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
  
  // Derive key
  const key = await deriveKey(password, salt);
  
  // Decrypt
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv },
    key,
    ciphertext
  );
  
  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt customer record fields
 */
export async function encryptCustomerFields(
  customer: any,
  password: string
): Promise<any> {
  const encrypted: any = { ...customer };
  
  // Fields to encrypt
  const fieldsToEncrypt = [
    'first_name', 'last_name', 'email', 'phone', 'address',
    'city', 'state', 'zip_code', 'date_of_birth',
    'medical_card_number', 'medical_card_state', 'medical_card_expiration',
    'physician_name', 'qualifying_conditions', 'caregiver_name',
    'caregiver_phone', 'medical_card_photo_url', 'allergies',
    'preferred_products', 'preferred_strains'
  ];
  
  for (const field of fieldsToEncrypt) {
    if (customer[field] !== undefined && customer[field] !== null) {
      const value = typeof customer[field] === 'string' 
        ? customer[field] 
        : JSON.stringify(customer[field]);
      encrypted[`${field}_encrypted`] = await encryptData(value, password);
      delete encrypted[field]; // Remove plaintext
    }
  }
  
  // Create search indexes
  if (customer.email) {
    encrypted.email_search_index = await createSearchHash(customer.email);
  }
  if (customer.phone) {
    encrypted.phone_search_index = await createSearchHash(customer.phone);
  }
  if (customer.medical_card_number) {
    encrypted.medical_card_number_search_index = await createSearchHash(customer.medical_card_number);
  }
  
  // Mark as encrypted
  encrypted.is_encrypted = true;
  encrypted.encryption_metadata = {
    version: 1,
    algorithm: 'AES-256-GCM',
    timestamp: new Date().toISOString(),
  };
  
  return encrypted;
}

/**
 * Decrypt customer record fields
 */
export async function decryptCustomerFields(
  encryptedCustomer: any,
  password: string
): Promise<any> {
  const decrypted: any = { ...encryptedCustomer };
  
  // Fields that are encrypted
  const encryptedFields = [
    'first_name', 'last_name', 'email', 'phone', 'address',
    'city', 'state', 'zip_code', 'date_of_birth',
    'medical_card_number', 'medical_card_state', 'medical_card_expiration',
    'physician_name', 'qualifying_conditions', 'caregiver_name',
    'caregiver_phone', 'medical_card_photo_url', 'allergies',
    'preferred_products', 'preferred_strains'
  ];
  
  for (const field of encryptedFields) {
    const encryptedField = `${field}_encrypted`;
    if (encryptedCustomer[encryptedField]) {
      const decryptedValue = await decryptData(
        encryptedCustomer[encryptedField],
        password
      );
      
      // Try to parse JSON if it was originally an object/array
      try {
        decrypted[field] = JSON.parse(decryptedValue);
      } catch {
        decrypted[field] = decryptedValue;
      }
      
      delete decrypted[encryptedField]; // Remove encrypted field
    }
  }
  
  // Remove search indexes from display
  delete decrypted.email_search_index;
  delete decrypted.phone_search_index;
  delete decrypted.medical_card_number_search_index;
  
  return decrypted;
}

/**
 * Create search hash for encrypted field
 */
export async function createSearchHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Log PHI access for HIPAA compliance
 */
export async function logPHIAccess(
  supabaseClient: any,
  customerId: string,
  action: 'view' | 'create' | 'update' | 'decrypt' | 'search' | 'export' | 'delete',
  fieldsAccessed: string[],
  userId?: string,
  purpose?: string
): Promise<void> {
  try {
    await supabaseClient.rpc('log_phi_access', {
      p_customer_id: customerId,
      p_action: action,
      p_fields_accessed: fieldsAccessed,
      p_purpose: purpose
    });
  } catch (error) {
    console.error('PHI access logging error:', error);
    // Don't fail the operation if logging fails
  }
}
